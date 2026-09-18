import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class AdminSetupRequest(BaseModel):
    username: str = "admin"
    password: str

class AdminLoginRequest(BaseModel):
    username: str = "admin"
    password: str
    remember_me: bool = True

class AdminChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class AdminSecuritySettingsRequest(BaseModel):
    auth_enabled: bool

class AuthStatusResponse(BaseModel):
    is_setup_required: bool
    is_authenticated: bool
    auth_enabled: bool
    admin_username: Optional[str] = None

class UserSessionBase(BaseModel):
    username: str

class UserSessionCreate(UserSessionBase):
    session_cookie: Optional[str] = None
    profile_pic_url: Optional[str] = None

class UserSessionResponse(UserSessionBase):
    id: int
    is_active: bool
    has_session_cookie: bool = False
    masked_cookie: Optional[str] = None
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

class PaginatedMediaResponse(BaseModel):
    items: List[MediaItemResponse]
    total_items: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool

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
    download_directory: Optional[str] = None
    auto_sync_interval_hours: Optional[int] = 6
    rate_limit_delay_seconds: Optional[float] = 3.0
    max_posts_per_fetch: Optional[int] = 50
    max_queue_limit: Optional[int] = 8
    max_download_workers: Optional[int] = 2
    pagination_mode: Optional[str] = "pages"
    page_size: Optional[int] = 36

    model_config = ConfigDict(from_attributes=True)

class RateLimitStatus(BaseModel):
    requests_made_last_hour: int
    max_requests_per_hour: int
    utilization_percentage: float
    is_critical: bool
    status_message: str

class AppStatsResponse(BaseModel):
    total_followed_accounts: int
    total_tracked_accounts: int
    total_all_profiles: int
    total_saved_posts: int
    download_directory: str
    download_dir_size_bytes: int
    download_dir_size_formatted: str
    download_dir_file_count: int
    disk_total_formatted: str
    disk_used_formatted: str
    disk_free_formatted: str
    disk_used_percentage: float

class SystemHardwareResponse(BaseModel):
    os_name: str
    kernel_version: str
    hostname: str
    is_container: bool
    container_type: str
    uptime: str
    cpu_model: str
    cpu_cores_logical: int
    cpu_cores_physical: int
    cpu_usage_percent: float
    load_average: List[float]
    ram_total_formatted: str
    ram_used_formatted: str
    ram_free_formatted: str
    ram_usage_percent: float
    swap_total_formatted: str
    swap_used_formatted: str
    swap_free_formatted: str
    swap_usage_percent: float
    disk_total_formatted: str
    disk_used_formatted: str
    disk_free_formatted: str
    disk_usage_percent: float
    process_memory_formatted: str
    python_version: str

class CommitSummary(BaseModel):
    hash: str
    message: str
    body: Optional[str] = None
    author: Optional[str] = None
    date: Optional[str] = None
    category: Optional[str] = "Update"

class VersionInfoResponse(BaseModel):
    version: str
    commit_hash: str
    commit_date: str
    commit_message: str
    branch: str
    is_git: bool
    update_available: bool
    latest_version: str
    latest_commit: Optional[str] = None
    behind_by: int = 0
    pending_commits: List[CommitSummary] = []
    distro_name: str
    hostname: str
    python_version: str
    update_status_text: str

class UpdateStatusResponse(BaseModel):
    status: str  # idle, in_progress, completed, restarting, failed
    progress_percent: int = 0
    current_stage: str = "Ready"
    logs: str = ""
    error: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

class BackupFileInfo(BaseModel):
    filename: str
    size_bytes: int
    size_formatted: str
    created_at: str
    created_at_relative: Optional[str] = None

class BackupListResponse(BaseModel):
    backups: List[BackupFileInfo]
    total_count: int
    total_size_formatted: str

