import os
import uuid
import datetime
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from backend.app.database import get_db
from backend.app.models import MediaItem, DownloadJob
from backend.app.schemas import MediaItemResponse, BulkDownloadRequest, DownloadJobResponse, PaginatedMediaResponse
from backend.app.services.downloader import downloader
from backend.app.config import settings

logger = logging.getLogger("zengram.downloads")

router = APIRouter(prefix="/downloads", tags=["Downloads"])

import asyncio

# Global lock ensuring strictly ONE batch archive or bulk download job executes at any given time
batch_job_lock = asyncio.Lock()

def _add_log_entry(existing_logs: Optional[str], msg: str) -> str:
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    new_line = f"[{timestamp}] {msg}"
    if not existing_logs:
        return new_line
    lines = existing_logs.split("\n")
    lines.append(new_line)
    return "\n".join(lines[-200:])

async def run_queued_user_batch_archive(
    job_id: str,
    clean_username: str,
    target_category: str,
    limit: Optional[int],
    db_session_factory
):
    async with batch_job_lock:
        await process_user_batch_archive_job(
            job_id=job_id,
            clean_username=clean_username,
            target_category=target_category,
            limit=limit,
            db_session_factory=db_session_factory
        )

async def run_queued_bulk_download(
    job_id: str,
    post_ids: List[str],
    category_tag: str,
    db_session_factory
):
    async with batch_job_lock:
        await process_bulk_download_job(
            job_id=job_id,
            post_ids=post_ids,
            category_tag=category_tag,
            db_session_factory=db_session_factory
        )

async def process_bulk_download_job(job_id: str, post_ids: List[str], category_tag: str, db_session_factory):
    try:
        async with db_session_factory() as db:
            job = await db.get(DownloadJob, job_id)
            if not job:
                return
                
            job.status = "in_progress"
            job.current_stage = f"Starting downloads for {len(post_ids)} selected items..."
            job.logs = _add_log_entry(job.logs, f"Beginning parallel download for {len(post_ids)} items into category {category_tag}")
            await db.commit()

            from backend.app.models import UserSession
            us_res = await db.execute(select(UserSession).where(UserSession.is_active == True))
            us = us_res.scalars().first()
            cookie = us.session_cookie if us and us.session_cookie != "dummy_session_cookie" else None
            from backend.app.models import AppSettings
            s_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
            app_s = s_res.scalars().first()
            worker_count = app_s.max_download_workers if (app_s and app_s.max_download_workers is not None and app_s.max_download_workers >= 1) else 2

            import asyncio
            db_write_lock = asyncio.Lock()
            completed_count = 0
            queue = asyncio.Queue()
            for pid in post_ids:
                queue.put_nowait(pid)

            async def process_bulk_item(post_id: str):
                nonlocal completed_count
                async with db_session_factory() as read_db:
                    res = await read_db.execute(select(MediaItem).where(MediaItem.post_id == post_id))
                    item = res.scalars().first()
                    if not item:
                        return
                    username = item.username
                    shortcode = item.shortcode
                    display_url = item.display_url
                    video_url = item.video_url
                    media_type = item.media_type

                dl_result = await downloader.download_full_post(
                    username=username,
                    post_id=post_id,
                    shortcode=shortcode,
                    display_url=display_url,
                    video_url=video_url,
                    media_type=media_type,
                    session_cookie=cookie,
                    category_tag=category_tag,
                    allow_playwright=(media_type in ["VIDEO", "CAROUSEL"] and (not video_url or media_type == "CAROUSEL"))
                )

                async with db_write_lock:
                    async with db_session_factory() as write_db:
                        inner_job = await write_db.get(DownloadJob, job_id)
                        if dl_result.get("success"):
                            completed_count += 1
                            m_res = await write_db.execute(select(MediaItem).where(MediaItem.post_id == post_id))
                            m_item = m_res.scalars().first()
                            if m_item:
                                m_item.is_saved = True
                                m_item.local_file_path = dl_result.get("file_path")
                                m_item.category_tag = category_tag
                                m_item.saved_at = datetime.datetime.utcnow()

                            if inner_job:
                                inner_job.completed_items = completed_count
                                inner_job.current_stage = f"Archiving media ({completed_count}/{len(post_ids)})..."
                                f_name = os.path.basename(dl_result.get("file_path") or "")
                                inner_job.logs = _add_log_entry(inner_job.logs, f"Saved @{username} post {shortcode or post_id} -> {f_name}")
                        else:
                            if inner_job:
                                err_reason = dl_result.get("error") or "Extraction returned no valid media"
                                inner_job.logs = _add_log_entry(inner_job.logs, f"Skipped @{username} post {shortcode or post_id}: {err_reason}")
                        await write_db.commit()

            async def bulk_worker():
                while not queue.empty():
                    try:
                        pid = queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                    try:
                        await asyncio.wait_for(process_bulk_item(pid), timeout=120.0)
                    except asyncio.TimeoutError:
                        logger.warning(f"Bulk download item timed out for {pid}")
                        async with db_write_lock:
                            async with db_session_factory() as wdb:
                                j = await wdb.get(DownloadJob, job_id)
                                if j:
                                    j.logs = _add_log_entry(j.logs, f"Item timed out: {pid}")
                                    await wdb.commit()
                    except Exception as ex:
                        logger.error(f"Error downloading bulk item {pid}: {ex}")
                    finally:
                        queue.task_done()

            workers = [asyncio.create_task(bulk_worker()) for _ in range(worker_count)]
            await asyncio.gather(*workers)

            async with db_write_lock:
                async with db_session_factory() as final_db:
                    final_job = await final_db.get(DownloadJob, job_id)
                    if final_job:
                        final_job.status = "completed"
                        final_job.completed_at = datetime.datetime.utcnow()
                        final_job.current_stage = f"Archived {completed_count}/{len(post_ids)} items successfully."
                        final_job.logs = _add_log_entry(final_job.logs, f"Batch download finished. {completed_count} files saved.")
                        await final_db.commit()
    except Exception as e:
        err_msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
        async with db_session_factory() as err_db:
            err_job = await err_db.get(DownloadJob, job_id)
            if err_job:
                err_job.status = "failed"
                err_job.error_message = err_msg
                err_job.current_stage = f"Failed: {err_msg[:80]}"
                err_job.logs = _add_log_entry(err_job.logs, f"Error: {err_msg}")
                await err_db.commit()


