import os
import hashlib
import logging
import datetime
import httpx
from pathlib import Path
from typing import Optional, Dict, Any
from backend.app.config import settings

logger = logging.getLogger("instasave.downloader")

class MediaDownloader:
    def __init__(self, download_dir: Optional[Path] = None):
        self.download_dir = Path(download_dir) if download_dir else settings.DOWNLOAD_DIR
        os.makedirs(self.download_dir, exist_ok=True)

    async def download_media(
        self,
        media_url: str,
        username: str,
        post_id: str,
        category_tag: Optional[str] = "General",
        file_extension: str = "jpg"
    ) -> Dict[str, Any]:
        """Download media file locally, organizing into category/user folders with deduplication."""
        
        # Determine folder structure: ~/Downloads/InstaSave/[Category]/[Username]/
        subfolder_name = category_tag.strip() if category_tag else "General"
        user_dir = self.download_dir / subfolder_name / f"@{username}"
        os.makedirs(user_dir, exist_ok=True)

        filename = f"{post_id}.{file_extension}"
        target_path = user_dir / filename

        # If already exists, return existing path
        if target_path.exists():
            return {
                "success": True,
                "file_path": str(target_path),
                "is_duplicate": True,
                "file_size_bytes": target_path.stat().st_size
            }

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                response = await client.get(media_url)
                if response.status_code == 200:
                    content = response.content
                    
                    # Write to file
                    with open(target_path, "wb") as f:
                        f.write(content)

                    return {
                        "success": True,
                        "file_path": str(target_path),
                        "is_duplicate": False,
                        "file_size_bytes": len(content)
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

downloader = MediaDownloader()
