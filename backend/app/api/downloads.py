import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import MediaItem, DownloadJob
from backend.app.schemas import MediaItemResponse, BulkDownloadRequest, DownloadJobResponse
from backend.app.services.downloader import downloader

router = APIRouter(prefix="/downloads", tags=["Downloads"])

async def process_bulk_download_job(job_id: str, post_ids: List[str], category_tag: str, db_session_factory):
    async with db_session_factory() as db:
        job = await db.get(DownloadJob, job_id)
        if not job:
            return
            
        job.status = "in_progress"
        await db.commit()

        completed = 0
        for post_id in post_ids:
            result = await db.execute(select(MediaItem).where(MediaItem.post_id == post_id))
            item = result.scalars().first()
            if item:
                dl_result = await downloader.download_media(
                    media_url=item.display_url,
                    username=item.username,
                    post_id=item.post_id,
                    category_tag=category_tag
                )
                if dl_result.get("success"):
                    item.is_saved = True
                    item.local_file_path = dl_result.get("file_path")
                    item.category_tag = category_tag
                    item.saved_at = datetime.datetime.utcnow()
                    completed += 1
                    job.completed_items = completed
                    await db.commit()
                    
        job.status = "completed"
        job.completed_at = datetime.datetime.utcnow()
        await db.commit()

@router.get("", response_model=List[MediaItemResponse])
async def list_downloaded_content(category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(MediaItem).where(MediaItem.is_saved == True)
    if category:
        stmt = stmt.where(MediaItem.category_tag == category)
    stmt = stmt.order_by(MediaItem.saved_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/single/{post_id}", response_model=MediaItemResponse)
async def download_single_post(post_id: str, category_tag: Optional[str] = "General", db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MediaItem).where(MediaItem.post_id == post_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Media post not found")

    dl_result = await downloader.download_media(
        media_url=item.display_url,
        username=item.username,
        post_id=item.post_id,
        category_tag=category_tag
    )

    if dl_result.get("success"):
        item.is_saved = True
        item.local_file_path = dl_result.get("file_path")
        item.category_tag = category_tag
        item.saved_at = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(item)
        return item
    else:
        raise HTTPException(status_code=500, detail=dl_result.get("error", "Download failed"))

@router.post("/bulk", response_model=DownloadJobResponse)
async def trigger_bulk_download(
    request: BulkDownloadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    job_id = str(uuid.uuid4())[:8]
    job = DownloadJob(
        id=job_id,
        status="queued",
        total_items=len(request.post_ids),
        completed_items=0
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from backend.app.database import AsyncSessionLocal
    background_tasks.add_task(
        process_bulk_download_job,
        job_id=job_id,
        post_ids=request.post_ids,
        category_tag=request.category_tag or "General",
        db_session_factory=AsyncSessionLocal
    )

    return job

@router.get("/jobs", response_model=List[DownloadJobResponse])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DownloadJob).order_by(DownloadJob.created_at.desc()).limit(20))
    return result.scalars().all()