async def process_user_batch_archive_job(
    job_id: str,
    clean_username: str,
    target_category: str,
    limit: Optional[int],
    db_session_factory
):
    import asyncio
    try:
        async with db_session_factory() as db:
            job = await db.get(DownloadJob, job_id)
            if not job:
                return

            if limit is None:
                from backend.app.models import AppSettings
                res_settings = await db.execute(select(AppSettings).where(AppSettings.id == 1))
                app_s = res_settings.scalars().first()
                effective_limit = app_s.max_posts_per_fetch if app_s and app_s.max_posts_per_fetch is not None else 200
            else:
                effective_limit = limit

            depth_desc = "Full Profile History (Uncapped)" if effective_limit <= 0 else f"up to {effective_limit} items"
            job.status = "in_progress"
            job.current_stage = f"Connecting to Instagram & fetching profile @{clean_username}..."
            job.logs = _add_log_entry(job.logs, f"Connecting to Instagram for profile @{clean_username} ({depth_desc})...")
            await db.commit()

            from backend.app.models import UserSession, WatchedProfile
            us_res = await db.execute(select(UserSession).where(UserSession.is_active == True))
            us = us_res.scalars().first()
            cookie = us.session_cookie if us and us.session_cookie != "dummy_session_cookie" else None

            wp_res = await db.execute(select(WatchedProfile).where(WatchedProfile.username == clean_username))
            wp = wp_res.scalars().first()

            from backend.app.services.scraper import InstagramScraperEngine
            scraper = InstagramScraperEngine(session_cookie=cookie)

            # 1. Scrape user posts / reels
            job.current_stage = f"Scraping timeline posts & reels for @{clean_username} ({depth_desc})..."
            job.logs = _add_log_entry(job.logs, f"Scraping timeline posts & reels ({depth_desc})...")
            await db.commit()

        # Progress callback for continuous deep scroll
        async def on_scraper_progress(log_msg: str):
            try:
                async with db_session_factory() as p_db:
                    p_job = await p_db.get(DownloadJob, job_id)
                    if p_job:
                        p_job.current_stage = log_msg
                        p_job.logs = _add_log_entry(p_job.logs, log_msg)
                        await p_db.commit()
            except Exception:
                pass

        # Scrape outside DB session
        posts_data = await scraper.get_user_posts(clean_username, limit=effective_limit, progress_callback=on_scraper_progress)

        async with db_session_factory() as db:
            job = await db.get(DownloadJob, job_id)
            if job:
                job.current_stage = f"Scraped {len(posts_data)} posts/reels. Checking active stories..."
                job.logs = _add_log_entry(job.logs, f"Discovered {len(posts_data)} timeline posts/reels. Checking active stories...")
                await db.commit()

        # 2. Scrape user stories
        stories_data = await scraper.get_user_stories(clean_username, wp.ig_user_id if wp else None)

        # 3. Ingest discovered items into DB
        total_discovered = len(posts_data) + len(stories_data)
        async with db_session_factory() as db:
            job = await db.get(DownloadJob, job_id)
            if job:
                job.current_stage = f"Discovered {total_discovered} media items. Registering in database..."
                job.logs = _add_log_entry(job.logs, f"Discovered {len(stories_data)} active stories ({total_discovered} total). Ingesting records...")
                await db.commit()

            seen_post_ids = set()
            for item in posts_data + stories_data:
                pid = str(item.get("post_id") or "").strip()
                if not pid or pid in seen_post_ids:
                    continue
                seen_post_ids.add(pid)

                result = await db.execute(select(MediaItem).where(MediaItem.post_id == pid))
                existing = result.scalars().first()
                if not existing:
                    raw_taken = item.get("taken_at")
                    dt_taken = None
                    if isinstance(raw_taken, (int, float)):
                        try:
                            dt_taken = datetime.datetime.fromtimestamp(raw_taken)
                        except Exception:
                            dt_taken = None
                    elif isinstance(raw_taken, datetime.datetime):
                        dt_taken = raw_taken

                    new_item = MediaItem(
                        post_id=pid,
                        shortcode=item.get("shortcode") or pid,
                        username=item.get("username") or clean_username,
                        media_type=item.get("media_type") or "IMAGE",
                        display_url=item.get("display_url") or "",
                        thumbnail_url=item.get("thumbnail_url"),
                        video_url=item.get("video_url"),
                        caption=item.get("caption"),
                        likes_count=item.get("likes_count", 0) or 0,
                        comments_count=item.get("comments_count", 0) or 0,
                        taken_at=dt_taken
                    )
                    db.add(new_item)
            await db.commit()

            # 4. Find all unsaved items for this user
            all_unsaved = await db.execute(
                select(MediaItem)
                .where(func.lower(MediaItem.username) == clean_username.lower())
                .where(MediaItem.is_saved == False)
            )
            unsaved_items = all_unsaved.scalars().all()
            post_ids = [item.post_id for item in unsaved_items]

            if not post_ids:
                job = await db.get(DownloadJob, job_id)
                if job:
                    job.status = "completed"
                    job.completed_at = datetime.datetime.utcnow()
                    job.total_items = 0
                    job.completed_items = 0
                    job.current_stage = f"All items for @{clean_username} are already downloaded."
                    job.logs = _add_log_entry(job.logs, "No new unsaved media found. Everything is already downloaded.")
                    await db.commit()
                return

            from backend.app.models import AppSettings
            s_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
            app_s = s_res.scalars().first()
            worker_count = app_s.max_download_workers if (app_s and app_s.max_download_workers is not None and app_s.max_download_workers >= 1) else 2

            job = await db.get(DownloadJob, job_id)
            if job:
                job.total_items = len(post_ids)
                job.current_stage = f"Starting downloads for {len(post_ids)} items ({worker_count} workers)..."
                job.logs = _add_log_entry(job.logs, f"Found {len(post_ids)} unsaved media files. Spawning {worker_count} parallel download workers...")
                await db.commit()

        # 5. Parallel download workers via asyncio.Queue
        db_write_lock = asyncio.Lock()
        completed_count = 0
        queue = asyncio.Queue()
        for pid in post_ids:
            queue.put_nowait(pid)

        async def process_archive_item(post_id: str):
            nonlocal completed_count
            async with db_session_factory() as read_db:
                res = await read_db.execute(select(MediaItem).where(MediaItem.post_id == post_id))
                item = res.scalars().first()
                if not item:
                    return
                username = item.username
                shortcode = item.shortcode
                display_url = item.display_url
                video_url = item.video_url
                media_type = item.media_type

            dl_result = await downloader.download_full_post(
                username=username,
                post_id=post_id,
                shortcode=shortcode,
                display_url=display_url,
                video_url=video_url,
                media_type=media_type,
                session_cookie=cookie,
                category_tag=target_category,
                allow_playwright=(media_type in ["VIDEO", "CAROUSEL"] and (not video_url or media_type == "CAROUSEL"))
            )

            async with db_write_lock:
                async with db_session_factory() as write_db:
                    inner_job = await write_db.get(DownloadJob, job_id)
                    if dl_result.get("success"):
                        completed_count += 1
                        m_res = await write_db.execute(select(MediaItem).where(MediaItem.post_id == post_id))
                        m_item = m_res.scalars().first()
                        if m_item:
                            m_item.is_saved = True
                            m_item.local_file_path = dl_result.get("file_path")
                            m_item.category_tag = target_category
                            m_item.saved_at = datetime.datetime.utcnow()

                        if inner_job:
                            inner_job.completed_items = completed_count
                            inner_job.current_stage = f"Archiving media ({completed_count}/{len(post_ids)})..."
                            f_name = os.path.basename(dl_result.get("file_path") or "")
                            inner_job.logs = _add_log_entry(inner_job.logs, f"Saved @{username} post {shortcode or post_id} -> {f_name}")
                    else:
                        if inner_job:
                            err_reason = dl_result.get("error") or "Extraction returned no valid media"
                            inner_job.logs = _add_log_entry(inner_job.logs, f"Skipped @{username} post {shortcode or post_id}: {err_reason}")
                    await write_db.commit()

        async def archive_worker():
            while not queue.empty():
                try:
                    pid = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                try:
                    await asyncio.wait_for(process_archive_item(pid), timeout=120.0)
                except asyncio.TimeoutError:
                    logger.warning(f"Batch archive item timed out for {pid}")
                    async with db_write_lock:
                        async with db_session_factory() as wdb:
                            j = await wdb.get(DownloadJob, job_id)
                            if j:
                                j.logs = _add_log_entry(j.logs, f"Item timed out: {pid}")
                                await wdb.commit()
                except Exception as ex:
                    logger.error(f"Error downloading batch archive item {pid}: {ex}")
                finally:
                    queue.task_done()

        workers = [asyncio.create_task(archive_worker()) for _ in range(worker_count)]
        await asyncio.gather(*workers)

        async with db_write_lock:
            async with db_session_factory() as final_db:
                final_job = await final_db.get(DownloadJob, job_id)
                if final_job:
                    final_job.status = "completed"
                    final_job.completed_at = datetime.datetime.utcnow()
                    final_job.current_stage = f"Archived {completed_count}/{len(post_ids)} items successfully."
                    final_job.logs = _add_log_entry(final_job.logs, f"Batch archive completed: {completed_count} files saved.")
                    await final_db.commit()

    except Exception as e:
        import traceback
        err_msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
        async with db_session_factory() as err_db:
            err_job = await err_db.get(DownloadJob, job_id)
            if err_job:
                err_job.status = "failed"
                err_job.error_message = err_msg
                err_job.current_stage = f"Failed: {err_msg[:80]}"
                err_job.logs = _add_log_entry(err_job.logs, f"Error: {err_msg}")
                await err_db.commit()

