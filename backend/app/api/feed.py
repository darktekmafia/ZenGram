from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from backend.app.database import get_db
from backend.app.models import MediaItem, WatchedProfile
from backend.app.schemas import MediaItemResponse
from backend.app.services.scraper import InstagramScraperEngine

router = APIRouter(prefix="/feed", tags=["Feed"])

@router.get("", response_model=List[MediaItemResponse])
async def get_latest_feed(
    content_type: Optional[str] = Query("ALL", pattern="^(ALL|IMAGE|VIDEO|CAROUSEL|STORY)$"),
    filter_user: Optional[str] = None,
    query_search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MediaItem)
    if content_type and content_type != "ALL":
        stmt = stmt.where(MediaItem.media_type == content_type)
        
    if filter_user:
        stmt = stmt.where(MediaItem.username.ilike(f"%{filter_user}%"))
    else:
        # Feed (Dashboard) should only show posts from followed accounts and NOT from tracked (unfollowed) accounts.
        followed_usernames = select(func.lower(WatchedProfile.username)).where(WatchedProfile.is_unfollowed_track == False)
        tracked_usernames = select(func.lower(WatchedProfile.username)).where(WatchedProfile.is_unfollowed_track == True)
        
        stmt = stmt.where(
            func.lower(MediaItem.username).in_(followed_usernames),
            func.lower(MediaItem.username).notin_(tracked_usernames)
        )

    if query_search:
        term = query_search.strip()
        clean_term = term.lstrip('@')
        stmt = stmt.where(
            or_(
                MediaItem.username.ilike(f"%{clean_term}%"),
                MediaItem.caption.ilike(f"%{term}%"),
                MediaItem.caption.ilike(f"%{clean_term}%")
            )
        )
        
    stmt = stmt.order_by(
        MediaItem.taken_at.desc().nullslast(),
        MediaItem.id.desc()
    ).limit(limit)
    
    result = await db.execute(stmt)
    items = result.scalars().all()

    from backend.app.api.downloads import enrich_media_item
    for item in items:
        enrich_media_item(item)

    return items

@router.get("/carousel/{shortcode}")
async def get_post_carousel_slides(
    shortcode: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve or probe all slide items for a carousel or video post on demand."""
    clean_code = shortcode.strip().replace("ig_", "")
    result = await db.execute(select(MediaItem).where(
        (MediaItem.shortcode == clean_code) | (MediaItem.post_id == shortcode) | (MediaItem.post_id == f"ig_{clean_code}")
    ))
    item = result.scalars().first()
    
    # 1. If item is saved on disk, enrich and return
    if item and item.is_saved:
        from backend.app.api.downloads import enrich_media_item
        enrich_media_item(item)
        if item.carousel_media and len(item.carousel_media) > 0:
            return {"shortcode": clean_code, "slides": item.carousel_media, "total": len(item.carousel_media)}
        elif item.local_file_path:
            ext = item.local_file_path.split('.')[-1].lower()
            is_v = ext in ['mp4', 'mov', 'webm'] or item.media_type == 'VIDEO'
            return {
                "shortcode": clean_code,
                "slides": [{
                    "index": 1,
                    "display_url": f"/api/v1/downloads/view/{item.post_id}?index=1",
                    "url": f"/api/v1/downloads/view/{item.post_id}?index=1",
                    "view_url": f"/api/v1/downloads/view/{item.post_id}?index=1",
                    "media_type": "VIDEO" if is_v else "IMAGE",
                    "thumbnail_url": f"/api/v1/downloads/view/{item.post_id}?index=1"
                }],
                "total": 1
            }
    
    # 2. If item already has cached carousel_media with multiple slides in DB, return it
    if item and item.carousel_media and isinstance(item.carousel_media, list) and len(item.carousel_media) > 1:
        return {"shortcode": clean_code, "slides": item.carousel_media, "total": len(item.carousel_media)}

    # 3. If item is a single video with cached video_url, return it immediately
    if item and item.media_type == "VIDEO" and item.video_url and (".mp4" in item.video_url or "http" in item.video_url):
        return {
            "shortcode": clean_code,
            "slides": [{
                "index": 1,
                "display_url": item.display_url or item.video_url,
                "url": item.video_url,
                "video_url": item.video_url,
                "media_type": "VIDEO",
                "thumbnail_url": item.thumbnail_url or item.display_url
            }],
            "total": 1
        }

    # 4. Probe Instagram on-demand for slide media
    from backend.app.models import UserSession
    from backend.app.services.downloader import MediaDownloader
    us_res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    us = us_res.scalars().first()
    cookie = us.session_cookie if us and us.session_cookie != "dummy_session_cookie" else None
    
    downloader = MediaDownloader()
    extracted = await downloader.extract_media_urls(
        shortcode=clean_code,
        display_url=item.display_url if item else None,
        video_url=item.video_url if item else None,
        media_type=item.media_type if item else None,
        session_cookie=cookie,
        allow_playwright=True,
        username=item.username if item else None
    )
    
    slides = []
    for idx, it in enumerate(extracted, 1):
        slides.append({
            "index": idx,
            "display_url": it["url"],
            "url": it["url"],
            "video_url": it["url"] if it["type"] == "VIDEO" else None,
            "media_type": it["type"],
            "thumbnail_url": it["url"]
        })
    
    # Cache to database record if item exists
    if item:
        if len(slides) > 1:
            item.carousel_media = slides
            item.media_type = "CAROUSEL"
        elif len(slides) == 1:
            single = slides[0]
            if single.get("media_type") == "VIDEO" or item.media_type == "VIDEO":
                item.media_type = "VIDEO"
                item.video_url = single["url"]
                single["media_type"] = "VIDEO"
        await db.commit()

    return {"shortcode": clean_code, "slides": slides, "total": len(slides)}
