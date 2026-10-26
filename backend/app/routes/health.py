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
    """Readiness probe."""
    return {"status": "ready"}