import re
import io
import zipfile
from fastapi.responses import FileResponse, Response

def resolve_or_relocate_path(item: MediaItem, base_dir: Optional[Path] = None) -> Optional[str]:
    """Dynamically resolve the disk file path for a media item, auto-repairing if directory moved."""
    if item.local_file_path and os.path.exists(item.local_file_path):
        return item.local_file_path

    # Try replacing /InstaSave/ with /ZenGram/
    if item.local_file_path:
        cand1 = item.local_file_path.replace("/InstaSave/", "/ZenGram/").replace("\\InstaSave\\", "\\ZenGram\\")
        if os.path.exists(cand1):
            item.local_file_path = cand1
            return cand1

    target_base = Path(base_dir) if base_dir else settings.DOWNLOAD_DIR
    if os.path.exists(target_base):
        code = (item.shortcode or item.post_id or "").replace("ig_", "")
        if code and item.username:
            user_patterns = [
                target_base / "General" / f"@{item.username}",
                target_base / "Uncategorized" / f"@{item.username}",
                target_base / f"@{item.username}",
            ]
            for u_dir in user_patterns:
                if u_dir.exists():
                    for f in os.listdir(u_dir):
                        if f.startswith(f"{code}.") or f.startswith(f"{code}_"):
                            resolved = str(u_dir / f)
                            item.local_file_path = resolved
                            return resolved
    return None

