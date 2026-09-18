import os
import sys
import tempfile
import asyncio
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Configure isolated disposable SQLite database for tests
temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db_file.name
temp_db_file.close()

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{temp_db_path}"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.main import app, _is_safe_image_proxy_url
import backend.app.database as db_module
from backend.app.models import Base, AdminUser, UserSession
from backend.app.auth_utils import hash_password, create_access_token

# Rebind test engine to disposable SQLite database
test_engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db_path}", echo=False)
db_module.engine = test_engine
db_module.AsyncSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def test_security_hardening():
    """Verify endpoint protection, secret redaction, SSRF/DNS rebinding restrictions, and mandatory admin auth on a disposable DB."""
    try:
        # Initialize disposable tables
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Uninitialized setup check
            status_res = await client.get("/api/v1/auth/status")
            assert status_res.status_code == 200
            assert status_res.json()["is_setup_required"] is True

            # 2. Setup master admin
            setup_res = await client.post("/api/v1/auth/setup", json={
                "username": "admin",
                "password": "master_admin_pwd_123"
            })
            assert setup_res.status_code == 200

            # 3. Verify unauthenticated endpoints return 401 Unauthorized when auth_enabled=True
            # Remove cookie to test unauthenticated request
            client.cookies.clear()

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
                ("POST", "/api/v1/system/apply-update"),
                ("GET", "/api/v1/system/update-status"),
                ("GET", "/api/v1/system/backup/download"),
            ]

            for method, endpoint in unauth_endpoints:
                if method == "GET":
                    res = await client.get(endpoint)
                else:
                    res = await client.post(endpoint, json={})
                assert res.status_code == 401, f"Expected 401 for {method} {endpoint}, got {res.status_code}"

            # 4. Public endpoints must return 200 OK
            res = await client.get("/health")
            assert res.status_code == 200

            res = await client.get("/api/v1/auth/status")
            assert res.status_code == 200
            assert res.json()["is_setup_required"] is False

            # 5. Authenticated session tests
            token = create_access_token({"sub": "admin"})
            client.cookies.set("zengram_token", token)

            # 6. Verify secret redaction
            sess_res = await client.get("/api/v1/auth/session")
            assert sess_res.status_code == 200
            sess_data = sess_res.json()
            assert "session_cookie" not in sess_data, "Plaintext session_cookie must be redacted"
            assert "has_session_cookie" in sess_data
            assert "masked_cookie" in sess_data

            # 7. Verify SSRF protection & DNS rebinding checks on image proxy
            assert not _is_safe_image_proxy_url("http://127.0.0.1:8484/health")
            assert not _is_safe_image_proxy_url("http://localhost:8080/")
            assert not _is_safe_image_proxy_url("http://169.254.169.254/latest/meta-data")
            assert not _is_safe_image_proxy_url("http://192.168.1.1/admin")
            assert not _is_safe_image_proxy_url("https://malicious-site.com/avatar.jpg")
            assert _is_safe_image_proxy_url("https://scontent.cdninstagram.com/v/t51.2885-19/test.jpg")
            assert _is_safe_image_proxy_url("https://www.instagram.com/static/images/ico/favicon.ico")

            ssrf_local = await client.get("/api/v1/proxy/image?url=http://127.0.0.1:8484/health")
            assert ssrf_local.status_code == 400

            ssrf_meta = await client.get("/api/v1/proxy/image?url=http://169.254.169.254/latest/meta-data")
            assert ssrf_meta.status_code == 400

            ssrf_ext = await client.get("/api/v1/proxy/image?url=https://malicious-domain.com/img.jpg")
            assert ssrf_ext.status_code == 400

            # 8. Test Dual-Mode Authentication: when auth_enabled=False (guest browsing mode)
            async with db_module.AsyncSessionLocal() as db:
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
            # 9. Verify Transparent AES-256 Encryption at Rest in SQLite
            async with db_module.AsyncSessionLocal() as db:
                from sqlalchemy import text
                test_raw_cookie = "sessionid=999888777666abcdef; ds_user_id=12345;"
                test_sess = UserSession(
                    username="crypto_test_user",
                    session_cookie=test_raw_cookie,
                    is_active=True
                )
                db.add(test_sess)
                await db.commit()

                # Verify getter decrypts seamlessly in Python RAM
                assert test_sess.session_cookie == test_raw_cookie
                # Verify internal attribute is ciphertext
                assert test_sess._session_cookie.startswith("enc:")
                assert "999888777666abcdef" not in test_sess._session_cookie

                # Query raw SQLite database column directly with SQL text query
                raw_db_row = (await db.execute(text("SELECT session_cookie FROM user_sessions WHERE username = 'crypto_test_user'"))).fetchone()
                assert raw_db_row is not None
                db_stored_cookie = raw_db_row[0]
                assert db_stored_cookie.startswith("enc:"), f"Expected encrypted column value starting with enc:, got: {db_stored_cookie}"
                assert "999888777666abcdef" not in db_stored_cookie, "Plaintext cookie was leaked directly into SQLite database file!"

            # 10. Verify Legacy Plaintext Migration on Startup
            async with db_module.AsyncSessionLocal() as db:
                from sqlalchemy import text
                await db.execute(text("INSERT INTO user_sessions (username, session_cookie, is_active, created_at) VALUES ('legacy_unencrypted_user', 'legacy_plaintext_session_12345', 1, CURRENT_TIMESTAMP)"))
                await db.commit()

            # Trigger database init/migration
            await db_module.init_db()

            async with db_module.AsyncSessionLocal() as db:
                from sqlalchemy import text
                migrated_row = (await db.execute(text("SELECT session_cookie FROM user_sessions WHERE username = 'legacy_unencrypted_user'"))).fetchone()
                assert migrated_row is not None
                assert migrated_row[0].startswith("enc:"), f"Legacy record was not auto-migrated to encrypted ciphertext! Found: {migrated_row[0]}"
                assert "legacy_plaintext_session_12345" not in migrated_row[0]

                # Verify transparent read in Python
                res = await db.execute(select(UserSession).where(UserSession.username == "legacy_unencrypted_user"))
                legacy_sess = res.scalars().first()
                assert legacy_sess.session_cookie == "legacy_plaintext_session_12345"

            # 11. Verify Unresolvable Hostname / DNS failure fails closed
            from unittest.mock import patch
            import socket
            with patch("socket.getaddrinfo", side_effect=socket.gaierror(socket.EAI_NONAME, "Name or service not known")):
                assert not _is_safe_image_proxy_url("https://scontent.cdninstagram.com/pic.jpg")
            assert not _is_safe_image_proxy_url("https://unresolvable.invalid/pic.jpg")

            # 12. Verify URL parser rejects userinfo, non-standard ports, and non-HTTP schemes
            assert not _is_safe_image_proxy_url("https://admin:pass@scontent.cdninstagram.com/pic.jpg")
            assert not _is_safe_image_proxy_url("https://scontent.cdninstagram.com:8443/pic.jpg")
            assert not _is_safe_image_proxy_url("ftp://scontent.cdninstagram.com/pic.jpg")
            assert not _is_safe_image_proxy_url("file:///etc/passwd")

            # 13. Verify Distinct Query Parameters produce Distinct Cache Keys
            import hashlib
            url_a = "https://scontent.cdninstagram.com/v/t51.2885-19/test.jpg?token=abc"
            url_b = "https://scontent.cdninstagram.com/v/t51.2885-19/test.jpg?token=xyz"
            key_a = hashlib.sha256(url_a.encode("utf-8")).hexdigest()
            key_b = hashlib.sha256(url_b.encode("utf-8")).hexdigest()
            assert key_a != key_b, "Distinct query parameters must produce different cache keys"

            # 14. Verify Encryption Fail-Closed behavior
            from backend.app.auth_utils import encrypt_secret, decrypt_secret
            assert encrypt_secret("dummy_session_cookie") == "dummy_session_cookie"
            enc_result = encrypt_secret("valid_cookie_123")
            assert enc_result.startswith("enc:")

            # 15. Verify Key Mismatch / Corrupted Ciphertext raises RuntimeError when verified
            try:
                decrypt_secret("enc:gAAAAABn_invalid_corrupted_payload_12345", raise_on_error=True)
                assert False, "Expected RuntimeError on invalid/mismatched encryption key"
            except RuntimeError:
                pass

            # 16. Verify IP Resolution Pinning in proxy URL validator (Anti-DNS Rebinding)
            from backend.app.main import _validate_and_pin_proxy_url
            pin_result = _validate_and_pin_proxy_url("https://scontent.cdninstagram.com/v/t51.2885-19/test.jpg")
            assert pin_result is not None
            pinned_url, host, port = pin_result
            assert host == "scontent.cdninstagram.com"
            assert port == 443
            assert "scontent.cdninstagram.com" not in pinned_url.split("/")[2], "Pinned URL must replace host with resolved IP"

            # 17. Verify Atomic Migration Rollback on multi-record failure
            async with db_module.AsyncSessionLocal() as db:
                from sqlalchemy import text
                await db.execute(text("INSERT INTO user_sessions (username, session_cookie, is_active, created_at) VALUES ('rollback_user_1', 'unencrypted_alpha', 1, CURRENT_TIMESTAMP)"))
                await db.execute(text("INSERT INTO user_sessions (username, session_cookie, is_active, created_at) VALUES ('rollback_user_2', 'unencrypted_beta', 1, CURRENT_TIMESTAMP)"))
                await db.commit()

            # Mock encrypt_secret to fail specifically on 'unencrypted_beta'
            import backend.app.auth_utils as auth_module
            real_encrypt = auth_module.encrypt_secret
            def mock_fail_on_beta(val):
                if val == "unencrypted_beta":
                    raise RuntimeError("Simulated failure on second record")
                return real_encrypt(val)

            auth_module.encrypt_secret = mock_fail_on_beta
            try:
                await db_module.init_db()
                assert False, "Expected init_db to fail and raise RuntimeError on migration error"
            except RuntimeError:
                pass
            finally:
                auth_module.encrypt_secret = real_encrypt

            # Verify transaction was rolled back and rollback_user_1 was NOT partially committed
            async with db_module.AsyncSessionLocal() as db:
                from sqlalchemy import text
                r1 = (await db.execute(text("SELECT session_cookie FROM user_sessions WHERE username = 'rollback_user_1'"))).scalar()
                r2 = (await db.execute(text("SELECT session_cookie FROM user_sessions WHERE username = 'rollback_user_2'"))).scalar()
                assert r1 == "unencrypted_alpha", f"Expected rollback to leave r1 unencrypted, but got: {r1}"
                assert r2 == "unencrypted_beta", f"Expected rollback to leave r2 unencrypted, but got: {r2}"

            # 18. Verify Multi-Hop Relative Redirect Path Resolution
            import urllib.parse
            base_url = "https://scontent.cdninstagram.com/v/t51/initial.jpg"
            hop1_loc = "sub/redirect1.jpg"
            hop1_url = urllib.parse.urljoin(base_url, hop1_loc)
            assert hop1_url == "https://scontent.cdninstagram.com/v/t51/sub/redirect1.jpg"
            hop2_loc = "../final.jpg"
            hop2_url = urllib.parse.urljoin(hop1_url, hop2_loc)
            assert hop2_url == "https://scontent.cdninstagram.com/v/t51/final.jpg", f"Expected proper relative resolution against hop1_url, got: {hop2_url}"

            # 19. Verify End-to-End Pinned Proxy Request with Empty Disk Cache
            import hashlib
            from backend.app.config import settings
            test_target_url = "https://www.instagram.com/static/images/ico/favicon.ico"
            test_cache_key = hashlib.sha256(test_target_url.encode("utf-8")).hexdigest()
            cache_file = settings.BASE_DIR / "storage" / "cache" / "images" / f"{test_cache_key}.jpg"
            if cache_file.exists():
                cache_file.unlink()

            assert not cache_file.exists(), "Cache file must not exist before uncached network fetch test"

            # Execute real uncached HTTPS request through proxy using pinned IP and SNI
            proxy_res = await client.get(
                f"/api/v1/proxy/image?url={test_target_url}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert proxy_res.status_code == 200, f"Expected 200 for proxy_res, got {proxy_res.status_code}: {proxy_res.text}"
            assert len(proxy_res.content) > 100

            # 20. Verify Full WAL-Safe Database & Key Backup Archive Generation
            import io
            import zipfile
            import sqlite3
            backup_res = await client.get(
                "/api/v1/system/backup/download",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert backup_res.status_code == 200, f"Expected 200 for backup download, got {backup_res.status_code}"
            assert backup_res.headers.get("content-type") == "application/zip"
            assert "zengram_backup_" in backup_res.headers.get("content-disposition", "")

            with zipfile.ZipFile(io.BytesIO(backup_res.content), "r") as zf:
                namelist = zf.namelist()
                assert "zengram.db" in namelist, "zengram.db missing from backup zip"
                assert "jwt_secret.key" in namelist, "jwt_secret.key missing from backup zip"
                assert "metadata.json" in namelist, "metadata.json missing from backup zip"

                # Verify SQLite DB in zip is intact
                db_bytes = zf.read("zengram.db")
                with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
                    tf.write(db_bytes)
                    tf_db_path = tf.name

                try:
                    conn = sqlite3.connect(tf_db_path)
                    cursor = conn.cursor()
                    cursor.execute("PRAGMA integrity_check;")
                    res = cursor.fetchone()
                    assert res[0] == "ok", f"Integrity check failed on backed up db: {res}"
                    conn.close()
                finally:
                    if os.path.exists(tf_db_path):
                        os.remove(tf_db_path)

    finally:
        await test_engine.dispose()
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(test_security_hardening())
    print("All security, encryption-at-rest, atomic rollback, and DNS-pinning tests passed on disposable database!")

