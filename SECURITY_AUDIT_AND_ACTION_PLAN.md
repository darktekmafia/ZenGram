# ZenGram Security Audit & Hardening Action Plan
**Date:** September 18, 2026  
**Status:** Queued for Next Session (No code changes applied yet)

---

## 🔍 Executive Summary & Identified Vulnerabilities

Based on the source code review, terminal testing, and chat diagnostics, the following vulnerabilities and security issues have been identified:

### 1. 🚨 Unauthenticated Instagram Session & Credential Extraction (`CRITICAL`)
* **Location:** [`backend/app/api/auth.py`](file:///run/media/psychlone/Projects/InstaSave/backend/app/api/auth.py)
* **Vulnerability:** 
  - `GET /api/v1/auth/session` is not protected by the `get_current_admin` authentication dependency.
  - The response schema [`UserSessionResponse`](file:///run/media/psychlone/Projects/InstaSave/backend/app/schemas.py) includes `session_cookie: Optional[str] = None`, which returns the plaintext Instagram `sessionid` cookie to any unauthenticated HTTP requester.
  - `POST /api/v1/auth/session`, `POST /api/v1/auth/session/test`, `POST /api/v1/auth/session/refresh-avatar`, `POST /api/v1/auth/interactive-login`, `GET /api/v1/auth/interactive-login/status`, and `POST /api/v1/auth/interactive-login/cancel` also lack `Depends(get_current_admin)` protection.
  - `/interactive-login/status` also returns `session_cookie` in plaintext in its status payload dictionary.
* **Impact:** Anyone capable of sending an HTTP request to port `8484` (or via an unauthenticated reverse proxy) can retrieve or overwrite the user's active Instagram session credentials.

---

### 2. 🛡️ Unauthenticated Image Proxy / SSRF Vector (`HIGH`)
* **Location:** [`backend/app/main.py`](file:///run/media/psychlone/Projects/InstaSave/backend/app/main.py#L90-L184)
* **Vulnerability:** `GET /api/v1/proxy/image` accepts arbitrary target URLs (`url` or `b64`) and executes server-side HTTP `GET` requests without authentication.
* **Impact:** Can be abused as an open proxy or Server-Side Request Forgery (SSRF) vector against internal network devices or external services.

---

### 3. 🗄️ Database & Secret File System Permissions (`MEDIUM`)
* **Location:** `zengram.db`, `zengram.db-wal`, `zengram.db-shm`, and `~/.config/zengram/jwt_secret.key`
* **Vulnerability:** 
  - SQLite database files default to `0644` (world-readable by other local users on multi-user systems if directory traversal is permitted).
* **Mitigating Factors:** On standard LXC root installations, `/root` is `0700`, which blocks traversal; however, dedicated service accounts or standard workstation user directories need strict `0600` permissions.

---

## 🛠️ Step-by-Step Remediation Plan (For Next Session)

### Phase 1: Backend Auth Enforcement & Secret Redaction

1. **Protect All Sensitive Endpoints in [`backend/app/api/auth.py`](file:///run/media/psychlone/Projects/InstaSave/backend/app/api/auth.py):**
   - Add `current_admin: AdminUser = Depends(get_current_admin)` to:
     - `GET /api/v1/auth/session`
     - `POST /api/v1/auth/session`
     - `POST /api/v1/auth/session/refresh-avatar`
     - `POST /api/v1/auth/session/test`
     - `GET /api/v1/auth/display-info`
     - `POST /api/v1/auth/interactive-login`
     - `GET /api/v1/auth/interactive-login/status`
     - `POST /api/v1/auth/interactive-login/cancel`
   - Only allow `/auth/status`, `/auth/setup`, and `/auth/login` to be accessed unauthenticated.

2. **Redact Credentials in API Schemas ([`backend/app/schemas.py`](file:///run/media/psychlone/Projects/InstaSave/backend/app/schemas.py)):**
   - In `UserSessionResponse`:
     - **Remove** `session_cookie: Optional[str] = None`.
     - **Add** `has_session_cookie: bool = False` and `masked_cookie: Optional[str] = None` (e.g. `••••••••••••`).
   - In `/interactive-login/status`:
     - Remove `session_cookie` from the returned JSON response dictionary.
   - In `POST /api/v1/auth/session/test`:
     - Allow testing the *currently saved* backend session cookie when no new cookie is explicitly supplied in the request body.

3. **Secure Image Proxy ([`backend/app/main.py`](file:///run/media/psychlone/Projects/InstaSave/backend/app/main.py)):**
   - Add `dependencies=[Depends(get_current_admin)]` or validate domain whitelist (e.g., only allow `*.cdninstagram.com`, `*.fbcdn.net`, `*.instagram.com`).

---

### Phase 2: Frontend Adjustments ([`frontend/src/App.jsx`](file:///run/media/psychlone/Projects/InstaSave/frontend/src/App.jsx))

1. **Decouple Frontend from Raw Secret Retrieval:**
   - Update `fetchUserSession`:
     - Do not expect or store the raw `session_cookie` in state (`setSessionInput('')`).
     - Display a masked badge or placeholder (e.g. `"•••••••••••• (Active Session Configured)"`) when `data.has_session_cookie` is true.
   - Update `handleSaveSession` and `handleTestSession`:
     - If the user leaves the input blank and clicks "Test Session", have the backend test the existing stored cookie.
     - Only send a new `session_cookie` when the user actively types or pastes a new one.

---

### Phase 3: Filesystem & Installer Security Hardening ([`install.sh`](file:///run/media/psychlone/Projects/InstaSave/install.sh))

1. **Database & Secret File Permissions:**
   - Add `chmod 600` for `zengram.db`, `zengram.db-wal`, and `zengram.db-shm` during database initialization and install steps.
   - Ensure `~/.config/zengram/` has `chmod 700` and `jwt_secret.key` has `chmod 600`.
   - Ensure `umask 077` is set in the systemd service or python runner.

---

### Phase 4: Verification & Instagram Session Rotation

1. **Automated & Manual Security Testing:**
   - Run `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8484/api/v1/auth/session` without auth & verify HTTP `401 Unauthorized`.
   - Log into the web interface, verify cookie setting, and verify all features (feed, tracked profiles, batch downloads) work seamlessly.
2. **Rotate Instagram Session:**
   - Once patches are deployed, log out and log back into Instagram to invalidate the previous `sessionid`, and save the fresh cookie in ZenGram.
3. **Update README:**
   - Remove the caution banner from `README.md` once hardening is verified and pushed.
