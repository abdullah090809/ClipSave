import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from app.main import app
from app.services.extractor import register_stream_session, clear_stream_sessions
from app.services.stream_cache import stream_cache_manager, get_cache_dir


@pytest.fixture(autouse=True)
def cleanup_cache_and_sessions():
    clear_stream_sessions()
    stream_cache_manager.clear_all()
    yield
    clear_stream_sessions()
    stream_cache_manager.clear_all()


@pytest.mark.asyncio
async def test_composite_stream_range_requests():
    stream_id = "yt_dash_range_test"
    cache_dir = get_cache_dir()
    final_file = cache_dir / f"{stream_id}.mp4"
    dummy_payload = b"MP4_HEADER_BYTES_" + (b"X" * 1000)  # Total 1017 bytes
    final_file.write_bytes(dummy_payload)
    total_size = len(dummy_payload)

    register_stream_session(
        stream_id=stream_id,
        media_url="https://rr1---sn-video.googlevideo.com/videoplayback?id=video",
        audio_url="https://rr1---sn-video.googlevideo.com/videoplayback?id=audio",
        headers={"User-Agent": "Mozilla/5.0"},
        title="Range Test Video",
        is_audio_only=False,
        ext="mp4",
        estimated_size=total_size,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.routes.resolve.verify_url_ssrf_safety", return_value=(True, "")):
            # 1. Full GET without range
            r_full = await client.get(f"/v1/stream/{stream_id}")
            assert r_full.status_code == 200
            assert r_full.headers.get("accept-ranges") == "bytes"
            assert r_full.headers.get("content-length") == str(total_size)
            assert r_full.content == dummy_payload

            # 2. Closed Range GET (bytes=0-99)
            r_range1 = await client.get(f"/v1/stream/{stream_id}", headers={"Range": "bytes=0-99"})
            assert r_range1.status_code == 206
            assert r_range1.headers.get("accept-ranges") == "bytes"
            assert r_range1.headers.get("content-range") == f"bytes 0-99/{total_size}"
            assert r_range1.headers.get("content-length") == "100"
            assert r_range1.content == dummy_payload[:100]

            # 3. Open-ended Resume Range GET (bytes=100-)
            r_range2 = await client.get(f"/v1/stream/{stream_id}", headers={"Range": "bytes=100-"})
            assert r_range2.status_code == 206
            assert r_range2.headers.get("accept-ranges") == "bytes"
            assert r_range2.headers.get("content-range") == f"bytes 100-{total_size - 1}/{total_size}"
            assert r_range2.headers.get("content-length") == str(total_size - 100)
            assert r_range2.content == dummy_payload[100:]

            # 4. HEAD request
            r_head = await client.head(f"/v1/stream/{stream_id}")
            assert r_head.status_code == 200
            assert r_head.headers.get("accept-ranges") == "bytes"
            assert r_head.headers.get("content-length") == str(total_size)
            assert len(r_head.content) == 0

            # 5. Out of bounds range (bytes=99999-) -> 416
            r_oob = await client.get(f"/v1/stream/{stream_id}", headers={"Range": "bytes=99999-"})
            assert r_oob.status_code == 416
            assert r_oob.headers.get("content-range") == f"bytes */{total_size}"
