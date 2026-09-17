from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from backend.app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args={
        "check_same_thread": False,
        "timeout": 30.0
    }
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def init_db():
    async with engine.begin() as conn:
        from sqlalchemy import text
        try:
            await conn.execute(text("PRAGMA journal_mode=WAL;"))
            await conn.execute(text("PRAGMA busy_timeout=30000;"))
        except Exception:
            pass
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE download_jobs ADD COLUMN category_tag VARCHAR(100)"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE download_jobs ADD COLUMN current_stage TEXT"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE download_jobs ADD COLUMN logs TEXT"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE app_settings ADD COLUMN max_queue_limit INTEGER DEFAULT 8"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE app_settings ADD COLUMN max_download_workers INTEGER DEFAULT 2"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE user_sessions ADD COLUMN profile_pic_url TEXT"))
        except Exception:
            pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
