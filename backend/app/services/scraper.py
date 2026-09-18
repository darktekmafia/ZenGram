import asyncio
import random
import logging
import datetime
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger("zengram.scraper")

def extract_timestamp_from_shortcode(shortcode: Optional[str]) -> Optional[datetime.datetime]:
    """Decode Instagram snowflake timestamp from shortcode or numeric media ID."""
    if not shortcode:
        return None
    try:
        clean = shortcode.strip().replace("ig_", "").replace("story_", "")
        now_utc = datetime.datetime.utcnow()

        # 1. Numeric Media ID
        if clean.isdigit():
            media_id = int(clean)
            epoch_ms = 1314220021721
            timestamp_ms = (media_id >> 23) + epoch_ms
            dt = datetime.datetime.fromtimestamp(timestamp_ms / 1000.0, tz=datetime.timezone.utc).replace(tzinfo=None)
            if datetime.datetime(2010, 1, 1) <= dt <= now_utc + datetime.timedelta(days=1):
                return dt

        # 2. Instagram Base64 Shortcode (canonical length is 11 chars)
        candidate_codes = []
        if len(clean) >= 11:
            candidate_codes.append(clean[:11])
        candidate_codes.append(clean)
        if len(clean) >= 10:
            candidate_codes.append(clean[:10])

        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        for code in candidate_codes:
            if not all(c in alphabet for c in code):
                continue
            media_id = 0
            for char in code:
                media_id = media_id * 64 + alphabet.index(char)
            
            epoch_ms = 1314220021721
            timestamp_ms = (media_id >> 23) + epoch_ms
            try:
                dt = datetime.datetime.fromtimestamp(timestamp_ms / 1000.0, tz=datetime.timezone.utc).replace(tzinfo=None)
                if datetime.datetime(2010, 1, 1) <= dt <= now_utc + datetime.timedelta(days=1):
                    return dt
            except Exception:
                continue
    except Exception:
        pass
    return None

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

