import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.config import settings
from backend.app.database import init_db
from backend.app.api.auth import router as auth_router
from backend.app.api.profiles import router as profiles_router
from backend.app.api.feed import router as feed_router
from backend.app.api.downloads import router as downloads_router
from backend.app.api.settings import router as settings_router
from backend.app.api.system import router as system_router

from backend.app.services.scraper import rate_tracker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite tables on startup
    await init_db()
    rate_tracker.reset()

    # Reset any leftover in_progress or queued jobs from previous crashed/restarted processes
    from sqlalchemy import text, select
    from backend.app.database import AsyncSessionLocal
    from backend.app.models import MediaItem
    from backend.app.services.scraper import extract_timestamp_from_shortcode

    async with AsyncSessionLocal() as db:
        await db.execute(text("UPDATE download_jobs SET status = 'failed' WHERE status IN ('in_progress', 'queued')"))
        
        # Ensure accurate Instagram post creation timestamps across all items
        res = await db.execute(select(MediaItem))
        all_items = res.scalars().all()
        any_updated = False
        for item in all_items:
            real_ts = extract_timestamp_from_shortcode(item.shortcode or item.post_id)
            if real_ts and (not item.taken_at or abs((item.taken_at - real_ts).total_seconds()) > 60):
                item.taken_at = real_ts
                any_updated = True
        if any_updated:
            await db.commit()

    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(profiles_router, prefix=settings.API_PREFIX)
app.include_router(feed_router, prefix=settings.API_PREFIX)
app.include_router(downloads_router, prefix=settings.API_PREFIX)
app.include_router(settings_router, prefix=settings.API_PREFIX)
app.include_router(system_router, prefix=settings.API_PREFIX)

@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": settings.VERSION}

import httpx
from fastapi import Response, Query, HTTPException

@app.get("/api/v1/proxy/image")
async def proxy_image(url: str = Query(...)):
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            res = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            })
            if res.status_code == 200:
                return Response(
                    content=res.content,
                    media_type=res.headers.get("content-type", "image/jpeg"),
                    headers={"Cache-Control": "public, max-age=86400, immutable"}
                )
        except Exception:
            pass
    raise HTTPException(status_code=404, detail="Failed to proxy image")

# Serve Frontend static assets if dist folder exists
dist_dir = settings.BASE_DIR / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
