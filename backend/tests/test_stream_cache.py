import asyncio
import os
import time
import pytest
from pathlib import Path
from fastapi import HTTPException
from app.services.stream_cache import (
    parse_range_header,
    StreamCacheManager,
    StreamRemuxJob,
    get_cache_dir,
)


@pytest.fixture(autouse=True)
def clean_stream_cache():
    manager = StreamCacheManager()
    manager.clear_all()
    yield
    manager.clear_all()


def test_parse_range_header_valid():
    file_size = 1000
    # Prefix range
    assert parse_range_header("bytes=0-499", file_size) == (0, 499)
    # Open-ended range
    assert parse_range_header("bytes=500-", file_size) == (500, 999)
    # Suffix range
    assert parse_range_header("bytes=-200", file_size) == (800, 999)
    # None or non-byte range
    assert parse_range_header(None, file_size) is None
    assert parse_range_header("", file_size) is None
    assert parse_range_header("seconds=0-10", file_size) is None


def test_parse_range_header_invalid_and_out_of_bounds():
    file_size = 1000
    # Range beyond file size -> 416
    with pytest.raises(HTTPException) as exc_info:
        parse_range_header("bytes=1500-2000", file_size)
    assert exc_info.value.status_code == 416
    assert exc_info.value.headers.get("Content-Range") == "bytes */1000"

    # Inverted range -> 416
    with pytest.raises(HTTPException) as exc_info:
        parse_range_header("bytes=600-400", file_size)
    assert exc_info.value.status_code == 416

    # Malformed range -> 416
    with pytest.raises(HTTPException) as exc_info:
        parse_range_header("bytes=abc-def", file_size)
    assert exc_info.value.status_code == 416


@pytest.mark.asyncio
async def test_stream_cache_job_coordination():
    manager = StreamCacheManager()
    cache_dir = get_cache_dir()
    stream_id = "test_coord_123"
    
    # Pre-create a dummy cached file to simulate completed remux
    final_file = cache_dir / f"{stream_id}.mp4"
    dummy_content = b"FLV\x01\x05" + (b"A" * 1024)
    with open(final_file, "wb") as f:
        f.write(dummy_content)

    semaphore = asyncio.Semaphore(5)
    job = await manager.get_or_create_job(
        stream_id=stream_id,
        media_url="http://example.com/v.mp4",
        audio_url="http://example.com/a.m4a",
        headers={},
        estimated_size=len(dummy_content),
        semaphore=semaphore,
    )
    assert job.is_complete is True
    assert job.bytes_written == len(dummy_content)

    # Calling get_or_create_job again returns the identical existing job
    job2 = await manager.get_or_create_job(
        stream_id=stream_id,
        media_url="http://example.com/v.mp4",
        audio_url="http://example.com/a.m4a",
        headers={},
        estimated_size=len(dummy_content),
        semaphore=semaphore,
    )
    assert job2 is job


def test_cache_pruning_ttl_and_stale_files():
    manager = StreamCacheManager()
    cache_dir = get_cache_dir()
    now = time.time()

    # Create an old .tmp file (stale, >600s old)
    stale_tmp = cache_dir / "stale_stream.mp4.tmp"
    stale_tmp.write_bytes(b"stale data")
    os.utime(str(stale_tmp), (now - 1000, now - 1000))

    # Create a fresh .tmp file (<600s old)
    fresh_tmp = cache_dir / "fresh_stream.mp4.tmp"
    fresh_tmp.write_bytes(b"fresh data")

    # Create an old .mp4 file (>1800s old)
    old_mp4 = cache_dir / "old_stream.mp4"
    old_mp4.write_bytes(b"old video")
    os.utime(str(old_mp4), (now - 2500, now - 2500))

    # Create a fresh .mp4 file
    fresh_mp4 = cache_dir / "fresh_stream.mp4"
    fresh_mp4.write_bytes(b"fresh video")

    # Run prune
    manager.prune_cache()

    assert not stale_tmp.exists(), "Stale .tmp file should be pruned"
    assert fresh_tmp.exists(), "Fresh .tmp file should remain"
    assert not old_mp4.exists(), "Expired .mp4 file should be pruned"
    assert fresh_mp4.exists(), "Fresh .mp4 file should remain"
