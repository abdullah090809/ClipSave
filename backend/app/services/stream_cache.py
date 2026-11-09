import os
import re
import time
import shutil
import asyncio
import tempfile
import logging
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, AsyncGenerator
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import StreamingResponse

logger = logging.getLogger("clipsave.stream_cache")

# Configuration constants
MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB storage cap
CACHE_TTL_SECONDS = 1800  # 30 minutes retention
STALE_TMP_SECONDS = 600   # 10 minutes for unfinished tmp files
CHUNK_SIZE_BYTES = 262144  # 256 KB streaming chunks


def get_cache_dir() -> Path:
    """Return the designated cache directory with write permissions verified."""
    env_dir = os.environ.get("STREAM_CACHE_DIR")
    if env_dir:
        p = Path(env_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p
    
    # Try /tmp/clipsave_cache first as /tmp is guaranteed writable in container tmpfs
    tmp_cache = Path("/tmp/clipsave_cache")
    try:
        tmp_cache.mkdir(parents=True, exist_ok=True)
        test_file = tmp_cache / ".write_test"
        test_file.touch()
        test_file.unlink()
        return tmp_cache
    except Exception:
        pass

    # Try container default /app/cache
    app_cache = Path("/app/cache")
    try:
        app_cache.mkdir(parents=True, exist_ok=True)
        test_file = app_cache / ".write_test"
        test_file.touch()
        test_file.unlink()
        return app_cache
    except Exception:
        pass

    # Fallback to system temp directory
    fallback = Path(tempfile.gettempdir()) / "clipsave_stream_cache"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def parse_range_header(range_header: Optional[str], file_size: int) -> Optional[Tuple[int, int]]:
    """
    Parses standard HTTP Range header (e.g. 'bytes=0-1023', 'bytes=1024-', 'bytes=-500').
    Returns: (start, end) inclusive, or None if no valid range requested.
    Raises: HTTPException(416) if range is unsatisfiable.
    """
    if not range_header or not range_header.startswith("bytes="):
        return None

    range_val = range_header.replace("bytes=", "").strip()
    # If multiple ranges (comma-separated), take first range per RFC 7233
    if "," in range_val:
        range_val = range_val.split(",")[0].strip()

    match = re.match(r"^(\d*)-(\d*)$", range_val)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
            detail="Malformed Range header."
        )

    start_str, end_str = match.groups()

    if not start_str and not end_str:
        raise HTTPException(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
            detail="Empty byte range specification."
        )

    if not start_str:
        # Suffix byte range: e.g. -500 means last 500 bytes
        suffix_len = int(end_str)
        if suffix_len <= 0:
            raise HTTPException(
                status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
                headers={"Content-Range": f"bytes */{file_size}"},
                detail="Suffix range must be positive."
            )
        start = max(0, file_size - suffix_len)
        end = file_size - 1
    elif not end_str:
        # Prefix byte range: e.g. 1024- means from byte 1024 to end
        start = int(start_str)
        end = file_size - 1
    else:
        # Closed range: e.g. 0-499
        start = int(start_str)
        end = int(end_str)

    if file_size > 0 and (start >= file_size or start > end):
        raise HTTPException(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
            detail=f"Requested range {start}-{end} cannot be satisfied for size {file_size}."
        )

    end = min(end, file_size - 1) if file_size > 0 else end
    return start, end


