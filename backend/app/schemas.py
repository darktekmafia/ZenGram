import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class UserSessionBase(BaseModel):
    username: str

class UserSessionCreate(UserSessionBase):
    session_cookie: str

class UserSessionResponse(UserSessionBase):
    id: int
    is_active: bool
    session_cookie: Optional[str] = None
    profile_pic_url: Optional[str] = None
    created_at: datetime.datetime
    last_validated_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class WatchedProfileBase(BaseModel):
    username: str
    is_unfollowed_track: bool = True
    auto_sync_enabled: bool = True
    sync_interval_hours: int = 12

class WatchedProfileCreate(WatchedProfileBase):
    ig_user_id: Optional[str] = None
    full_name: Optional[str] = None
    profile_pic_url: Optional[str] = None

class WatchedProfileBulkCreate(BaseModel):
    usernames: List[str]
    is_unfollowed_track: bool = True

class WatchedProfileResponse(WatchedProfileBase):
    id: int
    ig_user_id: Optional[str] = None
    full_name: Optional[str] = None
    profile_pic_url: Optional[str] = None
    last_synced_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class WatchedProfileBulkResponse(BaseModel):
    added_count: int
    skipped_count: int
    total_count: int
    added_profiles: List[WatchedProfileResponse]

class MediaItemResponse(BaseModel):
    id: int
    post_id: str
    shortcode: str
    username: str
    media_type: str
    display_url: str
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    caption: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    taken_at: Optional[datetime.datetime] = None
    is_saved: bool = False
    local_file_path: Optional[str] = None
    saved_at: Optional[datetime.datetime] = None
    category_tag: Optional[str] = None
    carousel_media: Optional[List[dict]] = None

    model_config = ConfigDict(from_attributes=True)

class BulkDownloadRequest(BaseModel):
    post_ids: List[str]
    category_tag: Optional[str] = "General"

class DownloadJobResponse(BaseModel):
    id: str
    status: str
    category_tag: Optional[str] = None
    total_items: int
    completed_items: int
    current_stage: Optional[str] = None
    logs: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AppSettingsSchema(BaseModel):
    download_directory: str
    auto_sync_interval_hours: int = 6
    rate_limit_delay_seconds: float = 3.0
    max_posts_per_fetch: int = 50
    max_queue_limit: int = 8
    max_download_workers: int = 2

    model_config = ConfigDict(from_attributes=True)

class RateLimitStatus(BaseModel):
    requests_made_last_hour: int
    max_requests_per_hour: int
    utilization_percentage: float
    is_critical: bool
    status_message: str
