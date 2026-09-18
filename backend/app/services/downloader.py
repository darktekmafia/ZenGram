import os
import hashlib
import logging
import datetime
import asyncio
import httpx
from pathlib import Path
from typing import Optional, Dict, Any, List
from backend.app.config import settings

logger = logging.getLogger("zengram.downloader")

def _extract_via_instaloader(shortcode: str, session_cookie: Optional[str] = None) -> List[Dict[str, str]]:
    """Extract media items using Instaloader library."""
    try:
        import instaloader
        L = instaloader.Instaloader(
            user_agent="Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
            quiet=True,
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False
        )
        if session_cookie and session_cookie != "dummy_session_cookie":
            try:
                L.context.session.cookies.set('sessionid', session_cookie, domain='.instagram.com')
            except Exception:
                pass
        
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        items = []
        
        if post.typename == "GraphSidecar":
            for node in post.get_sidecar_nodes():
                if node.is_video:
                    items.append({"url": node.video_url, "type": "VIDEO"})
                else:
                    items.append({"url": node.display_url, "type": "IMAGE"})
        elif post.is_video:
            if post.video_url:
                items.append({"url": post.video_url, "type": "VIDEO"})
        else:
            img_url = post.url or post.display_url
            if img_url:
                items.append({"url": img_url, "type": "IMAGE"})
                
        return items
    except Exception as e:
        logger.warning(f"Instaloader extraction failed for {shortcode}: {e}")
        return []

def validate_media_file(filepath: Path) -> bool:
    """Validate that the file on disk is not corrupted and matches expected format magic bytes."""
    if not filepath.exists():
        return False
    size = filepath.stat().st_size
    if size < 1024:  # Minimum 1KB for any valid image/video
        return False
    try:
        with open(filepath, "rb") as f:
            header = f.read(64)
        if len(header) < 16:
            return False
        
        # Check if raw DASH fragment (starts with moof) - ALWAYS INVALID STANDALONE MP4
        if b"moof" in header[:16]:
            return False
            
        # MP4 validation: must have ftyp in first 32 bytes and be >= 25KB
        if b"ftyp" in header[:32]:
            return size >= 25000
            
        # JPEG validation
        if header.startswith(b"\xff\xd8\xff"):
            return True
            
        # PNG validation
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            return True
            
        # WebP validation
        if header.startswith(b"RIFF") and b"WEBP" in header[8:16]:
            return True
            
        return False
    except Exception:
        return False

