from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from backend.app.database import get_db
from backend.app.models import MediaItem, WatchedProfile, UserSession
from backend.app.schemas import MediaItemResponse, PaginatedMediaResponse
from backend.app.services.scraper import InstagramScraperEngine

from backend.app.services.crawler import feed_crawler

router = APIRouter(prefix="/feed", tags=["Feed"])

@router.post("/sync")
async def trigger_full_sync(db: AsyncSession = Depends(get_db)):
    """Trigger a full sync of followed accounts and launch background feed crawler."""
    res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    session = res.scalars().first()
    cookie = session.session_cookie if session else None
    username = session.username if session else "admin"

    imported_accounts = 0
    if cookie and cookie != "dummy_session_cookie":
        try:
            scraper = InstagramScraperEngine(session_cookie=cookie)
            followed_list = await scraper.get_followed_accounts(username)
            for item in followed_list:
                acc_handle = item["username"]
                q = await db.execute(select(WatchedProfile).where(WatchedProfile.username == acc_handle))
                existing = q.scalars().first()
                if not existing:
                    new_p = WatchedProfile(
                        username=acc_handle,
                        ig_user_id=item.get("ig_user_id"),
                        full_name=item.get("full_name"),
                        profile_pic_url=item.get("profile_pic_url"),
                        is_unfollowed_track=False,
                        auto_sync_enabled=True
                    )
                    db.add(new_p)
                    imported_accounts += 1
                else:
                    existing.is_unfollowed_track = False
                    if item.get("full_name"):
                        existing.full_name = item.get("full_name")
                    if item.get("profile_pic_url"):
                        existing.profile_pic_url = item.get("profile_pic_url")
            await db.commit()
        except Exception as e:
            import logging
            logging.getLogger("zengram.feed").error(f"Error syncing followed accounts during full sync: {e}")

    # Launch non-blocking background crawler for media
    started = await feed_crawler.start_crawl()

    return {
        "status": "success",
        "message": f"Followed accounts synced: {imported_accounts}. Background feed crawler {'started' if started else 'already active'}.",
        "new_accounts_imported": imported_accounts,
        "crawler": feed_crawler.get_status()
    }

@router.get("/sync-status")
async def get_sync_status():
    """Get the current background feed crawler status."""
    return feed_crawler.get_status()

@router.post("/sync-stop")
async def stop_sync():
    """Request stopping the background feed crawler."""
    feed_crawler.stop_crawl()
    return {"status": "success", "message": "Stopping background sync", "crawler": feed_crawler.get_status()}



@router.get("", response_model=PaginatedMediaResponse)
async def get_latest_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(36, ge=1, le=100),
    content_type: Optional[str] = Query("ALL", pattern="^(ALL|IMAGE|VIDEO|CAROUSEL|STORY)$"),
    filter_user: Optional[str] = None,
    query_search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    base_where = []
    if content_type and content_type != "ALL":
        base_where.append(MediaItem.media_type == content_type)
        
    if filter_user:
        base_where.append(MediaItem.username.ilike(f"%{filter_user}%"))
    else:
        # Feed (Dashboard) should only show posts from followed accounts and NOT from tracked (unfollowed) accounts.
        followed_usernames = select(func.lower(WatchedProfile.username)).where(WatchedProfile.is_unfollowed_track == False)
        tracked_usernames = select(func.lower(WatchedProfile.username)).where(WatchedProfile.is_unfollowed_track == True)
        
        base_where.append(
            func.lower(MediaItem.username).in_(followed_usernames)
        )
        base_where.append(
            func.lower(MediaItem.username).notin_(tracked_usernames)
        )

    if query_search:
        term = query_search.strip()
        clean_term = term.lstrip('@')
        base_where.append(
            or_(
                MediaItem.username.ilike(f"%{clean_term}%"),
                MediaItem.caption.ilike(f"%{term}%"),
                MediaItem.caption.ilike(f"%{clean_term}%")
            )
        )

    # Fast indexed total count query
    count_stmt = select(func.count(MediaItem.id)).where(*base_where)
    total_count_res = await db.execute(count_stmt)
    total_items = total_count_res.scalar() or 0

    # Slice query
    offset_val = (page - 1) * page_size
    stmt = (
        select(MediaItem)
        .where(*base_where)
        .order_by(
            MediaItem.taken_at.desc().nullslast(),
            MediaItem.id.desc()
        )
        .offset(offset_val)
        .limit(page_size)
    )
    
    result = await db.execute(stmt)
    items = result.scalars().all()

    from backend.app.api.downloads import enrich_media_item
    for item in items:
        enrich_media_item(item)

    total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
    has_next = page < total_pages

    return PaginatedMediaResponse(
        items=items,
        total_items=total_items,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=has_next
    )

@router.get("/carousel/{shortcode}")
async def get_post_carousel_slides(
    shortcode: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve or probe all slide items for a carousel or video post on demand."""
    clean_code = shortcode.strip().replace("ig_", "")
    canonical_code = clean_code[:11] if len(clean_code) >= 11 else clean_code
    result = await db.execute(select(MediaItem).where(
        (MediaItem.shortcode == clean_code) | 
        (MediaItem.shortcode == canonical_code) |
        (MediaItem.post_id == shortcode) | 
        (MediaItem.post_id == f"ig_{clean_code}") |
        (MediaItem.post_id == f"ig_{canonical_code}")
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
    from backend.app.auth_utils import decrypt_secret
    us_res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    us = us_res.scalars().first()
    cookie = decrypt_secret(us.session_cookie) if us and us.session_cookie != "dummy_session_cookie" else None
    
    downloader = MediaDownloader()
    extracted = await downloader.extract_media_urls(
        shortcode=canonical_code,
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
