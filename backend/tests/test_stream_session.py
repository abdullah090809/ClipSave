import time
import pytest
from app.services.extractor import (
    register_stream_session,
    get_stream_session,
    clear_stream_sessions,
    MAX_STREAM_SESSIONS,
    _stream_sessions,
)


@pytest.fixture(autouse=True)
def cleanup_sessions():
    clear_stream_sessions()
    yield
    clear_stream_sessions()


def test_stream_session_registration_and_retrieval():
    stream_id = "stream_test_abc123"
    register_stream_session(
        stream_id=stream_id,
        media_url="https://v16-webapp-prime.tiktok.com/video.mp4",
        headers={"Cookie": "session=val"},
        title="Test Video",
    )

    session = get_stream_session(stream_id)
    assert session is not None
    assert session["media_url"] == "https://v16-webapp-prime.tiktok.com/video.mp4"
    assert session["title"] == "Test Video"
    assert session["headers"]["Cookie"] == "session=val"


def test_stream_session_expiration_cleanup():
    # Register an old session (> 2 hours ago)
    old_id = "stream_old_expired"
    now = time.time()
    _stream_sessions[old_id] = {
        "media_url": "https://example.com/old.mp4",
        "headers": {},
        "title": "Old",
        "created_at": now - 7300,  # 7300 seconds ago (> 7200)
    }

    # Registering a new session triggers expiration sweep
    new_id = "stream_new_active"
    register_stream_session(
        stream_id=new_id,
        media_url="https://example.com/new.mp4",
        headers={},
        title="New",
    )

    assert get_stream_session(old_id) is None
    assert get_stream_session(new_id) is not None


def test_stream_session_capacity_bounding():
    # Fill registry up to MAX_STREAM_SESSIONS
    base_time = time.time()
    for i in range(10):
        _stream_sessions[f"stream_seed_{i}"] = {
            "media_url": f"https://example.com/{i}.mp4",
            "headers": {},
            "title": f"Video {i}",
            "created_at": base_time + i,
        }

    # Temporarily reduce MAX_STREAM_SESSIONS limit for testing
    import app.services.extractor as ext
    original_max = ext.MAX_STREAM_SESSIONS
    try:
        ext.MAX_STREAM_SESSIONS = 10
        # Register an 11th session; the oldest (stream_seed_0) must be evicted
        register_stream_session(
            stream_id="stream_seed_11",
            media_url="https://example.com/11.mp4",
            headers={},
            title="Video 11",
        )
        assert len(ext._stream_sessions) <= 10
        assert get_stream_session("stream_seed_0") is None
        assert get_stream_session("stream_seed_11") is not None
    finally:
        ext.MAX_STREAM_SESSIONS = original_max