def enrich_media_item(item: MediaItem) -> MediaItem:
    """Scan disk for all downloaded slide files belonging to this post and enrich carousel_media."""
    actual_path = resolve_or_relocate_path(item)
    if item.is_saved and actual_path and os.path.exists(actual_path):
        parent_dir = os.path.dirname(actual_path)
        code = item.shortcode or item.post_id
        pattern = re.compile(rf'^{re.escape(code)}(?:_(\d+))?\.(jpg|jpeg|png|mp4|webm)$', re.IGNORECASE)
        matching_files = []
        if os.path.exists(parent_dir):
            for f in os.listdir(parent_dir):
                m = pattern.match(f)
                if m:
                    idx = int(m.group(1)) if m.group(1) else 1
                    matching_files.append((idx, f, os.path.join(parent_dir, f)))
            matching_files.sort(key=lambda x: x[0])

        if len(matching_files) > 0:
            c_media = []
            for idx, fname, fpath in matching_files:
                ext = fname.split('.')[-1].lower()
                is_vid = ext in ["mp4", "mov", "webm"]
                c_media.append({
                    "index": idx,
                    "filename": fname,
                    "local_file_path": fpath,
                    "media_type": "VIDEO" if is_vid else "IMAGE",
                    "view_url": f"/api/v1/downloads/view/{item.post_id}?index={idx}",
                    "download_url": f"/api/v1/downloads/file/{item.post_id}?index={idx}"
                })
            item.carousel_media = c_media
            if len(matching_files) > 1:
                item.media_type = "CAROUSEL"
    elif item.carousel_media and isinstance(item.carousel_media, list) and len(item.carousel_media) > 1:
        item.media_type = "CAROUSEL"
    return item

