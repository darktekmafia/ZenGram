import asyncio
import datetime
import logging
import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db, AsyncSessionLocal
from backend.app.models import UserSession, WatchedProfile, AdminUser
from backend.app.schemas import (
    UserSessionCreate, UserSessionResponse,
    AdminSetupRequest, AdminLoginRequest, AdminChangePasswordRequest,
    AdminSecuritySettingsRequest, AuthStatusResponse
)
from backend.app.auth_utils import (
    hash_password, verify_password, create_access_token, decode_access_token, get_current_admin
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

# -------------------------------------------------------------
# Admin User & Master Password Authentication (HttpOnly Cookie)
# -------------------------------------------------------------

@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status(request: Request, db: AsyncSession = Depends(get_db)):
    """Check whether master setup is required and whether the current browser session is authenticated."""
    result = await db.execute(select(AdminUser))
    admin = result.scalars().first()

    if not admin:
        return AuthStatusResponse(
            is_setup_required=True,
            is_authenticated=False,
            auth_enabled=True,
            admin_username=None
        )

    if not admin.auth_enabled:
        return AuthStatusResponse(
            is_setup_required=False,
            is_authenticated=True,
            auth_enabled=False,
            admin_username=admin.username
        )

    # Check HttpOnly cookie or Authorization header
    token = request.cookies.get("instasave_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    is_auth = False
    if token:
        payload = decode_access_token(token)
        if payload and payload.get("sub") == admin.username:
            is_auth = True

    return AuthStatusResponse(
        is_setup_required=False,
        is_authenticated=is_auth,
        auth_enabled=admin.auth_enabled,
        admin_username=admin.username if is_auth else None
    )


@router.post("/setup")
async def setup_admin_account(data: AdminSetupRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """First-run setup wizard: Create master admin password and issue initial HttpOnly session cookie."""
    result = await db.execute(select(AdminUser))
    existing_admin = result.scalars().first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Administrator account is already initialized.")

    clean_username = data.username.strip() or "admin"
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Master password must be at least 6 characters long.")

    hashed = hash_password(data.password)
    new_admin = AdminUser(
        username=clean_username,
        hashed_password=hashed,
        auth_enabled=True,
        created_at=datetime.datetime.utcnow(),
        last_login_at=datetime.datetime.utcnow()
    )
    db.add(new_admin)
    await db.commit()
    await db.refresh(new_admin)

    # Generate token & set HttpOnly cookie
    token = create_access_token({"sub": new_admin.username})
    response.set_cookie(
        key="instasave_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=30 * 86400,
        path="/"
    )
    return {
        "status": "success",
        "username": new_admin.username,
        "message": "Master administrator password configured successfully!"
    }


@router.post("/login")
async def login_admin(data: AdminLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate administrator with master credentials and issue secure HttpOnly cookie."""
    result = await db.execute(select(AdminUser))
    admin = result.scalars().first()
    if not admin:
        raise HTTPException(status_code=400, detail="System setup required. Please configure an administrator password.")

    if not verify_password(data.password, admin.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")

    admin.last_login_at = datetime.datetime.utcnow()
    await db.commit()

    max_age = 30 * 86400 if data.remember_me else None
    token = create_access_token({"sub": admin.username})
    response.set_cookie(
        key="instasave_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=max_age,
        path="/"
    )
    return {
        "status": "success",
        "username": admin.username,
        "message": "Authenticated successfully."
    }


@router.post("/logout")
async def logout_admin(response: Response):
    """Clear the HttpOnly authentication cookie."""
    response.delete_cookie(key="instasave_token", path="/")
    return {
        "status": "success",
        "message": "Logged out successfully."
    }


@router.post("/change-password")
async def change_admin_password(
    data: AdminChangePasswordRequest,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Change the master admin password."""
    if not current_admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    if not verify_password(data.current_password, current_admin.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    current_admin.hashed_password = hash_password(data.new_password)
    await db.commit()
    return {
        "status": "success",
        "message": "Master password updated successfully!"
    }


@router.post("/security-settings")
async def update_security_settings(
    data: AdminSecuritySettingsRequest,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Toggle master authentication requirement on/off."""
    if not current_admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    current_admin.auth_enabled = data.auth_enabled
    await db.commit()
    return {
        "status": "success",
        "auth_enabled": current_admin.auth_enabled,
        "message": f"Authentication requirement {'enabled' if data.auth_enabled else 'disabled'}."
    }


# -------------------------------------------------------------
# Instagram Session & Interactive Browser Login
# -------------------------------------------------------------


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
    else:
        # If profile_pic_url is missing, check if available in watched_profiles
        if not session.profile_pic_url and session.username and session.username != "admin":
            wp_res = await db.execute(select(WatchedProfile).where(WatchedProfile.username == session.username))
            wp = wp_res.scalars().first()
            if wp and wp.profile_pic_url:
                session.profile_pic_url = wp.profile_pic_url
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
                detected_avatar = None
                try:
                    js_extract_profile = """
                    () => {
                        let username = null;
                        let profilePicUrl = null;
                        const links = Array.from(document.querySelectorAll('a[href]'));
                        for (const a of links) {
                            const img = a.querySelector('img[alt*="profile picture"]') || a.querySelector("img[alt*='profile picture']");
                            if (img) {
                                const alt = img.getAttribute('alt') || '';
                                const match = alt.match(/^(.+?)'s profile picture$/i);
                                if (match && match[1]) {
                                    username = match[1].trim();
                                    profilePicUrl = img.getAttribute('src');
                                    return { username, profilePicUrl };
                                }
                                const href = a.getAttribute('href') || '';
                                const clean = href.replace(/^\\/|\\/$/g, '').split('?')[0].split('/')[0];
                                if (clean && !['explore', 'direct', 'reels', 'stories', 'accounts', 'settings'].includes(clean)) {
                                    username = clean;
                                    profilePicUrl = img.getAttribute('src');
                                    return { username, profilePicUrl };
                                }
                            }
                        }
                        const nav = document.querySelector('nav') || document.querySelector('div[role="navigation"]') || document.querySelector('header');
                        if (nav) {
                            const navAnchors = Array.from(nav.querySelectorAll('a[href]'));
                            for (const a of navAnchors) {
                                const href = a.getAttribute('href') || '';
                                const clean = href.replace(/^\\/|\\/$/g, '').split('?')[0].split('/')[0];
                                if (clean && !['explore', 'direct', 'reels', 'stories', 'accounts', 'your_activity', 'settings'].includes(clean)) {
                                    username = clean;
                                    const img = a.querySelector('img');
                                    if (img) profilePicUrl = img.getAttribute('src');
                                    return { username, profilePicUrl };
                                }
                            }
                        }
                        return { username: null, profilePicUrl: null };
                    }
                    """
                    profile_res = await page.evaluate(js_extract_profile)
                    if isinstance(profile_res, dict):
                        detected_username = profile_res.get("username")
                        detected_avatar = profile_res.get("profilePicUrl")
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
                        if detected_avatar:
                            existing.profile_pic_url = detected_avatar
                        existing.is_active = True
                        existing.last_validated_at = datetime.datetime.utcnow()
                    else:
                        new_sess = UserSession(
                            username=detected_username,
                            session_cookie=sessionid,
                            profile_pic_url=detected_avatar,
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
