from typing import Optional
from pydantic import BaseModel, Field


class ResolveRequest(BaseModel):
    """Client request to resolve a TikTok video URL."""
    url: str = Field(..., max_length=2048, description="Target public TikTok video URL")


class ResolvedMediaResponse(BaseModel):
    """Validated media metadata returned to the mobile client."""
    id: str
    sourceUrl: str
    title: str
    author: str
    authorUsername: Optional[str] = None
    durationSeconds: Optional[float] = None
    thumbnailUrl: Optional[str] = None
    mediaUrl: str
    directMediaUrl: Optional[str] = None
    httpHeaders: Optional[dict[str, str]] = None
    estimatedSizeBytes: Optional[int] = None
    format: str = "mp4"
    expiresAt: Optional[str] = None
    isCleanSourceVerified: bool = False


class ErrorResponse(BaseModel):
    """Machine-readable error envelope."""
    code: str
    message: str
    requestId: str
