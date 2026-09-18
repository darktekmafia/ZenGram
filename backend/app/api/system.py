import os
import sys
import platform
import subprocess
import logging
import time
import shutil
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from fastapi import APIRouter, Query, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import psutil

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import WatchedProfile, MediaItem, AppSettings, AdminUser
from backend.app.auth_utils import get_current_admin
from backend.app.schemas import (
    VersionInfoResponse,
    AppStatsResponse,
    SystemHardwareResponse,
    CommitSummary,
    UpdateStatusResponse
)

logger = logging.getLogger("zengram.system")

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

_cached_git_info: Optional[Dict[str, Any]] = None
_last_git_check_time: float = 0.0

def get_git_info(fetch_remote: bool = False) -> Dict[str, Any]:
    """Retrieve local Git repository commit and branch metadata, comparing against upstream origin/main with automatic cache/refresh."""
    global _cached_git_info, _last_git_check_time
    now = time.time()
    
    # Auto-fetch from remote if explicitly requested, if never checked, or if cache is older than 1 hour
    should_fetch = fetch_remote or (_cached_git_info is None) or ((now - _last_git_check_time) > 3600.0)

    if not should_fetch and _cached_git_info is not None and (now - _last_git_check_time) < 60.0:
        return _cached_git_info

    base_dir = settings.BASE_DIR
    info = {
        "is_git": False,
        "commit_hash": "unknown",
        "commit_date": "N/A",
        "commit_message": "N/A",
        "branch": "main",
        "behind_by": 0,
        "latest_commit": "unknown",
        "update_available": False,
        "latest_version": settings.VERSION
    }
    
    git_dir = base_dir / ".git"
    if not git_dir.exists():
        _cached_git_info = info
        _last_git_check_time = now
        return info
        
    try:
        info["is_git"] = True
        
        if should_fetch:
            try:
                subprocess.run(
                    ["git", "fetch", "--quiet", "origin"],
                    cwd=str(base_dir),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=10
                )
            except Exception as e:
                logger.warning(f"Git remote fetch failed: {e}")

        # Local commit short hash
        res_hash = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=3
        )
        if res_hash.returncode == 0:
            info["commit_hash"] = res_hash.stdout.strip()
            info["latest_commit"] = info["commit_hash"]

        # Local commit date
        res_date = subprocess.run(
            ["git", "log", "-1", "--format=%cd", "--date=short"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=3
        )
        if res_date.returncode == 0:
            info["commit_date"] = res_date.stdout.strip()

        # Local commit subject
        res_msg = subprocess.run(
            ["git", "log", "-1", "--format=%s"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=3
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
            timeout=3
        )
        if res_br.returncode == 0:
            info["branch"] = res_br.stdout.strip()

        # Compare with origin/main or origin/{branch}
        target_branch = info["branch"] if info["branch"] not in ("HEAD", "") else "main"
        remote_ref = f"origin/{target_branch}"

        res_remote_hash = subprocess.run(
            ["git", "rev-parse", "--short", remote_ref],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=3
        )
        if res_remote_hash.returncode == 0 and res_remote_hash.stdout.strip():
            info["latest_commit"] = res_remote_hash.stdout.strip()

        status_res = subprocess.run(
            ["git", "rev-list", "--count", f"HEAD..{remote_ref}"],
            cwd=str(base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=3
        )
        if status_res.returncode == 0 and status_res.stdout.strip().isdigit():
            behind = int(status_res.stdout.strip())
            info["behind_by"] = behind
            if behind > 0:
                info["update_available"] = True
                
                # Fetch remote latest commit message & version if available
                res_rem_msg = subprocess.run(
                    ["git", "log", "-1", "--format=%s", remote_ref],
                    cwd=str(base_dir),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=3
                )
                if res_rem_msg.returncode == 0 and res_rem_msg.stdout.strip():
                    remote_msg = res_rem_msg.stdout.strip()
                    for word in remote_msg.replace(":", " ").replace(",", " ").split():
                        if word.startswith("v1.") or (word.startswith("1.") and len(word) >= 5):
                            info["latest_version"] = word.lstrip("v")
                            break

                # Fetch list of pending upstream commits with author and relative date
                res_log = subprocess.run(
                    ["git", "log", f"HEAD..{remote_ref}", "--format=%H|%s|%an|%ad", "--date=relative", "-n", "20"],
                    cwd=str(base_dir),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=5
                )
                pending = []
                if res_log.returncode == 0 and res_log.stdout.strip():
                    for line in res_log.stdout.strip().splitlines():
                        parts = line.split("|", 3)
                        if len(parts) == 4:
                            pending.append(CommitSummary(
                                hash=parts[0][:7],
                                message=parts[1],
                                author=parts[2],
                                date=parts[3]
                            ))
                info["pending_commits"] = pending

    except Exception as e:
        logger.warning(f"Error reading git info: {e}")

    _cached_git_info = info
    _last_git_check_time = now
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
# -------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------

def _build_version_response(git_info: Dict[str, Any]) -> VersionInfoResponse:
    distro = get_distro_info()
    hostname = platform.node()
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    update_text = (
        "Up to date"
        if not git_info["update_available"]
        else f"Update Available ({git_info['behind_by']} new commit{'s' if git_info['behind_by'] != 1 else ''})"
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
        pending_commits=git_info.get("pending_commits", []),
        distro_name=distro,
        hostname=hostname,
        python_version=py_ver,
        update_status_text=update_text
    )


# -------------------------------------------------------------
# Web Update Runner State & Background Executor
# -------------------------------------------------------------

_active_update_lock = asyncio.Lock()
_active_update_job: Dict[str, Any] = {
    "status": "idle",  # idle, in_progress, restarting, completed, failed
    "progress_percent": 0,
    "current_stage": "Ready",
    "logs": "",
    "error": None,
    "started_at": None,
    "finished_at": None
}


async def _delayed_service_restart():
    """Wait 3 seconds to allow frontend polling to receive final logs, then trigger restart."""
    await asyncio.sleep(3.0)
    logger.info("Executing service restart after web update...")
    is_root = (os.geteuid() == 0) if hasattr(os, "geteuid") else False
    restart_cmd = ["systemctl", "restart", "zengram.service"] if is_root else ["systemctl", "--user", "restart", "zengram.service"]
    try:
        subprocess.Popen(restart_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        logger.warning(f"Failed to issue service restart command: {e}")


async def _run_update_process():
    global _active_update_job
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    installer_path = base_dir / "install.sh"
    
    _active_update_job["status"] = "in_progress"
    _active_update_job["progress_percent"] = 5
    _active_update_job["current_stage"] = "Initializing Update Runner..."
    _active_update_job["logs"] = f"[{datetime.now().strftime('%H:%M:%S')}] Launching ZenGram automated update runner...\n"
    _active_update_job["error"] = None
    _active_update_job["started_at"] = datetime.now().isoformat()
    _active_update_job["finished_at"] = None

    try:
        proc = await asyncio.create_subprocess_exec(
            str(installer_path),
            "--update",
            "--non-interactive",
            "--no-restart",
            cwd=str(base_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=dict(os.environ, PYTHONUNBUFFERED="1")
        )

        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            decoded = line.decode("utf-8", errors="replace")
            _active_update_job["logs"] += decoded
            
            # Parse stages & progress from install.sh output
            if "[1/6]" in decoded:
                _active_update_job["current_stage"] = "Verifying System Dependencies..."
                _active_update_job["progress_percent"] = 15
            elif "[2/6]" in decoded:
                _active_update_job["current_stage"] = "Updating Python Virtual Environment..."
                _active_update_job["progress_percent"] = 30
            elif "[3/6]" in decoded:
                _active_update_job["current_stage"] = "Installing Backend Packages & Browser Engine..."
                _active_update_job["progress_percent"] = 50
            elif "[4/6]" in decoded:
                _active_update_job["current_stage"] = "Compiling Production Frontend Bundle (Vite)..."
                _active_update_job["progress_percent"] = 75
            elif "[5/6]" in decoded:
                _active_update_job["current_stage"] = "Configuring App Environment..."
                _active_update_job["progress_percent"] = 90
            elif "[6/6]" in decoded:
                _active_update_job["current_stage"] = "Finalizing Installation & Service Config..."
                _active_update_job["progress_percent"] = 95

        returncode = await proc.wait()
        _active_update_job["finished_at"] = datetime.now().isoformat()

        if returncode == 0:
            _active_update_job["progress_percent"] = 100
            _active_update_job["current_stage"] = "Update Succeeded! Reloading ZenGram Service..."
            _active_update_job["status"] = "restarting"
            _active_update_job["logs"] += f"\n[{datetime.now().strftime('%H:%M:%S')}] [✓] Web update completed successfully!\n[{datetime.now().strftime('%H:%M:%S')}] Reloading ZenGram background service in 3 seconds...\n"
            asyncio.create_task(_delayed_service_restart())
        else:
            _active_update_job["status"] = "failed"
            _active_update_job["current_stage"] = "Update Failed"
            _active_update_job["error"] = f"Installer exited with returncode {returncode}"
            _active_update_job["logs"] += f"\n[{datetime.now().strftime('%H:%M:%S')}] [!] Update script exited with error code {returncode}.\n"

    except Exception as e:
        logger.error(f"Error during update execution: {e}")
        _active_update_job["status"] = "failed"
        _active_update_job["current_stage"] = "Update Error"
        _active_update_job["error"] = str(e)
        _active_update_job["logs"] += f"\n[{datetime.now().strftime('%H:%M:%S')}] [!] Exception during execution: {e}\n"
        _active_update_job["finished_at"] = datetime.now().isoformat()


@router.get("/version", response_model=VersionInfoResponse)
async def get_version_info():
    """Get full system version, commit history, and update status."""
    git_info = get_git_info(fetch_remote=False)
    return _build_version_response(git_info)


@router.post("/check-update", response_model=VersionInfoResponse)
async def check_for_updates():
    """Fetch upstream git origin to check for new updates."""
    git_info = get_git_info(fetch_remote=True)
    return _build_version_response(git_info)


@router.post("/apply-update", response_model=UpdateStatusResponse)
async def apply_web_update(
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Trigger the non-interactive background installer update."""
    global _active_update_job
    async with _active_update_lock:
        if _active_update_job["status"] in ("in_progress", "restarting"):
            return UpdateStatusResponse(**_active_update_job)

        asyncio.create_task(_run_update_process())
        return UpdateStatusResponse(
            status="in_progress",
            progress_percent=5,
            current_stage="Launching update runner...",
            logs="Initializing update runner...\n",
            started_at=datetime.now().isoformat()
        )


@router.get("/update-status", response_model=UpdateStatusResponse)
async def get_update_status(
    current_admin: AdminUser = Depends(get_current_admin)
):
    """Poll live update runner status, stage, and streaming logs."""
    return UpdateStatusResponse(**_active_update_job)


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
