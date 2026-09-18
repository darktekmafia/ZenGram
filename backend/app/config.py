import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DOWNLOAD_DIR = Path.home() / "Downloads" / "ZenGram"

class Settings(BaseSettings):
    PROJECT_NAME: str = "ZenGram"
    VERSION: str = "1.0.1"
    API_PREFIX: str = "/api/v1"
    
    # Paths
    BASE_DIR: Path = BASE_DIR
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR}/zengram.db"
    DOWNLOAD_DIR: Path = DEFAULT_DOWNLOAD_DIR
    SESSIONS_DIR: Path = BASE_DIR / "storage" / "sessions"
    
    # Rate Limiting & Safety Defaults
    MAX_REQUESTS_PER_HOUR: int = 150
    MIN_REQUEST_DELAY_SECONDS: float = 2.0
    MAX_REQUEST_DELAY_SECONDS: float = 5.0
    
    # App Port
    PORT: int = 8484
    HOST: str = "127.0.0.1"

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure required directories exist
os.makedirs(settings.DOWNLOAD_DIR, exist_ok=True)
os.makedirs(settings.SESSIONS_DIR, exist_ok=True)
