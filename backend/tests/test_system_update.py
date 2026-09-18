import os
import sys
import tempfile
import asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Configure isolated disposable SQLite database for tests
temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db_file.name
temp_db_file.close()

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{temp_db_path}"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.main import app
import backend.app.database as db_module
from backend.app.models import Base
from backend.app.auth_utils import create_access_token

# Rebind test engine to disposable SQLite database
test_engine = create_async_engine(f"sqlite+aiosqlite:///{temp_db_path}", echo=False)
db_module.engine = test_engine
db_module.AsyncSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def test_version_and_update_endpoints():
    try:
        # Initialize disposable tables
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Setup master admin
            setup_res = await client.post("/api/v1/auth/setup", json={
                "username": "admin",
                "password": "master_admin_pwd_123"
            })
            assert setup_res.status_code == 200

            # 2. Clear cookies - test unauthenticated requests must return 401
            client.cookies.clear()
            res_unauth_ver = await client.get("/api/v1/system/version")
            assert res_unauth_ver.status_code == 401

            res_unauth_apply = await client.post("/api/v1/system/apply-update")
            assert res_unauth_apply.status_code == 401

            res_unauth_status = await client.get("/api/v1/system/update-status")
            assert res_unauth_status.status_code == 401

            # 3. Authenticated requests with admin JWT
            token = create_access_token({"sub": "admin"})
            client.cookies.set("zengram_token", token)

            # /version
            res = await client.get("/api/v1/system/version")
            assert res.status_code == 200
            data = res.json()
            assert "version" in data
            assert "commit_hash" in data
            assert "pending_commits" in data
            assert isinstance(data["pending_commits"], list)
            assert "update_available" in data

            # /check-update
            res_check = await client.post("/api/v1/system/check-update")
            assert res_check.status_code == 200
            check_data = res_check.json()
            assert "version" in check_data

            # /update-status
            res_auth_status = await client.get("/api/v1/system/update-status")
            assert res_auth_status.status_code == 200
            status_data = res_auth_status.json()
            assert "status" in status_data
            assert "progress_percent" in status_data
            assert "current_stage" in status_data
            assert "logs" in status_data

            print("All system version & update endpoints verified successfully on disposable database!")

    finally:
        await test_engine.dispose()
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(test_version_and_update_endpoints())
