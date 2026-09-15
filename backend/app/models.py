import datetime
from typing import Optional
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.database import Base

class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    session_cookie: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    last_validated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)

class WatchedProfile(Base):
    __tablename__ = "watched_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ig_user_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    profile_pic_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_unfollowed_track: Mapped[bool] = mapped_column(Boolean, default=True)  # True if user is NOT followed on IG
    auto_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sync_interval_hours: Mapped[int] = mapped_column(Integer, default=12)
    last_synced_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

class MediaItem(Base):
    __tablename__ = "media_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    shortcode: Mapped[str] = mapped_column(String(50), nullable=False)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), default="IMAGE")  # IMAGE, VIDEO, CAROUSEL
    display_url: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    video_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    taken_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    
    # Storage & Save state
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False)
    local_file_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    saved_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    category_tag: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    carousel_media: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # List of sub-media items if carousel

class DownloadJob(Base):
    __tablename__ = "download_jobs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), default="queued") # queued, in_progress, completed, failed
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    completed_items: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)

class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    download_directory: Mapped[str] = mapped_column(Text, nullable=False)
    auto_sync_interval_hours: Mapped[int] = mapped_column(Integer, default=6)
    rate_limit_delay_seconds: Mapped[float] = mapped_column(Float, default=3.0)
    max_posts_per_fetch: Mapped[int] = mapped_column(Integer, default=50)
