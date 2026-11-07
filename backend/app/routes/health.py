from fastapi import APIRouter
from ..config import settings

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    """Root info endpoint."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "message": "ClipSave resolver backend is running.",
    }


@router.get("/healthz")
async def health_check():
    """Liveness probe."""
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@router.get("/readyz")
async def readiness_check():
    """Readiness probe with ffmpeg and environment diagnosis."""
    import shutil
    import subprocess
    import os
    from ..services.stream_cache import get_cache_dir
    ff = shutil.which("ffmpeg")
    ver = None
    if ff:
        try:
            r = subprocess.run([ff, "-version"], capture_output=True, text=True, timeout=3)
            ver = r.stdout.splitlines()[0] if r.stdout else None
        except Exception as e:
            ver = str(e)
    cache_dir = str(get_cache_dir())
    return {
        "status": "ready",
        "ffmpeg_path": ff,
        "ffmpeg_version": ver,
        "cache_dir": cache_dir,
        "uid": os.getuid() if hasattr(os, "getuid") else None,
    }
