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

        # Performance Indexes for sub-millisecond pagination and feed sorting
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_media_is_saved_date ON media_items(is_saved, saved_at DESC);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_media_taken_at ON media_items(taken_at DESC);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_media_user_type ON media_items(username, media_type);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_watched_unfollowed ON watched_profiles(is_unfollowed_track, username);"))
        except Exception:
            pass

        # Migrate any legacy plaintext session cookies to AES-256 encrypted ciphertext (Fail-Closed & Atomic)
        from backend.app.auth_utils import encrypt_secret
        try:
            res = await conn.execute(text("SELECT id, session_cookie FROM user_sessions WHERE session_cookie IS NOT NULL"))
            rows = res.fetchall()
            for row_id, cookie_val in rows:
                if cookie_val and cookie_val != "dummy_session_cookie" and not str(cookie_val).startswith("enc:"):
                    enc_val = encrypt_secret(cookie_val)
                    await conn.execute(
                        text("UPDATE user_sessions SET session_cookie = :enc WHERE id = :id"),
                        {"enc": enc_val, "id": row_id}
                    )
        except Exception as e:
            import logging
            logging.getLogger("zengram.database").critical(f"FATAL: Database credential migration failed: {e}")
            raise RuntimeError(f"Database initialization aborted: unable to safely migrate credentials: {e}") from e

    # Restrict SQLite database and WAL files to owner-only read/write (0600)
    import os
    import glob
    db_base = str(settings.BASE_DIR / "zengram.db")
    for fpath in glob.glob(f"{db_base}*"):
        try:
            os.chmod(fpath, 0o600)
        except Exception:
            pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
