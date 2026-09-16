import asyncio
import random
import logging
import datetime
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger("instasave.scraper")

class RateLimitTracker:
    def __init__(self, max_per_hour: int = 150):
        self.max_per_hour = max_per_hour
        self.timestamps: List[datetime.datetime] = []

    def record_request(self):
        now = datetime.datetime.utcnow()
        self.timestamps.append(now)
        self._cleanup()

    def _cleanup(self):
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
        self.timestamps = [t for t in self.timestamps if t > cutoff]

    def reset(self):
        self.timestamps = []

    def get_status(self) -> Dict[str, Any]:
        self._cleanup()
        count = len(self.timestamps)
        utilization = (count / self.max_per_hour) * 100
        is_critical = utilization > 85
        return {
            "requests_made_last_hour": count,
            "max_requests_per_hour": self.max_per_hour,
            "utilization_percentage": round(utilization, 1),
            "is_critical": is_critical,
            "status_message": "Rate limits critical! Cooling down." if is_critical else "System operating within safe rate limits."
        }

rate_tracker = RateLimitTracker()

class InstagramScraperEngine:
    def __init__(self, session_cookie: Optional[str] = None):
        self.session_cookie = session_cookie
        self.headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.5",
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
        }
        if session_cookie:
            self.headers["Cookie"] = f"sessionid={session_cookie};"

    async def _async_delay(self, min_sec: float = 1.5, max_sec: float = 3.5):
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)

    async def _fetch_via_playwright(self, username: str, limit: int = 0, progress_callback = None):
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-extensions",
                        "--disable-default-apps",
                        "--mute-audio",
                        "--no-first-run",
                        "--disable-background-networking"
                    ]
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    device_scale_factor=1
                )
                if self.session_cookie and self.session_cookie != "dummy_session_cookie":
                    await context.add_cookies([{
                        'name': 'sessionid',
                        'value': self.session_cookie,
                        'domain': '.instagram.com',
                        'path': '/'
                    }])
                
                page = await context.new_page()

                # Block video decoding and webfonts during link scraping to drastically reduce CPU and RAM usage
                async def handle_route(route):
                    try:
                        req = route.request
                        if req.resource_type in ["media", "font"]:
                            await route.abort()
                        else:
                            await route.continue_()
                    except Exception:
                        pass

                await page.route("**/*", handle_route)

                try:
                    await page.goto(f"https://www.instagram.com/{username}/", wait_until="domcontentloaded", timeout=15000)
                    await page.wait_for_timeout(1000)
                except Exception as e:
                    logger.warning(f"Initial navigation for {username} reached timeout: {e}")
                
                profile_pic = None
                img = await page.query_selector('header img')
                if img:
                    profile_pic = await img.get_attribute('src')
                
                seen_codes = set()
                posts = []
                no_new_cycles = 0

                is_uncapped = (limit <= 0)
                effective_limit = 999999 if is_uncapped else limit
                max_scrolls = 600 if is_uncapped else max(50, limit // 3)
                max_empty_cycles = 6 if is_uncapped else 3

                urls_to_visit = [f"https://www.instagram.com/{username}/", f"https://www.instagram.com/{username}/reels/"]
                for page_url in urls_to_visit:
                    if len(posts) >= effective_limit:
                        break
                    try:
                        if page_url != f"https://www.instagram.com/{username}/":
                            if progress_callback:
                                try:
                                    if asyncio.iscoroutinefunction(progress_callback):
                                        await progress_callback(f"Switching to reels tab for @{username}...")
                                    else:
                                        progress_callback(f"Switching to reels tab for @{username}...")
                                except Exception:
                                    pass
                            await page.goto(page_url, wait_until="domcontentloaded", timeout=10000)
                            await page.wait_for_timeout(800)
                            no_new_cycles = 0
                    except Exception:
                        pass

                    for i in range(max_scrolls):
                        post_links = await page.query_selector_all('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]')
                        new_found_in_cycle = 0
                        for a in post_links:
                            href = await a.get_attribute('href')
                            if not href:
                                continue
                            
                            parts = [p for p in href.strip('/').split('/') if p]
                            shortcode = None
                            media_type = "IMAGE"

                            for key in ('reel', 'reels', 'tv', 'p'):
                                if key in parts:
                                    idx = parts.index(key)
                                    if idx + 1 < len(parts):
                                        shortcode = parts[idx + 1]
                                        if key in ('reel', 'reels', 'tv'):
                                            media_type = "VIDEO"
                                        break
                            
                            if not shortcode:
                                continue
                            
                            if shortcode in seen_codes:
                                continue
                            seen_codes.add(shortcode)
                            new_found_in_cycle += 1
                            
                            img_elem = await a.query_selector('img')
                            src = await img_elem.get_attribute('src') if img_elem else None
                            if not src and img_elem:
                                srcset = await img_elem.get_attribute('srcset')
                                if srcset:
                                    src = srcset.split(',')[-1].strip().split(' ')[0]
                            if not src:
                                vid_elem = await a.query_selector('video')
                                if vid_elem:
                                    src = await vid_elem.get_attribute('poster')
                            if not src:
                                src = f"https://www.instagram.com/p/{shortcode}/media/?size=l"
                            alt = await img_elem.get_attribute('alt') if img_elem else ''
                            
                            if media_type != "VIDEO":
                                try:
                                    detected_type = await a.evaluate("""node => {
                                        const text = (node.innerText || '') + ' ' + (node.innerHTML || '');
                                        const aria = Array.from(node.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label') || '').join(' ');
                                        const titles = Array.from(node.querySelectorAll('title')).map(el => el.textContent || '').join(' ');
                                        const imgAlt = Array.from(node.querySelectorAll('img')).map(el => el.getAttribute('alt') || '').join(' ');
                                        const combined = (text + ' ' + aria + ' ' + titles + ' ' + imgAlt).toLowerCase();
                                        if (combined.includes('carousel') || combined.includes('sidecar') || combined.includes('multiple') || combined.includes('photo carousel') || combined.includes('photos')) return 'CAROUSEL';
                                        if (combined.includes('video') || combined.includes('reel') || combined.includes('clip') || combined.includes('audio') || combined.includes('watch') || combined.includes('play')) return 'VIDEO';
                                        return null;
                                    }""")
                                    if detected_type:
                                        media_type = detected_type
                                except Exception:
                                    pass
                            
                            posts.append({
                                "post_id": f"ig_{shortcode}",
                                "shortcode": shortcode,
                                "username": username,
                                "media_type": media_type,
                                "display_url": src,
                                "thumbnail_url": src,
                                "video_url": None,
                                "caption": alt or f"Media post {shortcode}",
                                "likes_count": 0,
                                "comments_count": 0,
                                "taken_at": datetime.datetime.utcnow()
                            })

                        if new_found_in_cycle > 0 and progress_callback:
                            if len(posts) % 15 == 0 or len(posts) <= 30:
                                try:
                                    msg = f"Discovered {len(posts)} posts/reels so far (scroll cycle {i+1})..."
                                    if asyncio.iscoroutinefunction(progress_callback):
                                        await progress_callback(msg)
                                    else:
                                        progress_callback(msg)
                                except Exception:
                                    pass

                        if len(posts) >= effective_limit:
                            break

                        if new_found_in_cycle == 0:
                            no_new_cycles += 1
                            if no_new_cycles >= max_empty_cycles:
                                break
                        else:
                            no_new_cycles = 0

                        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                        await page.wait_for_timeout(800)

                await browser.close()
                return profile_pic, posts
        except Exception as e:
            logger.error(f"Playwright fetch error for {username}: {e}")
            return None, []

    async def get_user_profile(self, username_or_id: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile metadata for followed or unfollowed account."""
        rate_tracker.record_request()
        username = username_or_id.lstrip("@").strip()

        # 1. Try web_profile_info API first (fastest & lightweight)
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
        async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=10.0) as client:
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    user = data.get("data", {}).get("user", {})
                    if user:
                        return {
                            "ig_user_id": str(user.get("id")),
                            "username": user.get("username"),
                            "full_name": user.get("full_name"),
                            "profile_pic_url": user.get("profile_pic_url_hd") or user.get("profile_pic_url"),
                            "is_private": user.get("is_private", False),
                            "is_verified": user.get("is_verified", False),
                            "media_count": user.get("edge_owner_to_timeline_media", {}).get("count", 0),
                            "follower_count": user.get("edge_followed_by", {}).get("count", 0),
                            "following_count": user.get("edge_follow", {}).get("count", 0),
                            "bio": user.get("biography", "")
                        }
            except Exception as e:
                logger.warning(f"Failed web_profile_info for {username}: {e}")

        # 2. Fallback to Playwright browser scraper
        logger.info(f"Falling back to Playwright to scrape profile @{username}")
        profile_pic, _ = await self._fetch_via_playwright(username, limit=1)
        return {
            "ig_user_id": f"dummy_{username}",
            "username": username,
            "full_name": username,
            "profile_pic_url": profile_pic,
            "is_private": False,
            "is_verified": False,
            "media_count": 0,
            "follower_count": 0,
            "following_count": 0,
            "bio": ""
        }

    async def get_user_posts(self, username: str, limit: int = 50, progress_callback = None) -> List[Dict[str, Any]]:
        """Fetch timeline posts & reels for a specific user."""
        rate_tracker.record_request()
        await self._async_delay()

        # 1. Try web_profile_info API first (if limit is small, e.g. <= 30)
        if limit > 0 and limit <= 30:
            url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=10.0) as client:
                try:
                    response = await client.get(url)
                    if response.status_code == 200:
                        data = response.json()
                        user = data.get("data", {}).get("user", {})
                        
                        timeline_edges = user.get("edge_owner_to_timeline_media", {}).get("edges", [])
                        felix_edges = user.get("edge_felix_video_timeline", {}).get("edges", [])
                        combined_edges = user.get("edge_felix_combined_post_uploads", {}).get("edges", [])
                        
                        all_edges = []
                        seen_edge_ids = set()
                        for edge_list in [timeline_edges, felix_edges, combined_edges]:
                            for edge in edge_list:
                                node = edge.get("node", {})
                                node_id = node.get("id") or node.get("shortcode")
                                if node_id and node_id not in seen_edge_ids:
                                    seen_edge_ids.add(node_id)
                                    all_edges.append(edge)

                        if all_edges and len(all_edges) >= limit:
                            posts = []
                            for edge in all_edges[:limit]:
                                node = edge.get("node", {})
                                media_type = "IMAGE"
                                if node.get("is_video"):
                                    media_type = "VIDEO"
                                elif node.get("__typename") == "GraphSidecar":
                                    media_type = "CAROUSEL"

                                caption = ""
                                cap_edges = node.get("edge_media_to_caption", {}).get("edges", [])
                                if cap_edges:
                                    caption = cap_edges[0].get("node", {}).get("text", "")

                                posts.append({
                                    "post_id": str(node.get("id")),
                                    "shortcode": str(node.get("shortcode")),
                                    "username": username,
                                    "media_type": media_type,
                                    "display_url": node.get("display_url"),
                                    "thumbnail_url": node.get("thumbnail_src") or node.get("display_url"),
                                    "video_url": node.get("video_url") if node.get("is_video") else None,
                                    "caption": caption,
                                    "likes_count": node.get("edge_media_preview_like", {}).get("count", 0),
                                    "comments_count": node.get("edge_media_to_comment", {}).get("count", 0),
                                    "taken_at": datetime.datetime.fromtimestamp(node.get("taken_at_timestamp", 0)),
                                })
                            return posts
                except Exception as e:
                    logger.error(f"Error fetching posts for {username}: {e}")

        # 2. Playwright deep continuous scroll for full uncapped profile or larger limits
        _, posts = await self._fetch_via_playwright(username, limit=limit, progress_callback=progress_callback)
        return posts

    async def get_user_stories(self, username: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch active 24h Instagram Stories for a user."""
        rate_tracker.record_request()
        await self._async_delay()

        stories = []
        if not user_id or user_id.startswith("dummy") or user_id.startswith("ig_"):
            # Try fetching profile info to get numeric user id
            prof = await self.get_user_profile(username)
            if prof and prof.get("ig_user_id") and prof["ig_user_id"].isdigit():
                user_id = prof["ig_user_id"]

        if self.session_cookie and self.session_cookie != "dummy_session_cookie" and user_id and user_id.isdigit():
            # Try REST API for stories
            url = f"https://www.instagram.com/api/v1/feed/user/{user_id}/story/"
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=15.0) as client:
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        reel = data.get("reel", {}) or data.get("reels", {}).get(user_id, {})
                        items = reel.get("items", [])
                        for item in items:
                            pk = str(item.get("pk") or item.get("id"))
                            is_video = item.get("media_type") == 2 or "video_versions" in item
                            display_url = None
                            if "image_versions2" in item:
                                candidates = item["image_versions2"].get("candidates", [])
                                if candidates:
                                    display_url = candidates[0].get("url")
                            video_url = None
                            if is_video and "video_versions" in item:
                                v_versions = item.get("video_versions", [])
                                if v_versions:
                                    video_url = v_versions[0].get("url")
                            
                            cap_text = ""
                            if item.get("caption"):
                                cap_text = item["caption"].get("text", "")

                            stories.append({
                                "post_id": f"story_{pk}",
                                "shortcode": f"story_{pk}",
                                "username": username,
                                "media_type": "STORY",
                                "display_url": display_url or video_url,
                                "thumbnail_url": display_url,
                                "video_url": video_url,
                                "caption": cap_text or "Active 24h Instagram Story",
                                "likes_count": 0,
                                "comments_count": 0,
                                "taken_at": datetime.datetime.fromtimestamp(item.get("taken_at", 0)) if item.get("taken_at") else datetime.datetime.utcnow(),
                            })
                        if stories:
                            return stories
                except Exception as e:
                    logger.error(f"API story fetch error for {username}: {e}")

        # Playwright fallback for stories (only if logged in / valid story container present)
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                if self.session_cookie and self.session_cookie != "dummy_session_cookie":
                    await context.add_cookies([{
                        'name': 'sessionid',
                        'value': self.session_cookie,
                        'domain': '.instagram.com',
                        'path': '/'
                    }])
                page = await context.new_page()
                try:
                    await page.goto(f"https://www.instagram.com/stories/{username}/", wait_until="domcontentloaded", timeout=10000)
                    await page.wait_for_timeout(1000)
                except Exception:
                    pass
                
                current_url = page.url
                # If redirected away from stories page (e.g., to login or home), no active story is available
                if f"/stories/{username}" in current_url:
                    story_imgs = await page.query_selector_all('div[role="dialog"] img, section img[srcset]')
                    story_videos = await page.query_selector_all('div[role="dialog"] video source, section video')
                    
                    for idx, img in enumerate(story_imgs):
                        src = await img.get_attribute('src')
                        if src and ('instagram' in src or 'fbcdn' in src) and 'profile' not in src:
                            stories.append({
                                "post_id": f"story_{username}_{idx}_{int(datetime.datetime.utcnow().timestamp())}",
                                "shortcode": f"story_{username}_{idx}",
                                "username": username,
                                "media_type": "STORY",
                                "display_url": src,
                                "thumbnail_url": src,
                                "video_url": None,
                                "caption": "Active 24h Instagram Story",
                                "likes_count": 0,
                                "comments_count": 0,
                                "taken_at": datetime.datetime.utcnow()
                            })

                    for idx, v in enumerate(story_videos):
                        v_src = await v.get_attribute('src')
                        if v_src and ('instagram' in v_src or 'fbcdn' in v_src):
                            stories.append({
                                "post_id": f"story_v_{username}_{idx}_{int(datetime.datetime.utcnow().timestamp())}",
                                "shortcode": f"story_v_{username}_{idx}",
                                "username": username,
                                "media_type": "STORY",
                                "display_url": v_src,
                                "thumbnail_url": v_src,
                                "video_url": v_src,
                                "caption": "Active 24h Instagram Story Video",
                                "likes_count": 0,
                                "comments_count": 0,
                                "taken_at": datetime.datetime.utcnow()
                            })

                await browser.close()
        except Exception as e:
            logger.error(f"Playwright story fetch error for {username}: {e}")

        return stories


    async def get_followed_accounts(self, username: str = "") -> List[Dict[str, Any]]:
        """Fetch accounts followed by the logged-in user using session cookie."""
        rate_tracker.record_request()
        await self._async_delay()

        if not self.session_cookie or self.session_cookie == "dummy_session_cookie":
            return []

        followed = []
        try:
            # Extract numeric user_id from sessionid cookie
            raw_id = self.session_cookie.split("%3A")[0].split(":")[0]
            if not raw_id.isdigit():
                return []

            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context()
                await context.add_cookies([{
                    'name': 'sessionid',
                    'value': self.session_cookie,
                    'domain': '.instagram.com',
                    'path': '/'
                }])
                page = await context.new_page()

                # Fetch followed accounts up to 200
                url = f"https://www.instagram.com/api/v1/friendships/{raw_id}/following/?count=200"
                response = await page.request.get(url, headers={
                    'X-IG-App-ID': '936619743392459',
                    'X-Requested-With': 'XMLHttpRequest',
                })
                if response.status == 200:
                    data = await response.json()
                    users = data.get("users", [])
                    for u in users:
                        handle = u.get("username", "").strip().rstrip("/").lstrip("@")
                        if handle:
                            followed.append({
                                "username": handle,
                                "ig_user_id": str(u.get("pk") or u.get("id")),
                                "full_name": u.get("full_name") or handle,
                                "profile_pic_url": u.get("profile_pic_url"),
                                "is_unfollowed_track": False
                            })
                await browser.close()
        except Exception as e:
            logger.error(f"Error fetching followed accounts: {e}")

        return followed

    def _generate_demo_posts(self, username: str, limit: int = 10) -> List[Dict[str, Any]]:
        sample_photos = [
            ("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80", "IMAGE", "Sunset views on the coast 🌅 #travel #beach"),
            ("https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80", "IMAGE", "Delicious healthy bowl recipe! 🥑 #recipes #foodie"),
            ("https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80", "IMAGE", "10 Productivity Hacks for Linux Developers 💻 #lifehacks #fedora"),
            ("https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80", "IMAGE", "Fresh ingredients, easy dinner prep 🥗 #mealprep #cooking"),
            ("https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=800&q=80", "IMAGE", "Mountain trail hike adventures 🌲 #nature #outdoors"),
        ]
        demo_posts = []
        for i in range(min(limit, 10)):
            img_url, m_type, cap = sample_photos[i % len(sample_photos)]
            demo_posts.append({
                "post_id": f"demo_post_{username}_{i+100}",
                "shortcode": f"B9x_{username}_{i}",
                "username": username,
                "media_type": m_type,
                "display_url": img_url,
                "thumbnail_url": img_url,
                "video_url": None,
                "caption": cap,
                "likes_count": random.randint(150, 4800),
                "comments_count": random.randint(12, 340),
                "taken_at": datetime.datetime.utcnow() - datetime.timedelta(days=i),
            })
        return demo_posts

