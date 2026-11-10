from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """ClipSave Backend Application Settings."""
    
    APP_NAME: str = "ClipSave Resolver"
    APP_VERSION: str = "1.0.7"
    DEBUG: bool = False
    
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
    ]
    
    RATE_LIMIT_PER_MINUTE: int = 30
    STREAM_RATE_LIMIT_PER_MINUTE: int = 120
    
    REQUEST_TIMEOUT_SECONDS: int = 45
    MAX_CONCURRENT_EXTRACTIONS: int = 5
    MAX_CONCURRENT_STREAMS: int = 10
    MAX_BODY_BYTES: int = 1048576
    CHUNK_SIZE_BYTES: int = 262144
    
    ENABLE_MOCK_EXTRACTOR: bool = False
    YT_PROXY: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