class MediaDownloader:
    def __init__(self, download_dir: Optional[Path] = None):
        self.download_dir = Path(download_dir) if download_dir else settings.DOWNLOAD_DIR
        os.makedirs(self.download_dir, exist_ok=True)

    async def _extract_via_playwright(self, shortcode: str, session_cookie: Optional[str] = None, username: Optional[str] = None) -> List[Dict[str, str]]:
        """Fallback media extraction using Playwright browser DOM, metadata & structured JSON."""
        items = []
        seen_urls = set()
        clean_code = (shortcode or "").strip().replace("ig_", "")
        canonical_code = clean_code[:11] if len(clean_code) >= 11 else clean_code
        try:
            from playwright.async_api import async_playwright
            from backend.app.services.scraper import PLAYWRIGHT_CHROMIUM_ARGS, parse_instagram_cookies
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=PLAYWRIGHT_CHROMIUM_ARGS
                )
                try:
                    context = await browser.new_context(
                        viewport={"width": 1280, "height": 800},
                        user_agent="Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
                    )
                    if session_cookie and session_cookie != "dummy_session_cookie":
                        cookies_dict = parse_instagram_cookies(session_cookie)
                        for k, v in cookies_dict.items():
                            await context.add_cookies([{
                                'name': k,
                                'value': v,
                                'domain': '.instagram.com',
                                'path': '/'
                            }])
                        if 'sessionid' not in cookies_dict:
                            await context.add_cookies([{
                                'name': 'sessionid',
                                'value': session_cookie,
                                'domain': '.instagram.com',
                                'path': '/'
                            }])
                    page = await context.new_page()

                    urls_to_try = [
                        f"https://www.instagram.com/p/{canonical_code}/",
                        f"https://www.instagram.com/reel/{canonical_code}/"
                    ]

                    for target_url in urls_to_try:
                        try:
                            await page.goto(target_url, wait_until="domcontentloaded", timeout=12000)
                            await page.wait_for_timeout(1000)
                            break
                        except Exception:
                            continue

                    # 1. Check open graph og:video meta tags (highest quality progressive mp4)
                    og_video = await page.query_selector('meta[property="og:video"], meta[property="og:video:secure_url"]')
                    if og_video:
                        v_src = await og_video.get_attribute("content")
                        if v_src and "bytestart" not in v_src and v_src not in seen_urls:
                            seen_urls.add(v_src)
                            items.append({"url": v_src, "type": "VIDEO"})

                    # 2. Check JSON scripts on page for carousel slides & videos with structured JSON parsing
                    scripts = await page.query_selector_all('script[type="application/json"]')
                    import json
                    for s in scripts:
                        try:
                            txt = await s.inner_text()
                            if 'carousel_media' in txt or 'edge_sidecar_to_children' in txt:
                                data = json.loads(txt)
                                def extract_from_json(obj):
                                    if isinstance(obj, dict):
                                        if 'carousel_media' in obj and isinstance(obj['carousel_media'], list):
                                            for cm in obj['carousel_media']:
                                                if cm.get('video_versions'):
                                                    v_url = cm['video_versions'][0]['url']
                                                    if v_url not in seen_urls:
                                                        seen_urls.add(v_url)
                                                        items.append({'url': v_url, 'type': 'VIDEO'})
                                                elif cm.get('image_versions2', {}).get('candidates'):
                                                    img_url = cm['image_versions2']['candidates'][0]['url']
                                                    if img_url not in seen_urls:
                                                        seen_urls.add(img_url)
                                                        items.append({'url': img_url, 'type': 'IMAGE'})
                                        elif 'edge_sidecar_to_children' in obj:
                                            edges = obj['edge_sidecar_to_children'].get('edges', [])
                                            for edge in edges:
                                                node = edge.get('node', {})
                                                if node.get('is_video') and node.get('video_url'):
                                                    v_url = node['video_url']
                                                    if v_url not in seen_urls:
                                                        seen_urls.add(v_url)
                                                        items.append({'url': v_url, 'type': 'VIDEO'})
                                                elif node.get('display_url'):
                                                    img_url = node['display_url']
                                                    if img_url not in seen_urls:
                                                        seen_urls.add(img_url)
                                                        items.append({'url': img_url, 'type': 'IMAGE'})
                                        for v in obj.values():
                                            extract_from_json(v)
                                    elif isinstance(obj, list):
                                        for v in obj:
                                            extract_from_json(v)
                                extract_from_json(data)
                        except Exception:
                            pass

                    # 3. Check DOM <video> and <source> tags
                    if not items:
                        video_elems = await page.query_selector_all('article video[src], div[role="dialog"] video[src], main video[src], video[src]')
                        for v in video_elems:
                            v_src = await v.get_attribute('src')
                            if v_src and ('instagram' in v_src or 'fbcdn' in v_src or '.mp4' in v_src) and not v_src.startswith('blob:') and "bytestart" not in v_src and v_src not in seen_urls:
                                seen_urls.add(v_src)
                                items.append({"url": v_src, "type": "VIDEO"})

                    # 4. Check DOM images across all slides with Next button clicks if needed
                    if len(items) <= 1:
                        for step in range(12):
                            dom_imgs = await page.evaluate(r'''() => {
                                const results = [];
                                const container = document.querySelector('article') || document.querySelector('div[role="dialog"]') || document.querySelector('main') || document;
                                const imgs = Array.from(container.querySelectorAll('img'));
                                for (const img of imgs) {
                                    const rect = img.getBoundingClientRect();
                                    if (rect.width >= 150 && rect.height >= 150 && (img.src.includes('fbcdn') || img.src.includes('instagram')) && !img.src.includes('150x150') && !img.src.includes('profile_pic')) {
                                        results.push(img.src);
                                    }
                                }
                                return results;
                            }''')
                            for img_src in dom_imgs:
                                clean_stem = img_src.split('?')[0].split('/')[-1]
                                if clean_stem not in [x.split('?')[0].split('/')[-1] for x in seen_urls]:
                                    seen_urls.add(img_src)
                                    items.append({"url": img_src, "type": "IMAGE"})

                            next_btn = await page.query_selector('article button[aria-label="Next"], div[role="dialog"] button[aria-label="Next"], button[aria-label="Next"], button._afxw')
                            if next_btn and await next_btn.is_visible():
                                try:
                                    await next_btn.click()
                                    await page.wait_for_timeout(600)
                                except Exception:
                                    break
                            else:
                                break

                    # 5. If no video and no carousel items found yet, check og:image meta tag
                    if not items:
                        og_image = await page.query_selector('meta[property="og:image"]')
                        if og_image:
                            img_src = await og_image.get_attribute("content")
                            if img_src and img_src not in seen_urls:
                                seen_urls.add(img_src)
                                items.append({"url": img_src, "type": "IMAGE"})
                finally:
                    await browser.close()
        except Exception as e:
            logger.error(f"Playwright extraction failed for {canonical_code}: {e}")

        return items

    async def extract_media_urls(
        self,
        shortcode: str,
        display_url: Optional[str] = None,
        video_url: Optional[str] = None,
        media_type: Optional[str] = None,
        session_cookie: Optional[str] = None,
        allow_playwright: bool = False,
        username: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Extract all media items: [{'url': ..., 'type': 'VIDEO'|'IMAGE'}]"""
        # If media_type is single IMAGE (not CAROUSEL) and we have display_url, return immediately unless playwright/deep probe is requested
        if media_type == "IMAGE" and display_url and not allow_playwright:
            return [{"url": display_url, "type": "IMAGE"}]

        # If media_type is VIDEO and we already have a verified video URL (.mp4), return immediately
        if media_type == "VIDEO" and video_url and (".mp4" in video_url or "video" in video_url.lower()):
            return [{"url": video_url, "type": "VIDEO"}]

        items = []
        clean_code = (shortcode or "").strip().replace("ig_", "")
        canonical_code = clean_code[:11] if len(clean_code) >= 11 else clean_code

        # 1. Direct Web JSON probe (__a=1 / __d=dis) - ultra fast (<1s) without launching browsers
        if canonical_code:
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "X-IG-App-ID": "936619743392459",
                }
                if session_cookie and session_cookie != "dummy_session_cookie":
                    headers["Cookie"] = f"sessionid={session_cookie};"
                
                async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=headers) as probe_client:
                    r = await probe_client.get(f"https://www.instagram.com/p/{canonical_code}/?__a=1&__d=dis")
                    if r.status_code == 200:
                        try:
                            d = r.json()
                            entries = d.get("items") or [d.get("graphql", {}).get("shortcode_media")]
                            for entry in entries:
                                if not entry:
                                    continue
                                if "carousel_media" in entry:
                                    for cm in entry["carousel_media"]:
                                        if cm.get("video_versions"):
                                            items.append({"url": cm["video_versions"][0]["url"], "type": "VIDEO"})
                                        elif cm.get("image_versions2"):
                                            items.append({"url": cm["image_versions2"]["candidates"][0]["url"], "type": "IMAGE"})
                                elif "edge_sidecar_to_children" in entry:
                                    edges = entry["edge_sidecar_to_children"].get("edges", [])
                                    for edge in edges:
                                        node = edge.get("node", {})
                                        if node.get("is_video") and node.get("video_url"):
                                            items.append({"url": node["video_url"], "type": "VIDEO"})
                                        elif node.get("display_url"):
                                            items.append({"url": node["display_url"], "type": "IMAGE"})
                                elif entry.get("video_versions"):
                                    items.append({"url": entry["video_versions"][0]["url"], "type": "VIDEO"})
                                elif entry.get("video_url"):
                                    items.append({"url": entry["video_url"], "type": "VIDEO"})
                                elif entry.get("image_versions2"):
                                    items.append({"url": entry["image_versions2"]["candidates"][0]["url"], "type": "IMAGE"})
                        except Exception:
                            pass
            except Exception:
                pass

        # 2. Try Instaloader if direct probe had no items or if a VIDEO is missing its video stream
        needs_instaloader = not items or (media_type == "VIDEO" and not any(it["type"] == "VIDEO" for it in items))
        if needs_instaloader and canonical_code:
            try:
                instaloader_items = await asyncio.wait_for(
                    asyncio.to_thread(_extract_via_instaloader, canonical_code, session_cookie),
                    timeout=15.0
                )
                if instaloader_items:
                    items = instaloader_items
            except Exception as e:
                logger.warning(f"Instaloader extraction skipped/failed for {shortcode}: {e}")

        # 3. Fallback to Playwright if needed (for videos missing direct stream or multi-slide carousels)
        needs_playwright = allow_playwright and (
            not items or 
            (media_type == "VIDEO" and not any(it["type"] == "VIDEO" for it in items)) or
            (media_type == "CAROUSEL" and len(items) <= 1)
        )
        if needs_playwright and shortcode:
            try:
                playwright_items = await asyncio.wait_for(
                    self._extract_via_playwright(shortcode, session_cookie, username=username),
                    timeout=25.0
                )
                if playwright_items:
                    items = playwright_items
            except Exception as e:
                logger.warning(f"Playwright extraction timed out or failed for {shortcode}: {e}")

        # 4. Fallback to direct URLs if extraction produced nothing
        if not items:
            if video_url:
                items.append({"url": video_url, "type": "VIDEO"})
            elif display_url:
                items.append({"url": display_url, "type": "IMAGE"})

        return items

    async def download_media(
        self,
        media_url: str,
        username: str,
        post_id: str,
        category_tag: Optional[str] = "General",
        file_extension: Optional[str] = None
    ) -> Dict[str, Any]:
        """Download media file locally with streaming and integrity validation."""
        clean_tag = category_tag.strip() if category_tag else "General"
        clean_u = username.strip().lstrip("@")
        if not clean_tag or clean_tag.lstrip("@").lower() == clean_u.lower() or clean_tag == "Selected Items":
            subfolder_name = "General"
        else:
            subfolder_name = clean_tag

        user_dir = self.download_dir / subfolder_name / f"@{clean_u}"
        os.makedirs(user_dir, exist_ok=True)

        if not file_extension:
            file_extension = "mp4" if (".mp4" in media_url or "video" in media_url.lower()) else "jpg"

        filename = f"{post_id}.{file_extension}"
        target_path = user_dir / filename
        part_path = user_dir / f"{filename}.part"

        if target_path.exists() and validate_media_file(target_path):
            return {
                "success": True,
                "file_path": str(target_path),
                "is_duplicate": True,
                "file_size_bytes": target_path.stat().st_size
            }

        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            try:
                async with client.stream("GET", media_url) as response:
                    if response.status_code == 200:
                        with open(part_path, "wb") as f:
                            async for chunk in response.aiter_bytes(chunk_size=65536):
                                f.write(chunk)

                        with open(part_path, "rb") as f:
                            header = f.read(64)

                        is_mp4 = (b"ftyp" in header[:32]) and not (b"moof" in header[:16])
                        is_jpeg = header.startswith(b"\xff\xd8\xff")

                        if is_mp4 and not filename.endswith(".mp4"):
                            filename = f"{post_id}.mp4"
                            target_path = user_dir / filename
                        elif is_jpeg and filename.endswith(".mp4") and not is_mp4:
                            filename = f"{post_id}.jpg"
                            target_path = user_dir / filename

                        if validate_media_file(part_path):
                            if target_path.exists():
                                try:
                                    target_path.unlink()
                                except Exception:
                                    pass
                            part_path.rename(target_path)
                            return {
                                "success": True,
                                "file_path": str(target_path),
                                "is_duplicate": False,
                                "file_size_bytes": target_path.stat().st_size
                            }
                        else:
                            if part_path.exists():
                                part_path.unlink()
                            return {
                                "success": False,
                                "error": "Downloaded file failed format/integrity validation",
                                "file_path": None
                            }
                    else:
                        return {
                            "success": False,
                            "error": f"HTTP {response.status_code} when downloading media.",
                            "file_path": None
                        }
            except Exception as e:
                logger.error(f"Failed to download media for {post_id}: {e}")
                return {
                    "success": False,
                    "error": str(e),
                    "file_path": None
                }
            finally:
                if part_path.exists():
                    try:
                        part_path.unlink()
                    except Exception:
                        pass

    async def download_full_post(
        self,
        username: str,
        post_id: str,
        shortcode: str,
        display_url: str,
        video_url: Optional[str] = None,
        media_type: Optional[str] = None,
        session_cookie: Optional[str] = None,
        category_tag: Optional[str] = "General",
        allow_playwright: bool = False
    ) -> Dict[str, Any]:
        """Download ALL images and videos in a post with streaming and integrity validation."""
        clean_tag = category_tag.strip() if category_tag else "General"
        clean_u = username.strip().lstrip("@")
        if not clean_tag or clean_tag.lstrip("@").lower() == clean_u.lower() or clean_tag == "Selected Items":
            subfolder_name = "General"
        else:
            subfolder_name = clean_tag

        user_dir = self.download_dir / subfolder_name / f"@{clean_u}"
        os.makedirs(user_dir, exist_ok=True)

        extracted_items = await self.extract_media_urls(
            shortcode=shortcode,
            display_url=display_url,
            video_url=video_url,
            media_type=media_type,
            session_cookie=session_cookie,
            allow_playwright=allow_playwright,
            username=username
        )

        saved_files = []
        seen_hashes = set()

        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            for idx, item in enumerate(extracted_items, 1):
                url = item["url"]
                m_type = item["type"]
                ext = "mp4" if m_type == "VIDEO" or ".mp4" in url else "jpg"
                
                clean_shortcode = shortcode if shortcode else post_id
                filename = f"{clean_shortcode}_{idx}.{ext}" if len(extracted_items) > 1 else f"{clean_shortcode}.{ext}"
                target_path = user_dir / filename
                part_path = user_dir / f"{filename}.part"
                
                if target_path.exists() and validate_media_file(target_path):
                    saved_files.append(str(target_path))
                    continue

                try:
                    async with client.stream("GET", url) as res:
                        if res.status_code == 200:
                            hasher = hashlib.md5()
                            with open(part_path, "wb") as f:
                                async for chunk in res.aiter_bytes(chunk_size=65536):
                                    f.write(chunk)
                                    hasher.update(chunk)
                            
                            file_hash = hasher.hexdigest()
                            if file_hash in seen_hashes:
                                if part_path.exists():
                                    part_path.unlink()
                                continue
                            seen_hashes.add(file_hash)

                            # Validate magic bytes and format
                            with open(part_path, "rb") as f:
                                header = f.read(64)
                            
                            is_mp4 = (b"ftyp" in header[:32]) and not (b"moof" in header[:16])
                            is_jpeg = header.startswith(b"\xff\xd8\xff")

                            if is_mp4 and not filename.endswith(".mp4"):
                                filename = f"{clean_shortcode}_{idx}.mp4" if len(extracted_items) > 1 else f"{clean_shortcode}.mp4"
                                target_path = user_dir / filename
                            elif is_jpeg and filename.endswith(".mp4") and not is_mp4:
                                filename = f"{clean_shortcode}_{idx}.jpg" if len(extracted_items) > 1 else f"{clean_shortcode}.jpg"
                                target_path = user_dir / filename

                            if validate_media_file(part_path):
                                if target_path.exists():
                                    try:
                                        target_path.unlink()
                                    except Exception:
                                        pass
                                part_path.rename(target_path)
                                saved_files.append(str(target_path))
                            else:
                                logger.warning(f"Downloaded file failed validation for {shortcode} item {idx}, discarding.")
                                if part_path.exists():
                                    part_path.unlink()
                except Exception as e:
                    logger.error(f"Failed to download item {idx} for {shortcode}: {e}")
                finally:
                    if part_path.exists():
                        try:
                            part_path.unlink()
                        except Exception:
                            pass

        if saved_files:
            return {
                "success": True,
                "file_path": saved_files[0],
                "saved_files_count": len(saved_files),
                "all_file_paths": saved_files
            }
        else:
            return {
                "success": False,
                "error": f"Failed to download media for {shortcode or post_id}",
                "file_path": None
            }

downloader = MediaDownloader()

