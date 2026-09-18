import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
import asyncio
import httpx
from sqlalchemy import select

from backend.app.main import app, _is_safe_image_proxy_url
from backend.app.database import init_db, AsyncSessionLocal
from backend.app.models import AdminUser, UserSession
from backend.app.auth_utils import hash_password, create_access_token


async def test_security_hardening():
    """Verify endpoint protection, secret redaction, SSRF restrictions, and mandatory admin auth."""
    await init_db()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Ensure clean admin setup for testing
        async with AsyncSessionLocal() as db:
            admin_res = await db.execute(select(AdminUser))
            admin = admin_res.scalars().first()
            if not admin:
                admin = AdminUser(
                    username="admin",
                    hashed_password=hash_password("admin_test_pwd_123"),
                    auth_enabled=True
                )
                db.add(admin)
                await db.commit()
                await db.refresh(admin)
            else:
                admin.auth_enabled = True
                await db.commit()

        # 2. Unauthenticated endpoints must return 401 Unauthorized when auth_enabled=True
        unauth_endpoints = [
            ("GET", "/api/v1/auth/session"),
            ("POST", "/api/v1/auth/session"),
            ("POST", "/api/v1/auth/session/refresh-avatar"),
            ("POST", "/api/v1/auth/session/test"),
            ("GET", "/api/v1/auth/display-info"),
            ("POST", "/api/v1/auth/interactive-login"),
            ("GET", "/api/v1/auth/interactive-login/status"),
            ("POST", "/api/v1/auth/interactive-login/cancel"),
            ("GET", "/api/v1/profiles"),
            ("GET", "/api/v1/feed"),
            ("GET", "/api/v1/downloads/jobs"),
            ("GET", "/api/v1/settings"),
            ("GET", "/api/v1/proxy/image?url=https://scontent.cdninstagram.com/test.jpg"),
        ]

        for method, endpoint in unauth_endpoints:
            if method == "GET":
                res = await client.get(endpoint)
            else:
                res = await client.post(endpoint, json={})
            assert res.status_code == 401, f"Expected 401 for {method} {endpoint}, got {res.status_code}"

        # 3. Public endpoints must return 200 OK
        res = await client.get("/health")
        assert res.status_code == 200

        res = await client.get("/api/v1/auth/status")
        assert res.status_code == 200

        # 4. Authenticated session tests
        token = create_access_token({"sub": admin.username})
        client.cookies.set("zengram_token", token)

        # 5. Verify secret redaction
        sess_res = await client.get("/api/v1/auth/session")
        assert sess_res.status_code == 200
        sess_data = sess_res.json()
        assert "session_cookie" not in sess_data, "Plaintext session_cookie must be redacted"
        assert "has_session_cookie" in sess_data
        assert "masked_cookie" in sess_data

        # 6. Verify SSRF protection on image proxy
        assert not _is_safe_image_proxy_url("http://127.0.0.1:8484/health")
        assert not _is_safe_image_proxy_url("http://localhost:8080/")
        assert not _is_safe_image_proxy_url("http://169.254.169.254/latest/meta-data")
        assert not _is_safe_image_proxy_url("http://192.168.1.1/admin")
        assert not _is_safe_image_proxy_url("https://malicious-site.com/avatar.jpg")
        assert _is_safe_image_proxy_url("https://scontent.cdninstagram.com/v/t51.2885-19/test.jpg")
        assert _is_safe_image_proxy_url("https://instagram.fsnc1-1.fna.fbcdn.net/v/t51.2885-15/pic.jpg")

        ssrf_local = await client.get("/api/v1/proxy/image?url=http://127.0.0.1:8484/health")
        assert ssrf_local.status_code == 400

        ssrf_meta = await client.get("/api/v1/proxy/image?url=http://169.254.169.254/latest/meta-data")
        assert ssrf_meta.status_code == 400

        ssrf_ext = await client.get("/api/v1/proxy/image?url=https://malicious-domain.com/img.jpg")
        assert ssrf_ext.status_code == 400

        # 7. Test Dual-Mode Authentication: when auth_enabled=False (guest browsing mode)
        async with AsyncSessionLocal() as db:
            admin_res = await db.execute(select(AdminUser))
            admin = admin_res.scalars().first()
            admin.auth_enabled = False
            await db.commit()

        # Clear token cookie to simulate unauthenticated guest visitor
        client.cookies.clear()

        # Feed & profiles should now be accessible without login
        guest_feed = await client.get("/api/v1/feed")
        assert guest_feed.status_code == 200, f"Expected 200 for guest feed, got {guest_feed.status_code}"

        guest_profiles = await client.get("/api/v1/profiles")
        assert guest_profiles.status_code == 200, f"Expected 200 for guest profiles, got {guest_profiles.status_code}"

        # BUT sensitive credential and security endpoints MUST still be blocked with 401!
        sensitive_credential_endpoints = [
            ("GET", "/api/v1/auth/session"),
            ("POST", "/api/v1/auth/session"),
            ("POST", "/api/v1/auth/session/refresh-avatar"),
            ("POST", "/api/v1/auth/session/test"),
            ("POST", "/api/v1/auth/change-password"),
            ("POST", "/api/v1/auth/security-settings"),
            ("POST", "/api/v1/auth/interactive-login"),
            ("GET", "/api/v1/auth/interactive-login/status"),
            ("POST", "/api/v1/auth/interactive-login/cancel"),
            ("GET", "/api/v1/auth/display-info"),
        ]

        for method, endpoint in sensitive_credential_endpoints:
            if method == "GET":
                res = await client.get(endpoint)
            else:
                res = await client.post(endpoint, json={})
            assert res.status_code == 401, f"Expected mandatory 401 on credential endpoint {method} {endpoint} when auth_enabled=False, got {res.status_code}"

        # Restore auth_enabled = True
        async with AsyncSessionLocal() as db:
            admin_res = await db.execute(select(AdminUser))
            admin = admin_res.scalars().first()
            admin.auth_enabled = True
            await db.commit()


if __name__ == "__main__":
    asyncio.run(test_security_hardening())
    print("All security and dual-mode authentication tests passed successfully!")

