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
            max_download_workers=2
        )
        db.add(app_settings)
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

    app_settings.download_directory = data.download_directory
    app_settings.auto_sync_interval_hours = data.auto_sync_interval_hours
    app_settings.rate_limit_delay_seconds = data.rate_limit_delay_seconds
    app_settings.max_posts_per_fetch = data.max_posts_per_fetch
    app_settings.max_queue_limit = data.max_queue_limit
    app_settings.max_download_workers = data.max_download_workers

    await db.commit()
    await db.refresh(app_settings)
    return app_settings

@router.get("/rate-limit", response_model=RateLimitStatus)
async def get_rate_limit_status():
    return rate_tracker.get_status()