@router.get("", response_model=PaginatedMediaResponse)
async def list_downloaded_content(
    page: int = Query(1, ge=1),
    page_size: int = Query(36, ge=1, le=100),
    content_type: Optional[str] = Query(None),
    filter_user: Optional[str] = Query(None),
    query_search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    base_where = [MediaItem.is_saved == True]
    if content_type and content_type != "ALL":
        base_where.append(MediaItem.media_type == content_type)
    if filter_user:
        base_where.append(MediaItem.username.ilike(f"%{filter_user}%"))
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
    if category:
        base_where.append(MediaItem.category_tag == category)

    # Fast indexed total count
    count_stmt = select(func.count(MediaItem.id)).where(*base_where)
    total_count_res = await db.execute(count_stmt)
    total_items = total_count_res.scalar() or 0

    # Fast indexed slice query
    offset_val = (page - 1) * page_size
    stmt = (
        select(MediaItem)
        .where(*base_where)
        .order_by(MediaItem.saved_at.desc().nullslast(), MediaItem.id.desc())
        .offset(offset_val)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    # Only enrich the specific 36 items for this page
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

@router.get("/file/{post_id}")
async def download_file_to_client(
    post_id: str, 
    index: Optional[int] = Query(None),
    filename: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(MediaItem).where(
            (MediaItem.post_id == post_id) | 
            (MediaItem.shortcode == post_id) | 
            (MediaItem.post_id == f"ig_{post_id}")
        )
    )
    item = result.scalars().first()
    if not item or not item.is_saved or not item.local_file_path:
        raise HTTPException(status_code=404, detail="Saved media file record not found")
    
    target_file = item.local_file_path
    parent_dir = os.path.dirname(item.local_file_path)

    if filename:
        candidate = os.path.join(parent_dir, filename)
        if os.path.exists(candidate):
            target_file = candidate
    elif index is not None and index > 0:
        code = item.shortcode or item.post_id
        pattern = re.compile(rf'^{re.escape(code)}(?:_(\d+))?\.(jpg|jpeg|png|mp4|webm)$', re.IGNORECASE)
        matching_files = []
        if os.path.exists(parent_dir):
            for f in os.listdir(parent_dir):
                m = pattern.match(f)
                if m:
                    idx = int(m.group(1)) if m.group(1) else 1
                    matching_files.append((idx, f, os.path.join(parent_dir, f)))
            matching_files.sort(key=lambda x: x[0])
            if 0 < index <= len(matching_files):
                target_file = matching_files[index - 1][2]

    if not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail="File missing on server disk")
        
    return FileResponse(
        path=target_file,
        filename=os.path.basename(target_file),
        media_type="application/octet-stream"
    )

@router.get("/view/{post_id}")
async def view_file_inline(
    post_id: str,
    index: Optional[int] = Query(None),
    filename: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(MediaItem).where(
            (MediaItem.post_id == post_id) | 
            (MediaItem.shortcode == post_id) | 
            (MediaItem.post_id == f"ig_{post_id}")
        )
    )
    item = result.scalars().first()
    if not item or not item.local_file_path:
        raise HTTPException(status_code=404, detail="Saved media file record not found")

    target_file = item.local_file_path
    parent_dir = os.path.dirname(item.local_file_path)

    if filename:
        candidate = os.path.join(parent_dir, filename)
        if os.path.exists(candidate):
            target_file = candidate
    elif index is not None and index > 0:
        code = item.shortcode or item.post_id
        pattern = re.compile(rf'^{re.escape(code)}(?:_(\d+))?\.(jpg|jpeg|png|mp4|webm)$', re.IGNORECASE)
        matching_files = []
        if os.path.exists(parent_dir):
            for f in os.listdir(parent_dir):
                m = pattern.match(f)
                if m:
                    idx = int(m.group(1)) if m.group(1) else 1
                    matching_files.append((idx, f, os.path.join(parent_dir, f)))
            matching_files.sort(key=lambda x: x[0])
            if 0 < index <= len(matching_files):
                target_file = matching_files[index - 1][2]

    if not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail="File missing on server disk")

    ext = target_file.split('.')[-1].lower()
    try:
        with open(target_file, "rb") as f_check:
            header = f_check.read(32)
            if header.startswith(b"\xff\xd8\xff"):
                media_type = "image/jpeg"
            elif b"ftyp" in header:
                media_type = "video/mp4"
            elif header.startswith(b"\x89PNG\r\n\x1a\n"):
                media_type = "image/png"
            elif header.startswith(b"RIFF") and b"WEBP" in header:
                media_type = "image/webp"
            else:
                media_type = "video/mp4" if ext in ["mp4", "mov", "webm"] else f"image/{'jpeg' if ext in ['jpg', 'jpeg'] else ext}"
    except Exception:
        media_type = "video/mp4" if ext in ["mp4", "mov", "webm"] else f"image/{'jpeg' if ext in ['jpg', 'jpeg'] else ext}"
    return FileResponse(path=target_file, media_type=media_type)

