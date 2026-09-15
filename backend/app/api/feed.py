from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import MediaItem, WatchedProfile
from backend.app.schemas import MediaItemResponse
from backend.app.services.scraper import InstagramScraperEngine

router = APIRouter(prefix="/feed", tags=["Feed"])

@router.get("", response_model=List[MediaItemResponse])
async def get_latest_feed(
    content_type: Optional[str] = Query("ALL", pattern="^(ALL|IMAGE|VIDEO|CAROUSEL)$"),
    filter_user: Optional[str] = None,
    query_search: Optional[str] = None,
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MediaItem)
    if content_type and content_type != "ALL":
        stmt = stmt.where(MediaItem.media_type == content_type)
    if filter_user:
        stmt = stmt.where(MediaItem.username.ilike(f"%{filter_user}%"))
    if query_search:
        stmt = stmt.where(MediaItem.caption.ilike(f"%{query_search}%"))
        
    stmt = stmt.order_by(MediaItem.id.desc()).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    if not items:
        # If DB feed is empty, trigger a demo fetch from watched profiles or default featured profiles
        scraper = InstagramScraperEngine()
        sample_users = ["travel_bug", "daily_bites", "life_hacker", "tech_insider"]
        for u in sample_users:
            posts = await scraper.get_user_posts(u, limit=5)
            for p in posts:
                existing = await db.execute(select(MediaItem).where(MediaItem.post_id == p["post_id"]))
                if not existing.scalars().first():
                    m = MediaItem(**p)
                    db.add(m)
        await db.commit()
        
        result = await db.execute(stmt)
        items = result.scalars().all()

    return items