PLAYWRIGHT_CHROMIUM_ARGS = [
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

def parse_instagram_cookies(cookie_str: Optional[str]) -> Dict[str, str]:
    """Parse raw cookie string, header, or sessionid token into key-value pairs."""
    if not cookie_str or cookie_str == "dummy_session_cookie":
        return {}
    clean = cookie_str.strip().strip('"').strip("'")
    cookies = {}
    if "=" in clean:
        parts = clean.split(";")
        for p in parts:
            p = p.strip()
            if "=" in p:
                k, v = p.split("=", 1)
                cookies[k.strip()] = v.strip().strip('"')
    else:
        cookies["sessionid"] = clean

    if "sessionid" in cookies and cookies["sessionid"].startswith("sessionid="):
        cookies["sessionid"] = cookies["sessionid"].replace("sessionid=", "").strip()

    return cookies

def extract_user_id_from_cookies(cookies_dict: Dict[str, str], raw_cookie_str: Optional[str] = None) -> Optional[str]:
    """Extract numeric Instagram user ID from parsed cookies or raw string."""
    if "ds_user_id" in cookies_dict and cookies_dict["ds_user_id"].isdigit():
        return cookies_dict["ds_user_id"]
    sessionid = cookies_dict.get("sessionid", "")
    if sessionid:
        import urllib.parse
        decoded = urllib.parse.unquote(sessionid)
        candidate = decoded.split(":")[0].split("%3A")[0].strip()
        if candidate.isdigit() and len(candidate) >= 4:
            return candidate
    if raw_cookie_str:
        import re
        match = re.search(r'(\d{5,})', raw_cookie_str)
        if match:
            return match.group(1)
    return None

class InstagramScraperEngine:
    def __init__(self, session_cookie: Optional[str] = None):
        self.session_cookie = session_cookie
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://www.instagram.com/",
        }
        if session_cookie:
            cookies_dict = parse_instagram_cookies(session_cookie)
            user_id = extract_user_id_from_cookies(cookies_dict, session_cookie)
            cookie_parts = []
            if user_id:
                cookie_parts.append(f"ds_user_id={user_id}")
            if session_cookie:
                cookie_parts.append(f"sessionid={session_cookie.strip()}")
            for k, v in cookies_dict.items():
                if k not in ("ds_user_id", "sessionid"):
                    cookie_parts.append(f"{k}={v}")
            self.headers["Cookie"] = "; ".join(cookie_parts)

    async def _async_delay(self, min_sec: float = 1.5, max_sec: float = 3.5):
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)

    async def _fetch_via_playwright(self, username: str, limit: int = 0, progress_callback = None):
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=PLAYWRIGHT_CHROMIUM_ARGS
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    device_scale_factor=1
                )
                if self.session_cookie and self.session_cookie != "dummy_session_cookie":
                    cookies_dict = parse_instagram_cookies(self.session_cookie)
                    user_id = extract_user_id_from_cookies(cookies_dict, self.session_cookie)
                    playwright_cookies = []
                    if user_id:
                        playwright_cookies.append({
                            'name': 'ds_user_id',
                            'value': str(user_id),
                            'domain': '.instagram.com',
                            'path': '/'
                        })
                    if 'sessionid' not in cookies_dict:
                        playwright_cookies.append({
                            'name': 'sessionid',
                            'value': self.session_cookie.strip(),
                            'domain': '.instagram.com',
                            'path': '/'
                        })
                    for k, v in cookies_dict.items():
                        if k not in ('ds_user_id', 'sessionid'):
                            playwright_cookies.append({
                                'name': k,
                                'value': str(v),
                                'domain': '.instagram.com',
                                'path': '/'
                            })
                    await context.add_cookies(playwright_cookies)
                
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
                try:
                    og_img = await page.get_attribute('meta[property="og:image"]', 'content')
                    if og_img and ('fbcdn' in og_img or 'instagram' in og_img) and not og_img.endswith('.mp4'):
                        import html
                        profile_pic = html.unescape(og_img).replace('&amp;', '&').strip()
                except Exception:
                    pass

                if not profile_pic:
                    try:
                        profile_pic = await page.evaluate('''username => {
                            const target = username.toLowerCase();
                            const imgs = Array.from(document.querySelectorAll('img'));
                            
                            // 1. Exact match target username in alt attribute (e.g. alt="<username>'s profile picture")
                            for (const img of imgs) {
                                const alt = (img.getAttribute('alt') || '').toLowerCase();
                                const src = img.getAttribute('src') || '';
                                if (alt.includes(target) && (alt.includes('profile picture') || alt.includes('profile photo') || alt.includes('avatar'))) {
                                    if (src && !src.endsWith('.mp4') && (src.includes('fbcdn') || src.includes('instagram'))) return src;
                                }
                            }
                            
                            // 2. Main header profile image (> 40px width and height, ignoring sidebar navbar 24x24)
                            const headerImgs = Array.from(document.querySelectorAll('main header img, header [role="button"] img, main img'));
                            for (const img of headerImgs) {
                                const src = img.getAttribute('src') || '';
                                const rect = img.getBoundingClientRect();
                                if (rect.width >= 40 && rect.height >= 40 && src && !src.endsWith('.mp4') && (src.includes('fbcdn') || src.includes('instagram'))) {
                                    return src;
                                }
                            }
                            
                            // 3. Fallback any profile image URL containing -19/ with width >= 40px
                            for (const img of imgs) {
                                const src = img.getAttribute('src') || '';
                                const rect = img.getBoundingClientRect();
                                if (src.includes('-19/') && rect.width >= 40 && !src.endsWith('.mp4') && (src.includes('fbcdn') || src.includes('instagram'))) {
                                    return src;
                                }
                            }
                            return null;
                        }''', username)
                    except Exception as e:
                        logger.warning(f"Error extracting profile avatar for {username}: {e}")
                
                seen_codes = set()
                posts = []
                no_new_cycles = 0

                is_uncapped = (limit <= 0)
                effective_limit = 999999 if is_uncapped else limit
                max_scrolls = 600 if is_uncapped else max(60, (limit // 6) + 20)
                max_empty_cycles = 8 if is_uncapped else 6

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
                            await page.goto(page_url, wait_until="domcontentloaded", timeout=15000)
                            await page.wait_for_timeout(1200)
                            no_new_cycles = 0
                    except Exception:
                        pass

                    for i in range(max_scrolls):
                        batch = await page.evaluate(r'''() => {
                            const results = [];
                            const links = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]'));
                            for (const a of links) {
                                const href = a.getAttribute('href') || '';
                                const parts = href.replace(/^\/+|\/+$/g, '').split('/');
                                let shortcode = null;
                                let mediaType = 'IMAGE';
                                for (const key of ['reel', 'reels', 'tv', 'p']) {
                                    const idx = parts.indexOf(key);
                                    if (idx !== -1 && idx + 1 < parts.length) {
                                        shortcode = parts[idx + 1];
                                        if (['reel', 'reels', 'tv'].includes(key)) mediaType = 'VIDEO';
                                        break;
                                    }
                                }
                                if (!shortcode) continue;
                                
                                const img = a.querySelector('img');
                                let src = img ? (img.src || img.getAttribute('src')) : null;
                                if (!src && img && img.getAttribute('srcset')) {
                                    src = img.getAttribute('srcset').split(',').pop().trim().split(' ')[0];
                                }
                                const alt = img ? (img.getAttribute('alt') || '') : '';
                                
                                if (mediaType !== 'VIDEO') {
                                    const text = ((a.innerText || '') + ' ' + (a.innerHTML || '')).toLowerCase();
                                    const aria = Array.from(a.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label') || '').join(' ').toLowerCase();
                                    if (text.includes('carousel') || text.includes('sidecar') || text.includes('multiple') || aria.includes('carousel') || aria.includes('photos')) {
                                        mediaType = 'CAROUSEL';
                                    } else if (text.includes('video') || text.includes('reel') || text.includes('clip') || aria.includes('video') || aria.includes('reel')) {
                                        mediaType = 'VIDEO';
                                    }
                                }
                                
                                results.push({
                                    shortcode: shortcode,
                                    media_type: mediaType,
                                    display_url: src || ('https://www.instagram.com/p/' + shortcode + '/media/?size=l'),
                                    caption: alt || ('Media post ' + shortcode)
                                });
                            }
                            return results;
                        }''')

                        new_found_in_cycle = 0
                        for item in batch:
                            code = item['shortcode']
                            if code not in seen_codes:
                                seen_codes.add(code)
                                new_found_in_cycle += 1
                                posts.append({
                                    "post_id": f"ig_{code}",
                                    "shortcode": code,
                                    "username": username,
                                    "media_type": item['media_type'],
                                    "display_url": item['display_url'],
                                    "thumbnail_url": item['display_url'],
                                    "video_url": None,
                                    "caption": item['caption'],
                                    "likes_count": 0,
                                    "comments_count": 0,
                                    "taken_at": extract_timestamp_from_shortcode(code) or datetime.datetime.utcnow()
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

                        # Multi-action deep scroll: mouse wheel + page down + scrollHeight
                        await page.mouse.wheel(0, 3000)
                        await page.keyboard.press('PageDown')
                        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                        await page.wait_for_timeout(1400)

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
                            "username": user.get("username") or username,
                            "full_name": user.get("full_name") or username,
                            "profile_pic_url": user.get("profile_pic_url_hd") or user.get("profile_pic_url"),
                            "is_private": user.get("is_private", False),
                            "is_verified": user.get("is_verified", False),
                            "media_count": user.get("edge_owner_to_timeline_media", {}).get("count", 0),
                            "follower_count": user.get("edge_followed_by", {}).get("count", 0),
                            "following_count": user.get("edge_follow", {}).get("count", 0),
                            "bio": user.get("biography", "")
                        }
            except Exception as e:
                logger.warning(f"Error fetching web_profile_info for {username}: {e}")

        # 2. Fallback to Playwright headful/headless DOM scan
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

        api_posts = []
        # 1. Try web_profile_info API first
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

                    if all_edges:
                        max_slice = limit if limit > 0 else len(all_edges)
                        for edge in all_edges[:max_slice]:
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

                            shortcode = str(node.get("shortcode") or node.get("id"))
                            ts = node.get("taken_at_timestamp")
                            taken_dt = datetime.datetime.fromtimestamp(ts) if ts else extract_timestamp_from_shortcode(shortcode)

                            api_posts.append({
                                "post_id": str(node.get("id") or f"ig_{shortcode}"),
                                "shortcode": shortcode,
                                "username": username,
                                "media_type": media_type,
                                "display_url": node.get("display_url"),
                                "thumbnail_url": node.get("thumbnail_src") or node.get("display_url"),
                                "video_url": node.get("video_url") if node.get("is_video") else None,
                                "caption": caption,
                                "likes_count": node.get("edge_media_preview_like", {}).get("count", 0),
                                "comments_count": node.get("edge_media_to_comment", {}).get("count", 0),
                                "taken_at": taken_dt or datetime.datetime.utcnow(),
                            })
                        if limit > 0 and len(api_posts) >= limit:
                            return api_posts
            except Exception as e:
                logger.error(f"Error fetching posts for {username}: {e}")

        # 2. Playwright deep continuous scroll for full uncapped profile or larger limits
        try:
            _, playwright_posts = await self._fetch_via_playwright(username, limit=limit, progress_callback=progress_callback)
            if playwright_posts and len(playwright_posts) > 0:
                # Merge with api_posts
                existing_codes = {p["shortcode"] for p in playwright_posts}
                for p in api_posts:
                    if p["shortcode"] not in existing_codes:
                        playwright_posts.append(p)
                return playwright_posts
        except Exception as e:
            logger.warning(f"Playwright fallback scroll error for {username}: {e}")

        return api_posts

    async def get_logged_in_user_profile(self) -> Optional[Dict[str, Any]]:
        """Extract authenticated username, user_id, and profile picture from Instagram session cookies."""
        if not self.session_cookie or self.session_cookie == "dummy_session_cookie":
            return None
        
        cookies_dict = parse_instagram_cookies(self.session_cookie)
        user_id = extract_user_id_from_cookies(cookies_dict, self.session_cookie)

        # 1. Fast lightweight HTTP HTML extraction (works in headless LXC without Chromium/Playwright)
        try:
            import re
            import html
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=8.0) as client:
                resp = await client.get("https://www.instagram.com/")
                if resp.status_code == 200 and resp.text:
                    pic_matches = re.findall(r'\"profile_pic_url\"[\s:]+\"([^\"]+)\"', resp.text)
                    user_matches = re.findall(r'\"username\"[\s:]+\"([^\"]+)\"', resp.text)
                    
                    found_pic = None
                    if pic_matches:
                        raw_pic = pic_matches[0]
                        clean_pic = raw_pic.replace(r'\\u0026', '&').replace(r'\u0026', '&').replace(r'\\/', '/').replace(r'\/', '/').replace(r'\\u0025', '%').replace(r'\u0025', '%')
                        clean_pic = html.unescape(clean_pic).strip()
                        if clean_pic.startswith("http"):
                            found_pic = clean_pic
                            
                    found_user = user_matches[0] if user_matches else None
                    if found_user and found_user in ("feed", "explore", "reels", "direct", "stories"):
                        found_user = None

                    if found_pic or (found_user and found_user != "admin"):
                        logger.info(f"Direct HTTP discovered logged-in profile: user={found_user}, avatar={bool(found_pic)}")
                        return {
                            "username": found_user or "admin",
                            "profile_pic_url": found_pic,
                            "user_id": user_id
                        }
        except Exception as e:
            logger.warning(f"Direct HTTP profile extraction encountered error: {e}")
        
        # 2. Fallback to Playwright headful/headless DOM scan
        try:
            from playwright.async_api import async_playwright
            cookies_to_add = []
            for k, v in cookies_dict.items():
                cookies_to_add.append({
                    'name': k,
                    'value': str(v).strip('\"').strip('\''),
                    'domain': '.instagram.com',
                    'path': '/',
                    'secure': True
                })
            if 'sessionid' not in cookies_dict and self.session_cookie:
                cookies_to_add.append({
                    'name': 'sessionid',
                    'value': self.session_cookie.strip('\"').strip('\''),
                    'domain': '.instagram.com',
                    'path': '/',
                    'secure': True
                })
                
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True, args=PLAYWRIGHT_CHROMIUM_ARGS)
                context = await browser.new_context(
                    viewport={'width': 1280, 'height': 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
                )
                await context.add_cookies(cookies_to_add)
                page = await context.new_page()
                
                async def handle_route(route):
                    req_type = route.request.resource_type
                    if req_type in ['font', 'stylesheet', 'media']:
                        await route.abort()
                    else:
                        await route.continue_()
                await page.route('**/*', handle_route)
                
                try:
                    await page.goto('https://www.instagram.com/', wait_until='domcontentloaded', timeout=12000)
                    await page.wait_for_timeout(1500)
                except Exception as e:
                    logger.warning(f"Nav timeout when discovering session profile: {e}")
                
                user_data = await page.evaluate(r'''() => {
                    const navLinks = Array.from(document.querySelectorAll('a[role="link"], a[href]'));
                    for (const a of navLinks) {
                        const text = (a.innerText || '').toLowerCase();
                        const href = a.getAttribute('href') || '';
                        const img = a.querySelector('img');
                        const alt = img ? (img.getAttribute('alt') || '').toLowerCase() : '';
                        if (text.includes('profile') || alt.includes('profile picture') || alt.includes('profile photo')) {
                            const cleanHref = href.replace(/^\/+|\/+$/g, '');
                            if (cleanHref && !['explore', 'reels', 'direct', 'stories', 'accounts'].includes(cleanHref)) {
                                return {
                                    username: cleanHref,
                                    profile_pic_url: img ? img.src : null
                                };
                            }
                        }
                    }
                    const imgs = Array.from(document.querySelectorAll('img[alt*="profile picture"]'));
                    for (const img of imgs) {
                        const alt = img.getAttribute('alt') || '';
                        const match = alt.match(/^(.+?)'s profile picture/i);
                        if (match && match[1]) {
                            return {
                                username: match[1].trim(),
                                profile_pic_url: img.src
                            };
                        }
                    }
                    return null;
                }''')
                
                if user_data and user_data.get('username'):
                    try:
                        await page.goto(f"https://www.instagram.com/{user_data['username']}/", wait_until='domcontentloaded', timeout=10000)
                        await page.wait_for_timeout(500)
                        og_img = await page.get_attribute('meta[property="og:image"]', 'content')
                        if og_img and ('fbcdn' in og_img or 'instagram' in og_img) and not og_img.endswith('.mp4'):
                            import html
                            user_data['profile_pic_url'] = html.unescape(og_img).replace('&amp;', '&').strip()
                    except Exception as e:
                        logger.warning(f"OG img fetch error for logged in user: {e}")
                
                await browser.close()
                if user_data:
                    user_data['user_id'] = user_id
                return user_data
        except Exception as e:
            logger.error(f"Error extracting logged in user profile from cookies: {e}")
            return None

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
                browser = await p.chromium.launch(
                    headless=True,
                    args=PLAYWRIGHT_CHROMIUM_ARGS
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
                )
                if self.session_cookie and self.session_cookie != "dummy_session_cookie":
                    cookies_dict = parse_instagram_cookies(self.session_cookie)
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

        cookies_dict = parse_instagram_cookies(self.session_cookie)
        if not cookies_dict and not self.session_cookie:
            return []

        user_id = extract_user_id_from_cookies(cookies_dict, self.session_cookie)
        
        cookie_parts = []
        if user_id:
            cookie_parts.append(f"ds_user_id={user_id}")
        if self.session_cookie:
            cookie_parts.append(f"sessionid={self.session_cookie.strip()}")
        for k, v in cookies_dict.items():
            if k not in ("ds_user_id", "sessionid"):
                cookie_parts.append(f"{k}={v}")
        cookie_header = "; ".join(cookie_parts)

        followed = []

        # 1. Try fast direct HTTP API request with httpx first (with pagination)
        if user_id:
            try:
                next_max_id = None
                for _ in range(25):  # up to 5000 followed accounts
                    url = f"https://www.instagram.com/api/v1/friendships/{user_id}/following/?count=200"
                    if next_max_id:
                        url += f"&max_id={next_max_id}"
                    
                    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                        resp = await client.get(
                            url,
                            headers={
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                                "Accept": "*/*",
                                "Accept-Language": "en-US,en;q=0.9",
                                "X-IG-App-ID": "936619743392459",
                                "X-Requested-With": "XMLHttpRequest",
                                "Cookie": cookie_header,
                                "Referer": "https://www.instagram.com/",
                            }
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            users = data.get("users", [])
                            for u in users:
                                handle = u.get("username", "").strip().rstrip("/").lstrip("@")
                                if handle and not any(x["username"].lower() == handle.lower() for x in followed):
                                    followed.append({
                                        "username": handle,
                                        "ig_user_id": str(u.get("pk") or u.get("id")),
                                        "full_name": u.get("full_name") or handle,
                                        "profile_pic_url": u.get("profile_pic_url"),
                                        "is_unfollowed_track": False
                                    })
                            next_max_id = data.get("next_max_id")
                            if not next_max_id or not users:
                                break
                        else:
                            logger.warning(f"Direct following API returned status {resp.status_code}")
                            break
                if followed:
                    logger.info(f"Successfully fetched {len(followed)} followed accounts via direct API")
                    return followed
            except Exception as e:
                logger.warning(f"Direct httpx following API request failed, falling back to Playwright: {e}")

        # 2. Fallback to Playwright headless browser (with sandbox bypass args)
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=PLAYWRIGHT_CHROMIUM_ARGS
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
                )
                
                playwright_cookies = []
                if user_id:
                    playwright_cookies.append({
                        'name': 'ds_user_id',
                        'value': str(user_id),
                        'domain': '.instagram.com',
                        'path': '/'
                    })
                if self.session_cookie:
                    playwright_cookies.append({
                        'name': 'sessionid',
                        'value': self.session_cookie.strip(),
                        'domain': '.instagram.com',
                        'path': '/'
                    })
                for k, v in cookies_dict.items():
                    if k not in ('ds_user_id', 'sessionid'):
                        playwright_cookies.append({
                            'name': k,
                            'value': str(v),
                            'domain': '.instagram.com',
                            'path': '/'
                        })
                await context.add_cookies(playwright_cookies)
                
                page = await context.new_page()

                # Navigate to home first to initialize session and extract CSRF token
                try:
                    await page.goto("https://www.instagram.com/", wait_until="domcontentloaded", timeout=15000)
                    await page.wait_for_timeout(1500)
                    ctx_cookies = await context.cookies()
                    for c in ctx_cookies:
                        if c['name'] == 'ds_user_id' and c['value'].isdigit():
                            user_id = c['value']
                            break
                except Exception as e:
                    logger.warning(f"Error navigating to home for user ID discovery: {e}")

                if user_id:
                    next_max_id = None
                    for _ in range(25):
                        url = f"https://www.instagram.com/api/v1/friendships/{user_id}/following/?count=200"
                        if next_max_id:
                            url += f"&max_id={next_max_id}"
                        response = await page.request.get(url, headers={
                            'X-IG-App-ID': '936619743392459',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': 'https://www.instagram.com/'
                        })
                        if response.status == 200:
                            data = await response.json()
                            users = data.get("users", [])
                            for u in users:
                                handle = u.get("username", "").strip().rstrip("/").lstrip("@")
                                if handle and not any(x["username"].lower() == handle.lower() for x in followed):
                                    followed.append({
                                        "username": handle,
                                        "ig_user_id": str(u.get("pk") or u.get("id")),
                                        "full_name": u.get("full_name") or handle,
                                        "profile_pic_url": u.get("profile_pic_url"),
                                        "is_unfollowed_track": False
                                    })
                            next_max_id = data.get("next_max_id")
                            if not next_max_id or not users:
                                break
                        else:
                            break

                await browser.close()
        except Exception as e:
            logger.error(f"Playwright error fetching followed accounts: {e}")

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

