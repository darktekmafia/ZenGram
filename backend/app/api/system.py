import os
import sys
import platform
import subprocess
import logging
import time
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import psutil

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import WatchedProfile, MediaItem, AppSettings
from backend.app.schemas import (
    VersionInfoResponse,
    AppStatsResponse,
    SystemHardwareResponse
)

logger = logging.getLogger("instasave.system")

router = APIRouter(prefix="/system", tags=["System"])


# -------------------------------------------------------------
# Helpers: Formatting & File Size Calculation
# -------------------------------------------------------------

def format_bytes(size: float) -> str:
    """Format bytes into readable units."""
    if size <= 0:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024.0
    return f"{size:.1f} PB"


# In-memory cache for download directory size calculation to keep API responses sub-5ms
_dir_size_cache: Dict[str, Any] = {
    "path": "",
    "timestamp": 0.0,
    "size_bytes": 0,
    "file_count": 0,
    "size_formatted": "0 B"
}

def get_dir_size_cached(path_str: str, force_refresh: bool = False) -> Dict[str, Any]:
    """Calculate directory disk size with a 60-second TTL cache."""
    global _dir_size_cache
    now = time.time()
    
    # Return cached data if valid and not forced
    if (
        not force_refresh
        and _dir_size_cache["path"] == path_str
        and (now - _dir_size_cache["timestamp"]) < 60.0
    ):
        return _dir_size_cache

    path = Path(path_str).expanduser()
    if not path.exists():
        _dir_size_cache = {
            "path": path_str,
            "timestamp": now,
            "size_bytes": 0,
            "file_count": 0,
            "size_formatted": "0 B"
        }
        return _dir_size_cache

    total_size = 0
    file_count = 0
    try:
        for root, dirs, files in os.walk(path):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    if not os.path.islink(fp):
                        total_size += os.path.getsize(fp)
                    file_count += 1
                except OSError:
                    pass
    except Exception as e:
        logger.warning(f"Error scanning download directory size: {e}")

    _dir_size_cache = {
        "path": path_str,
        "timestamp": now,
        "size_bytes": total_size,
        "file_count": file_count,
        "size_formatted": format_bytes(total_size)
    }
    return _dir_size_cache


def detect_container_environment() -> Tuple[bool, str]:
    """Detect whether InstaSave is executing inside an LXC container, Docker container, or Host."""
    try:
        if os.path.exists("/run/systemd/container"):
            with open("/run/systemd/container") as f:
                c = f.read().strip()
                if c:
                    return True, f"{c.upper()} Container"
        if os.path.exists("/.dockerenv"):
            return True, "Docker Container"
        if os.path.exists("/proc/1/environ"):
            with open("/proc/1/environ", "rb") as f:
                env = f.read().decode("utf-8", errors="ignore")
                if "container=lxc" in env:
                    return True, "LXC Container"
                elif "container=docker" in env:
                    return True, "Docker Container"
    except Exception:
        pass
    return False, "Bare Metal / VM Host"


def get_cpu_model_name() -> str:
    """Retrieve readable CPU brand string."""
    try:
        if os.path.exists("/proc/cpuinfo"):
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if "model name" in line:
                        return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor() or "Generic CPU"