class StreamRemuxJob:
    """Coordinating remux job that caches FFmpeg output to disk for seekable HTTP range delivery."""

    def __init__(self, stream_id: str, media_url: str, audio_url: str, headers: Dict[str, str], estimated_size: Optional[int]):
        self.stream_id = stream_id
        self.media_url = media_url
        self.audio_url = audio_url
        self.headers = headers
        self.estimated_size = estimated_size
        
        cache_dir = get_cache_dir()
        self.final_file = cache_dir / f"{stream_id}.mp4"
        
        self.is_complete = False
        self.error: Optional[Exception] = None
        self.process: Optional[asyncio.subprocess.Process] = None
        self.bytes_written = 0
        self.last_activity = time.time()
        self.condition = asyncio.Condition()

    async def start(self, semaphore: asyncio.Semaphore):
        """Executes FFmpeg remux pipeline writing directly to self.final_file."""
        if self.final_file.exists() and self.final_file.stat().st_size > 0 and self.is_complete:
            self.bytes_written = self.final_file.stat().st_size
            return

        ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
        
        header_args = []
        if self.headers:
            header_str = "".join([
                f"{k}: {v}\r\n"
                for k, v in self.headers.items()
                if k.lower() in ("user-agent", "cookie", "referer")
            ])
            if header_str:
                header_args = ["-headers", header_str]

        network_args = [
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "5",
            "-rw_timeout", "15000000",
        ]

        is_opus = ".webm" in self.audio_url.lower() or "opus" in self.audio_url.lower()
        bsf_args = []
        if not is_opus and any(x in self.audio_url.lower() for x in ("m4a", "aac", "manifest", "m3u8", "mp4a")):
            bsf_args = ["-bsf:a", "aac_adtstoasc"]

        cmd = [
            ffmpeg_bin,
            "-y",
            "-nostdin",
            "-protocol_whitelist", "file,http,https,tcp,tls,crypto,pipe,data,hls",
            "-analyzeduration", "1000000",
            "-probesize", "1000000",
            *header_args,
            *network_args,
            "-i", self.media_url,
            *header_args,
            *network_args,
            "-i", self.audio_url,
            "-c", "copy",
            *bsf_args,
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",
            "-f", "mp4",
            str(self.final_file),
        ]

        await semaphore.acquire()
        drain_task = None
        stderr_lines = []
        try:
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )

            async def drain_stderr():
                try:
                    while True:
                        line = await self.process.stderr.readline()
                        if not line:
                            break
                        if len(stderr_lines) > 25:
                            stderr_lines.pop(0)
                        stderr_lines.append(line.decode(errors="replace").strip())
                except Exception:
                    pass

            drain_task = asyncio.create_task(drain_stderr())

            # Monitor file growth while process is running
            while self.process.returncode is None:
                await asyncio.sleep(0.15)
                if self.final_file.exists():
                    current_size = self.final_file.stat().st_size
                    if current_size != self.bytes_written:
                        self.bytes_written = current_size
                        self.last_activity = time.time()
                        async with self.condition:
                            self.condition.notify_all()

                # Poll process status
                if self.process.returncode is not None:
                    break
                try:
                    await asyncio.wait_for(asyncio.shield(self.process.wait()), timeout=0.05)
                except (asyncio.TimeoutError, TimeoutError):
                    pass

            if drain_task and not drain_task.done():
                try:
                    await asyncio.wait_for(drain_task, timeout=1.0)
                except Exception:
                    pass

            await self.process.wait()

            if self.process.returncode == 0 and self.final_file.exists() and self.final_file.stat().st_size > 0:
                self.bytes_written = self.final_file.stat().st_size
                self.is_complete = True
                self.last_activity = time.time()
                logger.info(f"Remux completed for {self.stream_id}: {self.bytes_written} bytes")
            else:
                stderr_clean = " | ".join(stderr_lines[-5:]) if stderr_lines else "None"
                err_msg = f"FFmpeg remux process exited with code {self.process.returncode} (stderr: {stderr_clean})"
                logger.error(f"{err_msg} for {self.stream_id}")
                self.error = Exception(err_msg)
                stream_cache_manager.last_error = err_msg
                if self.final_file.exists() and not self.is_complete:
                    try:
                        self.final_file.unlink()
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"Remux failed for {self.stream_id}: {e}")
            self.error = e
            stream_cache_manager.last_error = str(e)
            if self.final_file.exists() and not self.is_complete:
                try:
                    self.final_file.unlink()
                except Exception:
                    pass
        finally:
            if drain_task and not drain_task.done():
                drain_task.cancel()
            semaphore.release()
            async with self.condition:
                self.condition.notify_all()


