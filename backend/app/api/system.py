import os
import sys
import platform
import subprocess
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
from backend.app.config import settings

logger = logging.getLogger("instasave.system")

router = APIRouter(prefix="/system", tags=["System"])

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
    distro_name: str
    hostname: str
    python_version: str
    update_status_text: str

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
        # Check if git is available
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

@router.get("/version", response_model=VersionInfoResponse)
async def get_version_info():
    """Get full system version, commit history, and update status."""
    git_info = get_git_info()
    distro = get_distro_info()
    hostname = platform.node()
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    
    # Check if a test simulation is active
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
            # Check git remote fetch if origin is configured
            fetch_res = subprocess.run(
                ["git", "fetch", "--dry-run", "origin"],
                cwd=str(base_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5
            )
            # Compare HEAD with origin/main or origin/master
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
