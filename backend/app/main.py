import os
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, Query, HTTPException, Depends
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
from backend.app.services.crawler import feed_crawler

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

    # Start background auto-sync scheduler
    feed_crawler.start_scheduler()

    yield

    # Clean shutdown of scheduler and any running crawl
    feed_crawler.stop_scheduler()
    feed_crawler.stop_crawl()


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

from fastapi import Depends
from backend.app.models import AdminUser
from backend.app.auth_utils import get_current_admin

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(profiles_router, prefix=settings.API_PREFIX, dependencies=[Depends(get_current_admin)])
app.include_router(feed_router, prefix=settings.API_PREFIX, dependencies=[Depends(get_current_admin)])
app.include_router(downloads_router, prefix=settings.API_PREFIX, dependencies=[Depends(get_current_admin)])
app.include_router(settings_router, prefix=settings.API_PREFIX, dependencies=[Depends(get_current_admin)])
app.include_router(system_router, prefix=settings.API_PREFIX, dependencies=[Depends(get_current_admin)])

@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": settings.VERSION}

import httpx
ALLOWED_IMAGE_DOMAINS = (
    "cdninstagram.com",
    "fbcdn.net",
    "instagram.com",
    "threads.net",
    "facebook.com"
)

def _is_safe_image_proxy_url(url_str: str) -> bool:
    import urllib.parse
    import ipaddress
    import socket
    try:
        parsed = urllib.parse.urlparse(url_str)
        if parsed.scheme not in ("http", "https"):
            return False
        
        # Reject userinfo (e.g. http://user:pass@host)
        if parsed.username or parsed.password:
            return False

        # Reject non-standard ports
        if parsed.port and parsed.port not in (80, 443):
            return False

        hostname = (parsed.hostname or "").lower().strip()
        if not hostname:
            return False

        # Block localhost and literal IP addresses
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        except ValueError:
            pass

        if hostname in ("localhost", "127.0.0.1", "::1"):
            return False

        # Check domain allowlist
        if not any(hostname == d or hostname.endswith("." + d) for d in ALLOWED_IMAGE_DOMAINS):
            return False

        # Verify resolved IP addresses against private / loopback ranges (fail closed on DNS resolution failure)
        try:
            addr_info = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
            if not addr_info:
                return False
            for item in addr_info:
                ip_str = item[4][0]
                ip = ipaddress.ip_address(ip_str)
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                    return False
        except (socket.gaierror, socket.error, Exception):
            # If DNS resolution fails, reject the URL immediately (fail closed)
            return False

        return True
    except Exception:
        return False

@app.get("/api/v1/proxy/image")
async def proxy_image(
    request: Request,
    url: Optional[str] = Query(None),
    b64: Optional[str] = Query(None),
    current_admin: AdminUser = Depends(get_current_admin)
):
    import base64
    import html
    import hashlib
    import urllib.parse

    target_url = None

    # 1. Base64 encoded URL (safe against Nginx reverse proxy parameter decoding)
    if b64:
        try:
            padded = b64 + "=" * (-len(b64) % 4)
            target_url = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        except Exception:
            try:
                target_url = base64.b64decode(b64).decode("utf-8")
            except Exception:
                pass

    # 2. Raw query string reconstruction (if reverse proxy stripped encoding)
    if not target_url:
        if url and not url.startswith("http%3A") and not url.startswith("https%3A"):
            target_url = url
        else:
            raw_query = request.url.query
            if raw_query.startswith("url="):
                target_url = urllib.parse.unquote(raw_query[4:])
            elif "&url=" in raw_query:
                target_url = urllib.parse.unquote(raw_query.split("&url=", 1)[1])
            elif url:
                target_url = urllib.parse.unquote(url)

    if not target_url:
        raise HTTPException(status_code=400, detail="Missing image URL parameter")

    # Clean and unquote URL if needed
    if "%3A" in target_url or "%2F" in target_url:
        target_url = urllib.parse.unquote(target_url)

    target_url = html.unescape(target_url).replace("&amp;", "&").strip().strip('"').strip("'")

    # SSRF & Domain whitelist validation
    if not _is_safe_image_proxy_url(target_url):
        raise HTTPException(status_code=400, detail="Target host is not permitted by image proxy policy.")

    # Local disk cache lookup (cryptographic hash of full URL including query parameters)
    cache_key = hashlib.sha256(target_url.encode('utf-8')).hexdigest()
    cache_dir = settings.BASE_DIR / "storage" / "cache" / "images"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{cache_key}.jpg"

    if cache_file.exists() and cache_file.stat().st_size > 500:
        try:
            with open(cache_file, "rb") as f:
                content = f.read()
            return Response(
                content=content,
                media_type="image/jpeg",
                headers={
                    "Cache-Control": "public, max-age=604800, immutable",
                    "Cross-Origin-Resource-Policy": "cross-origin",
                    "Access-Control-Allow-Origin": "*",
                }
            )
        except Exception:
            pass

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=False, trust_env=False) as client:
        current_fetch_url = target_url
        max_redirects = 3
        res = None

        for _ in range(max_redirects + 1):
            if not _is_safe_image_proxy_url(current_fetch_url):
                raise HTTPException(status_code=400, detail="Redirect destination is not permitted by image proxy policy.")

            try:
                res = await client.get(
                    current_fetch_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                        "Referer": "https://www.instagram.com/",
                    }
                )
            except Exception:
                break

            if res.status_code in (301, 302, 303, 307, 308):
                location = res.headers.get("Location")
                if not location:
                    break
                current_fetch_url = urllib.parse.urljoin(current_fetch_url, location)
                continue

            if res.status_code == 200:
                # Save to disk cache for permanent local serving
                try:
                    with open(cache_file, "wb") as f:
                        f.write(res.content)
                except Exception:
                    pass

                return Response(
                    content=res.content,
                    media_type=res.headers.get("content-type", "image/jpeg"),
                    headers={
                        "Cache-Control": "public, max-age=604800, immutable",
                        "Cross-Origin-Resource-Policy": "cross-origin",
                        "Access-Control-Allow-Origin": "*",
                    }
                )
            else:
                break
    raise HTTPException(status_code=404, detail="Failed to proxy image")

# Serve Frontend static assets if dist folder exists
dist_dir = settings.BASE_DIR / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
