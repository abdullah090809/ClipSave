from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """ClipSave Backend Application Settings."""
    
    APP_NAME: str = "ClipSave Resolver"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    
    # Strict CORS configuration
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
    ]
    
    # Rate Limiting: max requests per minute per IP
    RATE_LIMIT_PER_MINUTE: int = 30
    
    # Extraction Timeouts and Concurrency Limits
    REQUEST_TIMEOUT_SECONDS: int = 15
    MAX_CONCURRENT_EXTRACTIONS: int = 5
    
    # Enable mock extractor mode (for CI, deterministic tests, or when third-party network is restricted)
    ENABLE_MOCK_EXTRACTOR: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
