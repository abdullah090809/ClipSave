from typing import Optional, List
from pydantic import BaseModel, Field


class ResolveRequest(BaseModel):
    """Client request to resolve a media video URL (TikTok, YouTube, etc.)."""
    url: str = Field(..., max_length=2048, description="Target public video URL")


class MediaFormatOption(BaseModel):
    """Available download format option (e.g. 1080p, 720p, 360p, audio only)."""
    id: str # '1080p', '720p', '360p', 'audio', etc.
    label: str # '1080p Full HD', '720p HD', 'Audio Only (MP3)', etc.
    quality: str # '1080p', '720p', '360p', 'audio'
    extension: str = "mp4" # 'mp4', 'mp3', 'm4a'
    isVideo: bool = True
    mediaUrl: str
    estimatedSizeBytes: Optional[int] = None
    note: Optional[str] = None


class ResolvedMediaResponse(BaseModel):
    """Validated media metadata returned to the mobile client."""
    id: str
    sourceUrl: str
    platform: str = "tiktok" # 'tiktok' | 'youtube' | 'instagram' | 'facebook'
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
    quality: Optional[str] = "1080p"
    availableFormats: List[MediaFormatOption] = []
    expiresAt: Optional[str] = None
    isCleanSourceVerified: bool = False


class ErrorResponse(BaseModel):
    """Machine-readable error envelope."""
    code: str
    message: str
    requestId: str