@router.get("/zip/{post_id}")
async def download_post_as_zip(post_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaItem).where(
            (MediaItem.post_id == post_id) | 
            (MediaItem.shortcode == post_id) | 
            (MediaItem.post_id == f"ig_{post_id}")
        )
    )
    item = result.scalars().first()
    if not item or not item.is_saved or not item.local_file_path:
        raise HTTPException(status_code=404, detail="Saved media file record not found")

    parent_dir = os.path.dirname(item.local_file_path)
    code = item.shortcode or item.post_id
    pattern = re.compile(rf'^{re.escape(code)}(?:_(\d+))?\.(jpg|jpeg|png|mp4|webm)$', re.IGNORECASE)
    matching_files = []
    if os.path.exists(parent_dir):
        for f in os.listdir(parent_dir):
            m = pattern.match(f)
            if m:
                idx = int(m.group(1)) if m.group(1) else 1
                matching_files.append((idx, f, os.path.join(parent_dir, f)))
    matching_files.sort(key=lambda x: x[0])

    if not matching_files:
        raise HTTPException(status_code=404, detail="No files found on server disk for this post")

    if len(matching_files) == 1:
        fpath = matching_files[0][2]
        return FileResponse(path=fpath, filename=os.path.basename(fpath), media_type="application/octet-stream")

    zip_filename = f"{code}_all_media.zip"
    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for idx, fname, fpath in matching_files:
            zf.write(fpath, arcname=fname)
    mem_zip.seek(0)
    
    headers = {"Content-Disposition": f'attachment; filename="{zip_filename}"'}
    return Response(content=mem_zip.getvalue(), media_type="application/zip", headers=headers)

