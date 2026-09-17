import asyncio
import datetime
import logging
import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db, AsyncSessionLocal
from backend.app.models import UserSession
from backend.app.schemas import UserSessionCreate, UserSessionResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

# Global state for interactive browser login
interactive_login_state: Dict[str, Any] = {
    "is_running": False,
    "status": "idle",  # "idle", "opening_browser", "waiting_for_user", "extracting", "success", "error", "cancelled", "headless_detected"
    "message": "",
    "error": None,
    "username": None,
    "session_cookie": None,
    "updated_at": None,
    "task": None,
}

_playwright_instance = None
_active_browser = None


def has_graphical_display() -> bool:
    """Check if the current Linux/Host environment has an active display server (X11 or Wayland)."""
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))


@router.get("/display-info")
async def get_display_info():
    """Return whether the current server has a graphical display available for headful browser actions."""
    has_display = has_graphical_display()
    display_var = os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY") or "None"
    return {
        "has_display": has_display,
        "display_var": display_var,
        "environment_type": "desktop_workstation" if has_display else "headless_server_or_lxc"
    }


@router.get("/session", response_model=UserSessionResponse)
async def get_current_session(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSession).where(UserSession.is_active == True))
    session = result.scalars().first()
    if not session:
        # Return default active placeholder session
        session = UserSession(
            username="admin",
            session_cookie="dummy_session_cookie",
            is_active=True,
            created_at=datetime.datetime.utcnow(),
            last_validated_at=datetime.datetime.utcnow()
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session


@router.post("/session", response_model=UserSessionResponse)
async def create_session(data: UserSessionCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSession).where(UserSession.username == data.username))
    existing = result.scalars().first()
    if existing:
        existing.session_cookie = data.session_cookie
        existing.is_active = True
        existing.last_validated_at = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing

    new_session = UserSession(
        username=data.username,
        session_cookie=data.session_cookie,
        is_active=True,
        last_validated_at=datetime.datetime.utcnow()
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


async def _run_interactive_login_task():
    global interactive_login_state, _playwright_instance, _active_browser
    from playwright.async_api import async_playwright

    interactive_login_state["is_running"] = True
    interactive_login_state["status"] = "opening_browser"
    interactive_login_state["message"] = "Launching Chromium browser on your desktop..."
    interactive_login_state["error"] = None
    interactive_login_state["username"] = None
    interactive_login_state["session_cookie"] = None
    interactive_login_state["updated_at"] = datetime.datetime.utcnow().isoformat()

    try:
        _playwright_instance = await async_playwright().start()
        _active_browser = await _playwright_instance.chromium.launch(
            headless=False,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--window-size=1080,820",
                "--window-position=120,80"
            ]
        )
        context = await _active_browser.new_context(
            viewport={"width": 1080, "height": 820},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        await page.goto("https://www.instagram.com/accounts/login/", timeout=45000)

        interactive_login_state["status"] = "waiting_for_user"
        interactive_login_state["message"] = "Browser open! Please log into Instagram in the Chromium window (handles 2FA, SMS, Passkeys)..."
        interactive_login_state["updated_at"] = datetime.datetime.utcnow().isoformat()

        # Poll cookies every 2 seconds for up to 300 seconds (5 minutes)
        for _ in range(150):
            if not interactive_login_state["is_running"]:
                break

            cookies = await context.cookies()
            cookie_dict = {c["name"]: c["value"] for c in cookies if "instagram.com" in c.get("domain", "")}
            sessionid = cookie_dict.get("sessionid")
            ds_user_id = cookie_dict.get("ds_user_id")

            if sessionid and sessionid != "dummy_session_cookie":
                interactive_login_state["status"] = "extracting"
                interactive_login_state["message"] = "Login detected! Extracting account profile & username..."
                interactive_login_state["updated_at"] = datetime.datetime.utcnow().isoformat()

                # Navigate to home feed if still on auth/onetap pages to populate navigation DOM
                try:
                    current_url = page.url
                    if "accounts/login" in current_url or "accounts/onetap" in current_url or "onetap" in current_url:
                        await page.goto("https://www.instagram.com/", wait_until="domcontentloaded", timeout=15000)
                except Exception:
                    pass

                await asyncio.sleep(2.5)

                detected_username = None
                try:
                    js_extract_username = """
                    () => {
                        // 1. Inspect sidebar profile link containing the avatar img
                        const links = Array.from(document.querySelectorAll('a[href]'));
                        for (const a of links) {
                            const img = a.querySelector('img[alt*="profile picture"]') || a.querySelector("img[alt*='profile picture']");
                            if (img) {
                                const alt = img.getAttribute('alt') || '';
                                const match = alt.match(/^(.+?)'s profile picture$/i);
                                if (match && match[1]) {
                                    return match[1].trim();
                                }
                                const href = a.getAttribute('href') || '';
                                const clean = href.replace(/^\\/|\\/$/g, '').split('?')[0].split('/')[0];
                                if (clean && !['explore', 'direct', 'reels', 'stories', 'accounts', 'settings'].includes(clean)) {
                                    return clean;
                                }
                            }
                        }
                        // 2. Inspect navigation container anchors
                        const nav = document.querySelector('nav') || document.querySelector('div[role="navigation"]') || document.querySelector('header');
                        if (nav) {
                            const navAnchors = Array.from(nav.querySelectorAll('a[href]'));
                            for (const a of navAnchors) {
                                const href = a.getAttribute('href') || '';
                                const clean = href.replace(/^\\/|\\/$/g, '').split('?')[0].split('/')[0];
                                if (clean && !['explore', 'direct', 'reels', 'stories', 'accounts', 'your_activity', 'settings'].includes(clean)) {
                                    return clean;
                                }
                            }
                        }
                        return null;
                    }
                    """
                    detected_username = await page.evaluate(js_extract_username)
                except Exception as e:
                    logger.debug(f"Could not extract DOM username: {e}")

                if not detected_username:
                    detected_username = f"user_{ds_user_id}" if ds_user_id else "instagram_user"

                # Persist directly to DB
                async with AsyncSessionLocal() as db:
                    # Deactivate old sessions to ensure single active authenticated user
                    old_sessions = await db.execute(select(UserSession))
                    for s in old_sessions.scalars().all():
                        s.is_active = False

                    # Look for existing session with this username or create new
                    result = await db.execute(select(UserSession).where(UserSession.username == detected_username))
                    existing = result.scalars().first()
                    if existing:
                        existing.session_cookie = sessionid
                        existing.is_active = True
                        existing.last_validated_at = datetime.datetime.utcnow()
                    else:
                        new_sess = UserSession(
                            username=detected_username,
                            session_cookie=sessionid,
                            is_active=True,
                            last_validated_at=datetime.datetime.utcnow()
                        )
                        db.add(new_sess)
                    await db.commit()

                interactive_login_state["status"] = "success"
                interactive_login_state["username"] = detected_username
                interactive_login_state["session_cookie"] = sessionid
                interactive_login_state["message"] = f"Successfully authenticated as @{detected_username}! Session cookie saved."
                interactive_login_state["updated_at"] = datetime.datetime.utcnow().isoformat()
                await asyncio.sleep(2)
                break

            await asyncio.sleep(2)

        if interactive_login_state["status"] == "waiting_for_user":
            interactive_login_state["status"] = "timeout"
            interactive_login_state["message"] = "Login timed out after 5 minutes without session detected."
            interactive_login_state["updated_at"] = datetime.datetime.utcnow().isoformat()

    except Exception as e:
        logger.error(f"Error during interactive browser login: {e}", exc_info=True)
        interactive_login_state["status"] = "error"
        interactive_login_state["error"] = str(e)
        interactive_login_state["message"] = f"Interactive login failed: {e}"
        interactive_login_state["updated_at"] = datetime.datetime.utcnow().isoformat()

    finally:
        interactive_login_state["is_running"] = False
        try:
            if _active_browser:
                await _active_browser.close()
                _active_browser = None
        except Exception:
            pass
        try:
            if _playwright_instance:
                await _playwright_instance.stop()
                _playwright_instance = None
        except Exception:
            pass


@router.post("/interactive-login")
async def start_interactive_login(background_tasks: BackgroundTasks):
    """Launch a visible Chromium window on the host for user login and automated cookie extraction."""
    global interactive_login_state

    # Check display server availability
    if not has_graphical_display():
        return {
            "status": "headless_detected",
            "message": "No graphical display ($DISPLAY / $WAYLAND_DISPLAY) detected on this server. Interactive browser login requires a desktop environment. Please use the DevTools manual extraction method.",
            "is_running": False
        }

    if interactive_login_state["is_running"]:
        return {
            "status": interactive_login_state["status"],
            "message": interactive_login_state["message"],
            "is_running": True
        }

    background_tasks.add_task(_run_interactive_login_task)
    return {
        "status": "opening_browser",
        "message": "Launching browser login window on your desktop...",
        "is_running": True
    }


@router.get("/interactive-login/status")
async def get_interactive_login_status():
    """Poll the status of the current interactive login session."""
    return {
        "is_running": interactive_login_state["is_running"],
        "status": interactive_login_state["status"],
        "message": interactive_login_state["message"],
        "error": interactive_login_state["error"],
        "username": interactive_login_state["username"],
        "updated_at": interactive_login_state["updated_at"]
    }


@router.post("/interactive-login/cancel")
async def cancel_interactive_login():
    """Cancel the active interactive browser login session and close the browser."""
    global interactive_login_state, _active_browser, _playwright_instance
    if interactive_login_state["is_running"]:
        interactive_login_state["is_running"] = False
        interactive_login_state["status"] = "cancelled"
        interactive_login_state["message"] = "Interactive login cancelled by user."
        try:
            if _active_browser:
                await _active_browser.close()
                _active_browser = None
        except Exception:
            pass
        try:
            if _playwright_instance:
                await _playwright_instance.stop()
                _playwright_instance = None
        except Exception:
            pass
    return {
        "status": "cancelled",
        "message": "Interactive login cancelled."
    }
