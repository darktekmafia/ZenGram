from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from backend.app.database import get_db
from backend.app.models import WatchedProfile, MediaItem, UserSession
from backend.app.schemas import (
    WatchedProfileCreate,
    WatchedProfileBulkCreate,
    WatchedProfileResponse,
    WatchedProfileBulkResponse,
    MediaItemResponse
)
from backend.app.services.scraper import InstagramScraperEngine
from sqlalchemy import func

router = APIRouter(prefix="/profiles", tags=["Profiles"])

@router.get("", response_model=List[WatchedProfileResponse])
async def list_watched_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchedProfile).order_by(WatchedProfile.created_at.desc()))
    return result.scalars().all()

@router.get("/followed", response_model=List[WatchedProfileResponse])
async def list_followed_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WatchedProfile)
        .where(WatchedProfile.is_unfollowed_track == False)
        .order_by(WatchedProfile.username.asc())
    )
    return result.scalars().all()

@router.post("/sync-following", response_model=List[WatchedProfileResponse])
async def sync_followed_accounts(db: AsyncSession = Depends(get_db)):
    # Fetch active user session
    res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    session = res.scalars().first()
    cookie = session.session_cookie if session else None
    username = session.username if session else "admin"

    scraper = InstagramScraperEngine(session_cookie=cookie)
    followed_list = await scraper.get_followed_accounts(username)

    imported_profiles = []
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
                is_unfollowed_track=False
            )
            db.add(new_p)
            await db.commit()
            await db.refresh(new_p)
            imported_profiles.append(new_p)
        else:
            existing.is_unfollowed_track = False
            if item.get("full_name"):
                existing.full_name = item.get("full_name")
            if item.get("profile_pic_url"):
                existing.profile_pic_url = item.get("profile_pic_url")
            await db.commit()
            await db.refresh(existing)
            imported_profiles.append(existing)

    return imported_profiles

async def get_active_scraper(db: AsyncSession) -> InstagramScraperEngine:
    res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    session = res.scalars().first()
    cookie = session.session_cookie if session and session.session_cookie != "dummy_session_cookie" else None
    return InstagramScraperEngine(session_cookie=cookie)

@router.post("", response_model=WatchedProfileResponse)
async def add_watched_profile(data: WatchedProfileCreate, db: AsyncSession = Depends(get_db)):
    username = data.username.rstrip("/").lstrip("@").strip()
    result = await db.execute(select(WatchedProfile).where(WatchedProfile.username == username))
    existing = result.scalars().first()
    if existing:
        return existing

    # Fetch profile metadata from Instagram scraper engine with active session cookie
    scraper = await get_active_scraper(db)
    profile_info = await scraper.get_user_profile(username)
    
    new_profile = WatchedProfile(
        username=username,
        ig_user_id=profile_info.get("ig_user_id") if profile_info else data.ig_user_id,
        full_name=profile_info.get("full_name") if profile_info else data.full_name,
        profile_pic_url=profile_info.get("profile_pic_url") if profile_info else f"https://ui-avatars.com/api/?name={username}&background=random",
        is_unfollowed_track=data.is_unfollowed_track,
        auto_sync_enabled=data.auto_sync_enabled,
        sync_interval_hours=data.sync_interval_hours
    )
    db.add(new_profile)
    await db.commit()
    await db.refresh(new_profile)
    return new_profile

