import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
import asyncio
import httpx
from sqlalchemy import select

from backend.app.main import app
from backend.app.database import init_db, AsyncSessionLocal
from backend.app.models import AdminUser, UserSession
from backend.app.auth_utils import hash_password, create_access_token


async def test_security_hardening():
    """Verify endpoint protection, secret redaction, and SSRF restrictions."""
    await init_db()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated endpoints must return 401 Unauthorized
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
            assert res.status_code == 401, f"{method} {endpoint} returned {res.status_code}, expected 401"

        # 2. Public endpoints must return 200 OK
        res = await client.get("/health")
        assert res.status_code == 200

        res = await client.get("/api/v1/auth/status")
        assert res.status_code == 200

        # 3. Authenticated session tests
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

        token = create_access_token({"sub": admin.username})
        client.cookies.set("zengram_token", token)

        # 4. Verify secret redaction
        sess_res = await client.get("/api/v1/auth/session")
        assert sess_res.status_code == 200
        sess_data = sess_res.json()
        assert "session_cookie" not in sess_data, "Plaintext session_cookie must be redacted"
        assert "has_session_cookie" in sess_data
        assert "masked_cookie" in sess_data

        # 5. Verify SSRF protection
        ssrf_local = await client.get("/api/v1/proxy/image?url=http://127.0.0.1:8484/health")
        assert ssrf_local.status_code == 400

        ssrf_meta = await client.get("/api/v1/proxy/image?url=http://169.254.169.254/latest/meta-data")
        assert ssrf_meta.status_code == 400

        ssrf_ext = await client.get("/api/v1/proxy/image?url=https://malicious-domain.com/img.jpg")
        assert ssrf_ext.status_code == 400


if __name__ == "__main__":
    asyncio.run(test_security_hardening())
    print("All security tests passed!")