class StreamCacheManager:
    """Manages active remux jobs, range-aware serving, and disk cleanup."""

    def __init__(self):
        self._jobs: Dict[str, StreamRemuxJob] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()
        self.last_error: Optional[str] = None

    async def get_or_create_job(
        self,
        stream_id: str,
        media_url: str,
        audio_url: str,
        headers: Dict[str, str],
        estimated_size: Optional[int],
        semaphore: asyncio.Semaphore,
    ) -> StreamRemuxJob:
        """Get an existing job or start a new background remux job, evicting any failed jobs."""
        cache_dir = get_cache_dir()
        final_file = cache_dir / f"{stream_id}.mp4"
        
        async with self._lock:
            existing_job = self._jobs.get(stream_id)
            if existing_job:
                # If existing job has an error or died before completion, evict it!
                if existing_job.error is not None or (existing_job.process and existing_job.process.returncode not in (None, 0)):
                    logger.warning(f"Evicting failed job for {stream_id}: {existing_job.error}")
                    self._jobs.pop(stream_id, None)
                    self._tasks.pop(stream_id, None)
                    if existing_job.final_file.exists():
                        try:
                            existing_job.final_file.unlink()
                        except Exception:
                            pass
                else:
                    return existing_job

            job = StreamRemuxJob(stream_id, media_url, audio_url, headers, estimated_size)
            if final_file.exists() and final_file.stat().st_size > 0:
                job.is_complete = True
                job.bytes_written = final_file.stat().st_size
            else:
                task = asyncio.create_task(job.start(semaphore))
                self._tasks[stream_id] = task

            self._jobs[stream_id] = job
            return job

    async def evict_job(self, stream_id: str):
        """Immediately evict and cancel a failed or aborted job so retries start fresh."""
        async with self._lock:
            job = self._jobs.pop(stream_id, None)
            task = self._tasks.pop(stream_id, None)
            if task and not task.done():
                task.cancel()
            if job and job.process and job.process.returncode is None:
                try:
                    job.process.kill()
                except (ProcessLookupError, OSError):
                    pass
            if job and job.final_file.exists() and not job.is_complete:
                try:
                    job.final_file.unlink()
                except Exception:
                    pass

    async def serve_stream(
        self,
        job: StreamRemuxJob,
        request: Request,
        req_id: str,
    ) -> Response:
        """
        Serves the cached or progressively generated stream supporting:
        - Full 200 OK responses with Content-Length and Accept-Ranges: bytes
        - HTTP 206 Partial Content byte ranges for resuming
        - HTTP 416 Range Not Satisfiable
        - HEAD requests with proper headers
        """
        range_header = request.headers.get("range") or request.headers.get("Range")
        is_head = request.method == "HEAD"

        # Wait until file has started writing or completed
        timeout_at = time.time() + 15.0
        while not job.is_complete and job.bytes_written < 1024 and not job.error:
            if time.time() > timeout_at:
                break
            async with job.condition:
                try:
                    await asyncio.wait_for(job.condition.wait(), timeout=0.5)
                except (asyncio.TimeoutError, TimeoutError):
                    pass

        if job.error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "STREAM_REMUX_FAILED", "message": str(job.error), "requestId": req_id}
            )

        target_file = job.final_file
        if not target_file.exists() and not job.is_complete:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "STREAM_FILE_MISSING", "message": "Stream buffer file could not be created.", "requestId": req_id}
            )

        known_total_size = job.final_file.stat().st_size if job.is_complete else (job.estimated_size or 0)
        
        # Parse range header if supplied
        range_spec = None
        if range_header:
            effective_size_for_range = job.final_file.stat().st_size if job.is_complete else (job.estimated_size or (target_file.stat().st_size if target_file.exists() else 0))
            range_spec = parse_range_header(range_header, effective_size_for_range)

        # Build response headers
        response_headers = {
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes" if job.is_complete else "none",
            "X-Request-ID": req_id,
        }

        # Handle range vs non-range
        if range_spec:
            response_headers["Accept-Ranges"] = "bytes"
            start, end = range_spec
            
            # If start is beyond currently available bytes on an in-progress file, wait for writer up to a limit
            current_size = target_file.stat().st_size if target_file.exists() else 0
            if not job.is_complete and current_size <= start:
                wait_start_limit = time.time() + 15.0
                while not job.is_complete and (not target_file.exists() or target_file.stat().st_size <= start) and not job.error:
                    if time.time() > wait_start_limit:
                        break
                    async with job.condition:
                        try:
                            await asyncio.wait_for(job.condition.wait(), timeout=0.5)
                        except (asyncio.TimeoutError, TimeoutError):
                            pass

                current_size = target_file.stat().st_size if target_file.exists() else 0
                if current_size <= start:
                    if job.is_complete:
                        raise HTTPException(
                            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
                            headers={"Content-Range": f"bytes */{current_size}"},
                            detail="Requested offset beyond file size."
                        )
                    raise HTTPException(
                        status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
                        headers={"Content-Range": f"bytes */{current_size}"},
                        detail="Requested byte offset not yet available in buffer. Restart from byte 0."
                    )

            content_length = end - start + 1
            total_repr = str(job.final_file.stat().st_size) if job.is_complete else (str(job.estimated_size) if job.estimated_size else "*")
            
            response_headers["Content-Range"] = f"bytes {start}-{end}/{total_repr}"
            response_headers["Content-Length"] = str(content_length)

            if is_head:
                return Response(status_code=status.HTTP_206_PARTIAL_CONTENT, headers=response_headers)

            async def range_generator() -> AsyncGenerator[bytes, None]:
                bytes_sent = 0
                current_offset = start
                
                # Open read handle
                with open(target_file, "rb") as f:
                    f.seek(current_offset)
                    while bytes_sent < content_length:
                        remaining_to_send = content_length - bytes_sent
                        chunk_to_read = min(CHUNK_SIZE_BYTES, remaining_to_send)
                        
                        # Wait if file is still growing and we caught up to current EOF
                        while not job.is_complete and f.tell() >= (target_file.stat().st_size if target_file.exists() else 0) and not job.error:
                            async with job.condition:
                                try:
                                    await asyncio.wait_for(job.condition.wait(), timeout=0.3)
                                except (asyncio.TimeoutError, TimeoutError):
                                    pass

                        chunk = f.read(chunk_to_read)
                        if not chunk:
                            if job.is_complete or job.error:
                                break
                            await asyncio.sleep(0.05)
                            continue

                        bytes_sent += len(chunk)
                        current_offset += len(chunk)
                        yield chunk

            return StreamingResponse(
                range_generator(),
                status_code=status.HTTP_206_PARTIAL_CONTENT,
                headers=response_headers,
                media_type="video/mp4",
            )

        # Standard non-range GET request
        if job.is_complete:
            file_size = job.final_file.stat().st_size
            response_headers["Content-Length"] = str(file_size)
            if is_head:
                return Response(status_code=status.HTTP_200_OK, headers=response_headers)

            async def full_file_generator() -> AsyncGenerator[bytes, None]:
                with open(job.final_file, "rb") as f:
                    while True:
                        chunk = f.read(CHUNK_SIZE_BYTES)
                        if not chunk:
                            break
                        yield chunk

            return StreamingResponse(
                full_file_generator(),
                status_code=status.HTTP_200_OK,
                headers=response_headers,
                media_type="video/mp4",
            )
        else:
            if known_total_size > 0:
                response_headers["X-Estimated-Content-Length"] = str(known_total_size)
            if is_head:
                return Response(status_code=status.HTTP_200_OK, headers=response_headers)

            async def progressive_file_generator() -> AsyncGenerator[bytes, None]:
                with open(target_file, "rb") as f:
                    while True:
                        while not job.is_complete and f.tell() >= (target_file.stat().st_size if target_file.exists() else 0) and not job.error:
                            async with job.condition:
                                try:
                                    await asyncio.wait_for(job.condition.wait(), timeout=0.3)
                                except (asyncio.TimeoutError, TimeoutError):
                                    pass

                        chunk = f.read(CHUNK_SIZE_BYTES)
                        if not chunk:
                            if job.is_complete or job.error:
                                break
                            await asyncio.sleep(0.05)
                            continue
                        yield chunk

            return StreamingResponse(
                progressive_file_generator(),
                status_code=status.HTTP_200_OK,
                headers=response_headers,
                media_type="video/mp4",
            )

    def prune_cache(self):
        """Enforces TTL and MAX_CACHE_SIZE_BYTES limits on stored stream files."""
        cache_dir = get_cache_dir()
        now = time.time()
        
        # 1. Clean stale temporary files (.tmp older than STALE_TMP_SECONDS)
        for p in cache_dir.glob("*.tmp"):
            try:
                if now - p.stat().st_mtime > STALE_TMP_SECONDS:
                    p.unlink(missing_ok=True)
            except Exception:
                pass

        # 2. Clean expired complete files (.mp4 older than CACHE_TTL_SECONDS)
        mp4_files = []
        for p in cache_dir.glob("*.mp4"):
            try:
                mtime = p.stat().st_mtime
                if now - mtime > CACHE_TTL_SECONDS:
                    p.unlink(missing_ok=True)
                else:
                    mp4_files.append((p, p.stat().st_size, mtime))
            except Exception:
                pass

        # 3. Enforce maximum total storage limit (LRU by mtime)
        total_bytes = sum(size for _, size, _ in mp4_files)
        if total_bytes > MAX_CACHE_SIZE_BYTES:
            mp4_files.sort(key=lambda item: item[2])  # oldest first
            for p, size, _ in mp4_files:
                if total_bytes <= MAX_CACHE_SIZE_BYTES:
                    break
                try:
                    p.unlink(missing_ok=True)
                    total_bytes -= size
                except Exception:
                    pass

    def clear_all(self):
        """Purges all files in cache directory (used primarily for test cleanup and shutdown)."""
        cache_dir = get_cache_dir()
        for p in cache_dir.glob("*.tmp"):
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass
        for p in cache_dir.glob("*.mp4"):
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass
        self._jobs.clear()
        self._tasks.clear()


# Global singleton instance
stream_cache_manager = StreamCacheManager()