@router.delete("/file/{post_id}")
async def delete_downloaded_file(
    post_id: str, 
    index: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(MediaItem).where(
            (MediaItem.post_id == post_id) | 
            (MediaItem.shortcode == post_id) | 
            (MediaItem.post_id == f"ig_{post_id}")
        )
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Media record not found")

    if item.local_file_path and os.path.exists(item.local_file_path):
        parent_dir = os.path.dirname(item.local_file_path)
        code = item.shortcode or item.post_id
        pattern = re.compile(rf'^{re.escape(code)}(?:_(\d+))?\.(jpg|jpeg|png|mp4|webm)$', re.IGNORECASE)
        matching_files = []
        if os.path.exists(parent_dir):
            for f in os.listdir(parent_dir):
                m = pattern.match(f)
                if m:
                    idx = int(m.group(1)) if m.group(1) else 1
                    matching_files.append((idx, f, os.path.join(parent_dir, f)))
            matching_files.sort(key=lambda x: x[0])

        if index is not None and index > 0 and len(matching_files) > 1:
            if 0 < index <= len(matching_files):
                file_to_del = matching_files[index - 1][2]
                try:
                    os.remove(file_to_del)
                except Exception as e:
                    print(f"Error removing file {file_to_del}: {e}")
                
                remaining = [f for idx, fname, f in matching_files if idx != index]
                if remaining:
                    item.local_file_path = remaining[0]
                    await db.commit()
                    return {"message": f"Deleted slide file #{index} for post {post_id}."}

        for idx, fname, fpath in matching_files:
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception as e:
                    print(f"Error removing {fpath}: {e}")

    item.is_saved = False
    item.local_file_path = None
    item.saved_at = None
    item.category_tag = None
    item.carousel_media = None
    await db.commit()
    return {"message": f"Deleted local files for post {post_id} from server disk."}

@router.post("/single/{post_id}", response_model=MediaItemResponse)
async def download_single_post(post_id: str, category_tag: Optional[str] = "General", db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MediaItem).where(MediaItem.post_id == post_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Media post not found")

    from backend.app.models import UserSession
    us_res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    us = us_res.scalars().first()
    cookie = us.session_cookie if us and us.session_cookie != "dummy_session_cookie" else None

    dl_result = await downloader.download_full_post(
        username=item.username,
        post_id=item.post_id,
        shortcode=item.shortcode,
        display_url=item.display_url,
        video_url=item.video_url,
        media_type=item.media_type,
        session_cookie=cookie,
        category_tag=category_tag,
        allow_playwright=(item.media_type in ["VIDEO", "CAROUSEL"])
    )

    if dl_result.get("success"):
        item.is_saved = True
        item.local_file_path = dl_result.get("file_path")
        item.category_tag = category_tag
        item.saved_at = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(item)
        enrich_media_item(item)
        return item
    else:
        raise HTTPException(status_code=500, detail=dl_result.get("error", "Download failed"))

@router.post("/bulk", response_model=DownloadJobResponse)
async def trigger_bulk_download(
    request: BulkDownloadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    from backend.app.models import AppSettings
    res_s = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_s = res_s.scalars().first()
    max_queue_limit = app_s.max_queue_limit if app_s and app_s.max_queue_limit is not None else 8

    active_jobs_res = await db.execute(
        select(func.count()).select_from(DownloadJob).where(DownloadJob.status.in_(["queued", "in_progress"]))
    )
    active_jobs_count = active_jobs_res.scalar() or 0
    if active_jobs_count >= max_queue_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Batch queue is full ({active_jobs_count}/{max_queue_limit} active jobs). Please wait for current jobs to complete before queuing more."
        )

    target_category = request.category_tag
    if not target_category or target_category == "General":
        res = await db.execute(select(MediaItem.username).where(MediaItem.post_id.in_(request.post_ids)))
        usernames = set(res.scalars().all())
        if len(usernames) == 1 and list(usernames)[0]:
            target_category = list(usernames)[0]
        else:
            target_category = "Selected Items"

    is_busy = batch_job_lock.locked()
    initial_status = "queued" if is_busy else "in_progress"
    initial_stage = f"Waiting in batch queue ({len(request.post_ids)} items)..." if is_busy else f"Starting downloads for {len(request.post_ids)} items..."
    initial_log = f"Bulk job for {len(request.post_ids)} items added to queue. Position: Waiting for active job..." if is_busy else f"Beginning parallel download for {len(request.post_ids)} items"

    job_id = str(uuid.uuid4())[:8]
    job = DownloadJob(
        id=job_id,
        status=initial_status,
        category_tag=target_category,
        total_items=len(request.post_ids),
        completed_items=0,
        current_stage=initial_stage,
        logs=_add_log_entry(None, initial_log)
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from backend.app.database import AsyncSessionLocal
    background_tasks.add_task(
        run_queued_bulk_download,
        job_id=job_id,
        post_ids=request.post_ids,
        category_tag=target_category,
        db_session_factory=AsyncSessionLocal
    )

    return job

@router.post("/bulk-user/{username}", response_model=DownloadJobResponse)
async def trigger_bulk_download_for_user(
    username: str,
    background_tasks: BackgroundTasks,
    category_tag: Optional[str] = Query(None),
    limit: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    from backend.app.models import AppSettings
    res_s = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_s = res_s.scalars().first()
    max_queue_limit = app_s.max_queue_limit if app_s and app_s.max_queue_limit is not None else 8

    active_jobs_res = await db.execute(
        select(func.count()).select_from(DownloadJob).where(DownloadJob.status.in_(["queued", "in_progress"]))
    )
    active_jobs_count = active_jobs_res.scalar() or 0
    if active_jobs_count >= max_queue_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Batch queue is full ({active_jobs_count}/{max_queue_limit} active jobs). Please wait for current jobs to complete before queuing more."
        )

    clean_username = username.rstrip("/").lstrip("@").strip()
    target_category = category_tag.strip() if (category_tag and category_tag.strip() != "General") else clean_username
    
    depth_text = "Full Profile (Uncapped)" if (limit is not None and limit <= 0) else (f"{limit} posts" if limit else "configured depth")
    job_id = str(uuid.uuid4())[:8]

    is_busy = batch_job_lock.locked()
    initial_status = "queued" if is_busy else "in_progress"
    initial_stage = f"Waiting in batch queue (another job is currently executing)..." if is_busy else f"Discovering profile and media for @{clean_username} ({depth_text})..."
    initial_log = f"Batch archive for @{clean_username} ({depth_text}) added to queue. Position: Waiting in line..." if is_busy else f"Initiated batch archive for @{clean_username} ({depth_text})"

    job = DownloadJob(
        id=job_id,
        status=initial_status,
        category_tag=target_category,
        total_items=0,
        completed_items=0,
        current_stage=initial_stage,
        logs=_add_log_entry(None, initial_log)
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from backend.app.database import AsyncSessionLocal
    background_tasks.add_task(
        run_queued_user_batch_archive,
        job_id=job_id,
        clean_username=clean_username,
        target_category=target_category,
        limit=limit,
        db_session_factory=AsyncSessionLocal
    )

    return job

@router.get("/jobs", response_model=List[DownloadJobResponse])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DownloadJob).order_by(DownloadJob.created_at.desc()).limit(30))
    return result.scalars().all()

@router.get("/jobs/{job_id}", response_model=DownloadJobResponse)
async def get_single_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(DownloadJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.delete("/jobs/{job_id}")
async def cancel_or_delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(DownloadJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(job)
    await db.commit()
    return {"message": f"Job {job_id} deleted successfully."}

@router.delete("/jobs")
async def clear_completed_jobs(all_jobs: bool = Query(False), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import delete
    if all_jobs:
        await db.execute(delete(DownloadJob))
    else:
        await db.execute(delete(DownloadJob).where(DownloadJob.status.in_(["completed", "failed"])))
    await db.commit()
    return {"message": "Cleared download jobs from queue history."}

@router.post("/verify-disk")
async def verify_downloaded_files_on_disk(db: AsyncSession = Depends(get_db)):
    from pathlib import Path
    from backend.app.services.downloader import validate_media_file
    from backend.app.models import AppSettings

    # 1. Resolve current configured download directory
    sett_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = sett_res.scalars().first()
    target_download_dir = Path(app_settings.download_directory) if app_settings and app_settings.download_directory else settings.DOWNLOAD_DIR
    os.makedirs(target_download_dir, exist_ok=True)

    # 2. Index all files on disk in download directory by stem and shortcode prefix
    files_by_stem = {}
    cleaned_disk_fragments = 0
    try:
        for root, _, files in os.walk(target_download_dir):
            for f in files:
                full_p = Path(root) / f
                if f.endswith(".part"):
                    try:
                        full_p.unlink()
                        cleaned_disk_fragments += 1
                    except Exception:
                        pass
                    continue
                elif f.endswith(".mp4") and not validate_media_file(full_p):
                    try:
                        full_p.unlink()
                        cleaned_disk_fragments += 1
                    except Exception:
                        pass
                    continue

                stem = full_p.stem
                if stem not in files_by_stem:
                    files_by_stem[stem] = []
                files_by_stem[stem].append(full_p)
    except Exception as e:
        logger.warning(f"Error indexing disk files in {target_download_dir}: {e}")

    # 3. Scan all media items in the database
    stmt = select(MediaItem)
    result = await db.execute(stmt)
    all_items = result.scalars().all()

    verified_count = 0
    corrupt_count = 0
    missing_count = 0

    for item in all_items:
        found_file = None

        # Check existing path
        if item.local_file_path:
            f_path = Path(item.local_file_path)
            if f_path.exists() and f_path.stat().st_size > 0:
                found_file = f_path
            else:
                # Try replacing /InstaSave/ with /ZenGram/
                cand = item.local_file_path.replace("/InstaSave/", "/ZenGram/").replace("\\InstaSave\\", "\\ZenGram\\")
                cand_p = Path(cand)
                if cand_p.exists() and cand_p.stat().st_size > 0:
                    found_file = cand_p

        # If not found at stored path, search disk index by shortcode / post_id
        if not found_file:
            candidates = []
            if item.shortcode:
                candidates.append(item.shortcode)
                candidates.append(f"{item.shortcode}_1")
            if item.post_id:
                clean_pid = item.post_id.replace("ig_", "")
                candidates.append(clean_pid)
                candidates.append(f"{clean_pid}_1")

            for cand_stem in candidates:
                if cand_stem in files_by_stem and len(files_by_stem[cand_stem]) > 0:
                    found_file = files_by_stem[cand_stem][0]
                    break

            if not found_file and item.shortcode:
                # Check stems starting with shortcode_
                for stem_key, flist in files_by_stem.items():
                    if stem_key.startswith(f"{item.shortcode}_") or stem_key == item.shortcode:
                        found_file = flist[0]
                        break

        # Validate file
        if found_file:
            if not validate_media_file(found_file):
                try:
                    found_file.unlink()
                except Exception:
                    pass
                item.is_saved = False
                item.local_file_path = None
                item.saved_at = None
                corrupt_count += 1
            else:
                item.is_saved = True
                item.local_file_path = str(found_file)
                if not item.saved_at:
                    try:
                        item.saved_at = datetime.datetime.fromtimestamp(found_file.stat().st_mtime)
                    except Exception:
                        pass
                verified_count += 1
        else:
            if item.is_saved:
                item.is_saved = False
                item.local_file_path = None
                item.saved_at = None
                missing_count += 1

    await db.commit()
    return {
        "total_checked": len(all_items),
        "verified_valid": verified_count,
        "corrupt_removed": corrupt_count,
        "missing_reset": missing_count,
        "orphaned_fragments_cleaned": cleaned_disk_fragments,
        "message": f"Verified {verified_count} valid files on disk in {target_download_dir}. Cleaned {corrupt_count + cleaned_disk_fragments} corrupt/fragment files. Reset {missing_count} missing records."
    }

@router.post("/reset-records")
async def reset_all_download_records(db: AsyncSession = Depends(get_db)):
    stmt = select(MediaItem).where(MediaItem.is_saved == True)
    result = await db.execute(stmt)
    saved_items = result.scalars().all()
    
    reset_count = len(saved_items)
    for item in saved_items:
        item.is_saved = False
        item.local_file_path = None
        item.saved_at = None
        item.category_tag = None
        
    await db.commit()
    return {
        "reset_count": reset_count,
        "message": f"Successfully reset {reset_count} download records."
    }