@router.post("/bulk", response_model=WatchedProfileBulkResponse)
async def bulk_add_watched_profiles(data: WatchedProfileBulkCreate, db: AsyncSession = Depends(get_db)):
    added_profiles = []
    skipped_count = 0
    seen_in_batch = set()
    cleaned_usernames = []

    for raw in data.usernames:
        clean = raw.strip()
        if not clean:
            continue
        if "instagram.com/" in clean:
            clean = clean.split("instagram.com/")[-1].split("?")[0].split("/")[0]
        clean = clean.rstrip("/").lstrip("@").strip()
        if not clean or len(clean) > 100 or clean.lower() in seen_in_batch:
            continue

        seen_in_batch.add(clean.lower())

        # Check if already in database
        stmt = select(WatchedProfile).where(func.lower(WatchedProfile.username) == clean.lower())
        res = await db.execute(stmt)
        existing = res.scalars().first()
        if existing:
            skipped_count += 1
            continue

        cleaned_usernames.append(clean)

    if not cleaned_usernames:
        return {
            "added_count": 0,
            "skipped_count": skipped_count,
            "total_count": skipped_count,
            "added_profiles": []
        }

    import asyncio
    scraper = await get_active_scraper(db)
    semaphore = asyncio.Semaphore(4)

    async def fetch_meta_and_create(clean: str):
        async with semaphore:
            prof_info = None
            try:
                prof_info = await scraper.get_user_profile(clean)
            except Exception:
                pass

            ig_user_id = prof_info.get("ig_user_id") if prof_info else None
            full_name = prof_info.get("full_name") if prof_info else clean
            profile_pic = prof_info.get("profile_pic_url") if prof_info else f"https://ui-avatars.com/api/?name={clean}&background=random"

            return WatchedProfile(
                username=clean,
                ig_user_id=ig_user_id,
                full_name=full_name,
                profile_pic_url=profile_pic,
                is_unfollowed_track=data.is_unfollowed_track,
                auto_sync_enabled=True,
                sync_interval_hours=12
            )

    tasks = [fetch_meta_and_create(u) for u in cleaned_usernames]
    results = await asyncio.gather(*tasks)

    for p in results:
        db.add(p)
    await db.commit()
    for p in results:
        await db.refresh(p)
        added_profiles.append(p)

    return {
        "added_count": len(added_profiles),
        "skipped_count": skipped_count,
        "total_count": len(added_profiles) + skipped_count,
        "added_profiles": added_profiles
    }

@router.delete("/{username}")
async def remove_watched_profile(username: str, db: AsyncSession = Depends(get_db)):
    clean_username = username.rstrip("/").lstrip("@").strip()
    result = await db.execute(select(WatchedProfile).where(
        (WatchedProfile.username == clean_username) | (WatchedProfile.username == username)
    ))
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    await db.delete(profile)
    await db.commit()
    return {"message": f"Profile @{clean_username} removed from watched accounts"}

@router.get("/{username}/media", response_model=List[MediaItemResponse])
async def fetch_user_media(username: str, limit: int = Query(200, ge=1, le=500), db: AsyncSession = Depends(get_db)):
    username = username.rstrip("/").lstrip("@").strip()
    scraper = await get_active_scraper(db)

    # Update profile pic in DB if placeholder
    wp_res = await db.execute(select(WatchedProfile).where(WatchedProfile.username == username))
    wp = wp_res.scalars().first()
    if wp and (not wp.profile_pic_url or "ui-avatars.com" in wp.profile_pic_url or "unsplash.com" in wp.profile_pic_url):
        prof_info = await scraper.get_user_profile(username)
        if prof_info and prof_info.get("profile_pic_url"):
            wp.profile_pic_url = prof_info["profile_pic_url"]
            await db.commit()

    posts_data = await scraper.get_user_posts(username, limit=limit)
    stories_data = await scraper.get_user_stories(username, wp.ig_user_id if wp else None)
    
    combined_items = posts_data + stories_data
    
    for item in combined_items:
        # Check DB if already exists
        result = await db.execute(select(MediaItem).where(MediaItem.post_id == item["post_id"]))
        existing = result.scalars().first()
        if not existing:
            new_item = MediaItem(
                post_id=item["post_id"],
                shortcode=item["shortcode"],
                username=item["username"],
                media_type=item["media_type"],
                display_url=item["display_url"],
                thumbnail_url=item["thumbnail_url"],
                video_url=item.get("video_url"),
                caption=item.get("caption"),
                likes_count=item.get("likes_count", 0),
                comments_count=item.get("comments_count", 0),
                taken_at=item.get("taken_at")
            )
            db.add(new_item)
            await db.commit()
        else:
            if item.get("media_type") and item["media_type"] != "IMAGE":
                existing.media_type = item["media_type"]
            if item.get("display_url"):
                existing.display_url = item["display_url"]
            if item.get("thumbnail_url"):
                existing.thumbnail_url = item["thumbnail_url"]
            if item.get("video_url"):
                existing.video_url = item["video_url"]
            await db.commit()

    # Query all stored media items for this user
    all_media = await db.execute(
        select(MediaItem)
        .where(MediaItem.username.ilike(f"%{username}%"))
        .order_by(MediaItem.taken_at.desc().nullslast(), MediaItem.id.desc())
        .limit(limit)
    )
    items = all_media.scalars().all()
    from backend.app.api.downloads import enrich_media_item
    for it in items:
        enrich_media_item(it)
    return items
