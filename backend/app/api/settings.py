from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import AppSettings
from backend.app.schemas import AppSettingsSchema, RateLimitStatus
from backend.app.services.scraper import rate_tracker
from backend.app.config import settings

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=AppSettingsSchema)
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = result.scalars().first()
    if not app_settings:
        app_settings = AppSettings(
            id=1,
            download_directory=str(settings.DOWNLOAD_DIR),
            auto_sync_interval_hours=6,
            rate_limit_delay_seconds=3.0,
            max_posts_per_fetch=50,
            max_queue_limit=8,
            max_download_workers=2,
            pagination_mode="pages",
            page_size=36
        )
        db.add(app_settings)
        await db.commit()
        await db.refresh(app_settings)
    elif app_settings:
        changed = False
        if not app_settings.pagination_mode:
            app_settings.pagination_mode = "pages"
            changed = True
        if not app_settings.page_size:
            app_settings.page_size = 36
            changed = True
        if app_settings.download_directory and (app_settings.download_directory.endswith("/InstaSave") or app_settings.download_directory.endswith("\\InstaSave")):
            # Auto-migrate legacy default directory name to ZenGram
            suffix_len = 10
            sep = "/" if "/" in app_settings.download_directory else "\\"
            app_settings.download_directory = app_settings.download_directory[:-suffix_len] + f"{sep}ZenGram"
            changed = True
        if changed:
            await db.commit()
            await db.refresh(app_settings)
    return app_settings

@router.post("", response_model=AppSettingsSchema)
async def update_settings(data: AppSettingsSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = result.scalars().first()
    if not app_settings:
        app_settings = AppSettings(id=1)
        db.add(app_settings)

    if data.download_directory is not None:
        app_settings.download_directory = data.download_directory
    if data.auto_sync_interval_hours is not None:
        app_settings.auto_sync_interval_hours = data.auto_sync_interval_hours
    if data.rate_limit_delay_seconds is not None:
        app_settings.rate_limit_delay_seconds = data.rate_limit_delay_seconds
    if data.max_posts_per_fetch is not None:
        app_settings.max_posts_per_fetch = data.max_posts_per_fetch
    if data.max_queue_limit is not None:
        app_settings.max_queue_limit = data.max_queue_limit
    if data.max_download_workers is not None:
        app_settings.max_download_workers = data.max_download_workers
    if data.pagination_mode is not None:
        app_settings.pagination_mode = data.pagination_mode
    if data.page_size is not None:
        app_settings.page_size = data.page_size

    await db.commit()
    await db.refresh(app_settings)
    return app_settings

@router.get("/rate-limit", response_model=RateLimitStatus)
async def get_rate_limit_status():
    return rate_tracker.get_status()