def get_system_uptime_string() -> str:
    """Return human readable system uptime."""
    try:
        if os.path.exists("/proc/uptime"):
            with open("/proc/uptime") as f:
                uptime_seconds = float(f.readline().split()[0])
                days = int(uptime_seconds // 86400)
                hours = int((uptime_seconds % 86400) // 3600)
                minutes = int((uptime_seconds % 3600) // 60)
                if days > 0:
                    return f"{days}d {hours}h {minutes}m"
                elif hours > 0:
                    return f"{hours}h {minutes}m"
                else:
                    return f"{minutes}m"
        # Fallback to psutil boot time
        uptime_seconds = time.time() - psutil.boot_time()
        days = int(uptime_seconds // 86400)
        hours = int((uptime_seconds % 86400) // 3600)
        minutes = int((uptime_seconds % 3600) // 60)
        return f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m"
    except Exception:
        return "N/A"


# -------------------------------------------------------------
# Git and Distro Info
# -------------------------------------------------------------

def get_git_info() -> Dict[str, Any]:
    """Retrieve local Git repository commit and branch metadata."""
    info = {
        "is_git": False,
        "commit_hash": "6a30c6b",
        "commit_date": "2026-09-17",
        "commit_message": "Enhance feed filtering and avatar scraping",
        "branch": "main",
        "behind_by": 0,
        "latest_commit": "6a30c6b",
        "update_available": False,
        "latest_version": settings.VERSION
    }
    
    base_dir = settings.BASE_DIR
    git_dir = base_dir / ".git"
    
    if not git_dir.exists():
        return info
        
    try:
        info["is_git"] = True
        
        # Commit short hash
        res_hash = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2
        )
        if res_hash.returncode == 0:
            info["commit_hash"] = res_hash.stdout.strip()
            info["latest_commit"] = info["commit_hash"]

        # Commit date
        res_date = subprocess.run(
            ["git", "log", "-1", "--format=%cd", "--date=short"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2
        )
        if res_date.returncode == 0:
            info["commit_date"] = res_date.stdout.strip()

        # Commit subject
        res_msg = subprocess.run(
            ["git", "log", "-1", "--format=%s"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2
        )
        if res_msg.returncode == 0:
            info["commit_message"] = res_msg.stdout.strip()

        # Branch name
        res_br = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2
        )
        if res_br.returncode == 0:
            info["branch"] = res_br.stdout.strip()

    except Exception as e:
        logger.warning(f"Error reading git info: {e}")

    return info


def get_distro_info() -> str:
    """Detect readable Linux distribution name."""
    try:
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release") as f:
                lines = f.readlines()
                for line in lines:
                    if line.startswith("PRETTY_NAME="):
                        return line.split("=", 1)[1].strip().strip('"')
    except Exception:
        pass
    return f"{platform.system()} {platform.release()}"


# Global state for manual/simulated update testing
_simulated_update_state: Optional[Dict[str, Any]] = None


# -------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------

@router.get("/version", response_model=VersionInfoResponse)
async def get_version_info():
    """Get full system version, commit history, and update status."""
    git_info = get_git_info()
    distro = get_distro_info()
    hostname = platform.node()
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    
    if _simulated_update_state:
        return VersionInfoResponse(
            version=settings.VERSION,
            commit_hash=git_info["commit_hash"],
            commit_date=git_info["commit_date"],
            commit_message=git_info["commit_message"],
            branch=git_info["branch"],
            is_git=git_info["is_git"],
            update_available=True,
            latest_version=_simulated_update_state.get("latest_version", "1.1.0"),
            latest_commit=_simulated_update_state.get("latest_commit", "7f8b90a"),
            behind_by=_simulated_update_state.get("behind_by", 2),
            distro_name=distro,
            hostname=hostname,
            python_version=py_ver,
            update_status_text=_simulated_update_state.get("status_text", "Update Available (v1.1.0)")
        )

    return VersionInfoResponse(
        version=settings.VERSION,
        commit_hash=git_info["commit_hash"],
        commit_date=git_info["commit_date"],
        commit_message=git_info["commit_message"],
        branch=git_info["branch"],
        is_git=git_info["is_git"],
        update_available=git_info["update_available"],
        latest_version=git_info["latest_version"],
        latest_commit=git_info["latest_commit"],
        behind_by=git_info["behind_by"],
        distro_name=distro,
        hostname=hostname,
        python_version=py_ver,
        update_status_text="Up to date" if not git_info["update_available"] else f"Update available: {git_info['latest_version']}"
    )


@router.post("/check-update", response_model=VersionInfoResponse)
async def check_for_updates(simulate_update: Optional[bool] = Query(None)):
    """Fetch upstream git origin or release feeds to check for new updates."""
    global _simulated_update_state

    if simulate_update is True:
        _simulated_update_state = {
            "latest_version": "1.1.0",
            "latest_commit": "7f8b90a",
            "behind_by": 3,
            "status_text": "New Version Available: v1.1.0 (3 new commits)"
        }
    elif simulate_update is False:
        _simulated_update_state = None

    base_dir = settings.BASE_DIR
    git_info = get_git_info()
    
    if git_info["is_git"] and not _simulated_update_state:
        try:
            fetch_res = subprocess.run(
                ["git", "fetch", "--dry-run", "origin"],
                cwd=str(base_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5
            )
            status_res = subprocess.run(
                ["git", "rev-list", "--count", "HEAD..origin/main"],
                cwd=str(base_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=3
            )
            if status_res.returncode == 0 and status_res.stdout.strip().isdigit():
                behind = int(status_res.stdout.strip())
                git_info["behind_by"] = behind
                if behind > 0:
                    git_info["update_available"] = True
                    git_info["update_status_text"] = f"Update Available ({behind} new commits)"
        except Exception as e:
            logger.debug(f"Git remote check: {e}")

    return await get_version_info()


@router.get("/stats", response_model=AppStatsResponse)
async def get_application_stats(
    refresh: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve application counts, saved media totals, download folder usage, and disk storage stats."""
    # Count followed accounts
    res_followed = await db.execute(
        select(func.count(WatchedProfile.id)).where(WatchedProfile.is_unfollowed_track == False)
    )
    total_followed = res_followed.scalar() or 0

    # Count custom tracked accounts
    res_tracked = await db.execute(
        select(func.count(WatchedProfile.id)).where(WatchedProfile.is_unfollowed_track == True)
    )
    total_tracked = res_tracked.scalar() or 0

    # Count total watched profiles
    res_all_profiles = await db.execute(select(func.count(WatchedProfile.id)))
    total_all_profiles = res_all_profiles.scalar() or 0

    # Count total saved posts
    res_saved = await db.execute(
        select(func.count(MediaItem.id)).where(MediaItem.is_saved == True)
    )
    total_saved_posts = res_saved.scalar() or 0

    # Get active download directory
    res_app_settings = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = res_app_settings.scalars().first()
    dl_path = app_settings.download_directory if app_settings else str(settings.DOWNLOAD_DIR)

    # Calculate download directory size and file count (cached)
    dir_info = get_dir_size_cached(dl_path, force_refresh=refresh)

    # Disk storage usage of download volume
    disk_target = dl_path if os.path.exists(dl_path) else "/"
    try:
        disk_usage = shutil.disk_usage(disk_target)
        disk_total_fmt = format_bytes(disk_usage.total)
        disk_used_fmt = format_bytes(disk_usage.used)
        disk_free_fmt = format_bytes(disk_usage.free)
        disk_used_pct = round((disk_usage.used / disk_usage.total) * 100, 1) if disk_usage.total > 0 else 0.0
    except Exception:
        disk_total_fmt = "N/A"
        disk_used_fmt = "N/A"
        disk_free_fmt = "N/A"
        disk_used_pct = 0.0

    return AppStatsResponse(
        total_followed_accounts=total_followed,
        total_tracked_accounts=total_tracked,
        total_all_profiles=total_all_profiles,
        total_saved_posts=total_saved_posts,
        download_directory=dl_path,
        download_dir_size_bytes=dir_info["size_bytes"],
        download_dir_size_formatted=dir_info["size_formatted"],
        download_dir_file_count=dir_info["file_count"],
        disk_total_formatted=disk_total_fmt,
        disk_used_formatted=disk_used_fmt,
        disk_free_formatted=disk_free_fmt,
        disk_used_percentage=disk_used_pct
    )


@router.get("/hardware", response_model=SystemHardwareResponse)
async def get_system_hardware(db: AsyncSession = Depends(get_db)):
    """Retrieve comprehensive OS, CPU, RAM, Swap, Disk, and container virtualization telemetry."""
    distro = get_distro_info()
    kernel = f"{platform.system()} {platform.release()}"
    hostname = platform.node()
    is_container, container_type = detect_container_environment()
    uptime_str = get_system_uptime_string()
    cpu_model = get_cpu_model_name()
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    # CPU metrics
    cpu_logical = psutil.cpu_count(logical=True) or 1
    cpu_physical = psutil.cpu_count(logical=False) or cpu_logical
    cpu_pct = psutil.cpu_percent(interval=None)

    # Load average (Linux/Unix)
    try:
        load_avg = [round(x, 2) for x in os.getloadavg()]
    except Exception:
        load_avg = [0.0, 0.0, 0.0]

    # Memory metrics
    vmem = psutil.virtual_memory()
    ram_total_fmt = format_bytes(vmem.total)
    ram_used_fmt = format_bytes(vmem.used)
    ram_free_fmt = format_bytes(vmem.available)
    ram_pct = round(vmem.percent, 1)

    # Swap metrics
    swap = psutil.swap_memory()
    swap_total_fmt = format_bytes(swap.total)
    swap_used_fmt = format_bytes(swap.used)
    swap_free_fmt = format_bytes(swap.free)
    swap_pct = round(swap.percent, 1)

    # Root disk usage
    try:
        d_usage = shutil.disk_usage("/")
        disk_total_fmt = format_bytes(d_usage.total)
        disk_used_fmt = format_bytes(d_usage.used)
        disk_free_fmt = format_bytes(d_usage.free)
        disk_pct = round((d_usage.used / d_usage.total) * 100, 1) if d_usage.total > 0 else 0.0
    except Exception:
        disk_total_fmt = "N/A"
        disk_used_fmt = "N/A"
        disk_free_fmt = "N/A"
        disk_pct = 0.0

    # InstaSave Process Memory RSS
    try:
        proc = psutil.Process(os.getpid())
        proc_mem = format_bytes(proc.memory_info().rss)
    except Exception:
        proc_mem = "N/A"

    return SystemHardwareResponse(
        os_name=distro,
        kernel_version=kernel,
        hostname=hostname,
        is_container=is_container,
        container_type=container_type,
        uptime=uptime_str,
        cpu_model=cpu_model,
        cpu_cores_logical=cpu_logical,
        cpu_cores_physical=cpu_physical,
        cpu_usage_percent=cpu_pct,
        load_average=load_avg,
        ram_total_formatted=ram_total_fmt,
        ram_used_formatted=ram_used_fmt,
        ram_free_formatted=ram_free_fmt,
        ram_usage_percent=ram_pct,
        swap_total_formatted=swap_total_fmt,
        swap_used_formatted=swap_used_fmt,
        swap_free_formatted=swap_free_fmt,
        swap_usage_percent=swap_pct,
        disk_total_formatted=disk_total_fmt,
        disk_used_formatted=disk_used_fmt,
        disk_free_formatted=disk_free_fmt,
        disk_usage_percent=disk_pct,
        process_memory_formatted=proc_mem,
        python_version=py_ver
    )
