import asyncio
import datetime
import random
import logging
from typing import Optional, Dict, Any
from sqlalchemy import select, or_
from backend.app.database import AsyncSessionLocal
from backend.app.models import WatchedProfile, MediaItem, UserSession, AppSettings
from backend.app.services.scraper import InstagramScraperEngine

logger = logging.getLogger("zengram.crawler")

class FeedCrawlerService:
    def __init__(self):
        self._is_running: bool = False
        self._stop_requested: bool = False
        self._current_username: str = ""
        self._current_index: int = 0
        self._total_accounts: int = 0
        self._new_posts_saved: int = 0
        self._last_completed_at: Optional[datetime.datetime] = None
        self._last_error: Optional[str] = None
        self._status_message: str = "Idle"
        self._crawl_task: Optional[asyncio.Task] = None
        self._scheduler_task: Optional[asyncio.Task] = None

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self._is_running,
            "current_username": self._current_username,
            "current_index": self._current_index,
            "total_accounts": self._total_accounts,
            "new_posts_saved": self._new_posts_saved,
            "last_completed_at": self._last_completed_at.isoformat() if self._last_completed_at else None,
            "status_message": self._status_message,
            "last_error": self._last_error
        }

    async def start_crawl(self, max_posts_per_account: int = 15) -> bool:
        if self._is_running:
            logger.info("Feed crawl already in progress. Skipping trigger.")
            return False

        self._stop_requested = False
        self._is_running = True
        self._last_error = None
        self._new_posts_saved = 0
        self._status_message = "Starting background feed crawl..."
        self._crawl_task = asyncio.create_task(self._run_crawl(max_posts_per_account))
        return True

    def stop_crawl(self):
        if self._is_running:
            self._stop_requested = True
            self._status_message = "Stopping feed crawl..."
            logger.info("Feed crawl stop requested.")

    async def _run_crawl(self, max_posts_per_account: int):
        logger.info("Starting background feed crawl execution.")
        try:
            async with AsyncSessionLocal() as db:
                # 1. Fetch active session cookie
                res = await db.execute(select(UserSession).where(UserSession.is_active == True))
                session = res.scalars().first()
                cookie = session.session_cookie if session and session.session_cookie != "dummy_session_cookie" else None

                if not cookie:
                    self._status_message = "Feed crawl stopped: No active Instagram session cookie found."
                    self._last_error = "Missing session cookie"
                    self._is_running = False
                    return

                # 2. Fetch app settings for rate limit delay
                settings_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
                app_settings = settings_res.scalars().first()
                base_delay = app_settings.rate_limit_delay_seconds if app_settings else 3.0
                configured_max_posts = app_settings.max_posts_per_fetch if app_settings else max_posts_per_account
                fetch_limit = min(max_posts_per_account, configured_max_posts)

                # 3. Fetch followed / watched profiles enabled for sync
                prof_stmt = (
                    select(WatchedProfile)
                    .where(
                        or_(
                            WatchedProfile.auto_sync_enabled == True,
                            WatchedProfile.auto_sync_enabled.is_(None),
                            WatchedProfile.is_unfollowed_track == False
                        )
                    )
                    .order_by(WatchedProfile.last_synced_at.asc().nullsfirst())
                )
                prof_res = await db.execute(prof_stmt)
                profiles = prof_res.scalars().all()

                self._total_accounts = len(profiles)
                self._current_index = 0

                if self._total_accounts == 0:
                    self._status_message = "No accounts configured for auto-sync."
                    self._is_running = False
                    self._last_completed_at = datetime.datetime.utcnow()
                    return

                scraper = InstagramScraperEngine(session_cookie=cookie)

                for idx, profile in enumerate(profiles):
                    if self._stop_requested:
                        self._status_message = "Feed crawl cancelled by user."
                        break

                    self._current_index = idx + 1
                    self._current_username = profile.username
                    self._status_message = f"Syncing @{profile.username} ({self._current_index}/{self._total_accounts})"

                    try:
                        # Update avatar if placeholder
                        if not profile.profile_pic_url or "ui-avatars.com" in profile.profile_pic_url:
                            try:
                                p_info = await scraper.get_user_profile(profile.username)
                                if p_info and p_info.get("profile_pic_url"):
                                    profile.profile_pic_url = p_info["profile_pic_url"]
                            except Exception:
                                pass

                        # Fetch recent posts & stories
                        posts_data = await scraper.get_user_posts(profile.username, limit=fetch_limit)
                        stories_data = await scraper.get_user_stories(profile.username, profile.ig_user_id)
                        combined_items = posts_data + stories_data

                        for item in combined_items:
                            m_res = await db.execute(select(MediaItem).where(MediaItem.post_id == item["post_id"]))
                            existing = m_res.scalars().first()
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
                                self._new_posts_saved += 1
                            else:
                                if item.get("media_type") and item["media_type"] != "IMAGE":
                                    existing.media_type = item["media_type"]
                                if item.get("display_url"):
                                    existing.display_url = item["display_url"]
                                if item.get("thumbnail_url"):
                                    existing.thumbnail_url = item["thumbnail_url"]
                                if item.get("video_url"):
                                    existing.video_url = item["video_url"]

                        profile.last_synced_at = datetime.datetime.utcnow()
                        await db.commit()
                    except Exception as e:
                        logger.warning(f"Error crawling feed for @{profile.username}: {e}")

                    # Polite rate-limit delay with jitter
                    jitter = random.uniform(0.2, 0.8)
                    await asyncio.sleep(max(1.5, base_delay + jitter))

                self._last_completed_at = datetime.datetime.utcnow()
                self._status_message = f"Full sync complete! Checked {self._current_index} accounts, saved {self._new_posts_saved} new posts."
                logger.info(self._status_message)
        except Exception as ex:
            logger.error(f"Fatal error during feed crawl: {ex}")
            self._last_error = str(ex)
            self._status_message = f"Error: {ex}"
        finally:
            self._is_running = False
            self._current_username = ""

    async def _scheduler_loop(self):
        """Periodic background task that checks if it's time to run auto-sync."""
        logger.info("Feed Crawler periodic scheduler loop started.")
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                async with AsyncSessionLocal() as db:
                    settings_res = await db.execute(select(AppSettings).where(AppSettings.id == 1))
                    app_settings = settings_res.scalars().first()
                    interval_hours = app_settings.auto_sync_interval_hours if app_settings else 6

                    if interval_hours and interval_hours > 0:
                        now = datetime.datetime.utcnow()
                        should_sync = False
                        if not self._last_completed_at:
                            # If never synced or freshly started, give 2 minutes grace before auto-syncing
                            pass
                        elif (now - self._last_completed_at).total_seconds() >= interval_hours * 3600:
                            should_sync = True

                        if should_sync and not self._is_running:
                            logger.info(f"Triggering scheduled auto-sync (interval: {interval_hours}h)...")
                            await self.start_crawl()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in crawler scheduler loop: {e}")
                await asyncio.sleep(60)

    def start_scheduler(self):
        if not self._scheduler_task or self._scheduler_task.done():
            self._scheduler_task = asyncio.create_task(self._scheduler_loop())

    def stop_scheduler(self):
        if self._scheduler_task and not self._scheduler_task.done():
            self._scheduler_task.cancel()

# Global crawler instance
feed_crawler = FeedCrawlerService()
