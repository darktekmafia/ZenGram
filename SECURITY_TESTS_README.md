# ZenGram Security & Hardening Test Suite Guide

This guide explains the architecture, execution, and output of ZenGram's automated security and regression test suite (`backend/tests/test_security.py`).

---

## 🛡️ Overview & Safety

The security test suite is designed to be executed safely in any environment (local workstation, continuous integration, headless servers, and Proxmox LXC containers).

* **100% Disposable & Isolated**: Every test run generates a temporary, in-memory/isolated SQLite database (`tempfile.NamedTemporaryFile`). It **never modifies or touches your live production database (`zengram.db`) or your saved media files**.
* **Automatic Teardown**: Upon test completion or unexpected termination, all temporary database files, test keys, and ephemeral network sockets are automatically destroyed.
* **Zero Downtime**: You can safely run this test suite while your live `zengram.service` is actively serving traffic.

---

## 🔍 Understanding the Test Output

When running the security check, you will see the following output in the diagnostic console:

```text
(.venv) root@ZenGram:~/ZenGram# python backend/tests/test_security.py
FATAL: Decryption failed for encrypted credential. The current key at /root/.config/zengram/jwt_secret.key does not match the key used to encrypt this database.
FATAL: Database credential verification or migration failed. Check secret key configuration and directory permissions.
All security, encryption-at-rest, atomic rollback, and DNS-pinning tests passed on disposable database!
```

### Why do "FATAL" error messages appear during a successful test?

In robust security engineering, **negative test cases (intentional fault injection)** are essential. To prove that security defenses actually work, the test suite actively attacks the application with corrupted data, mismatched keys, and simulated system crashes:

1. **First "FATAL" Message (Test #15: Key Tampering & Fail-Closed Defense)**:
   * **What happens**: The test deliberately feeds a corrupt, mismatched encryption payload into the decryption engine.
   * **What it verifies**: It confirms that if someone replaces the encryption key, tampers with database files, or attempts a forgery attack, ZenGram **immediately fails closed** and logs a critical alert, rather than crashing silently, leaking partial plaintext, or returning invalid data.
2. **Second "FATAL" Message (Test #17: Atomic Migration Failure & Rollback)**:
   * **What happens**: The test injects a simulated disk failure in the middle of a multi-row database migration.
   * **What it verifies**: It confirms that if a migration is interrupted or fails midway, SQLite executes an **atomic rollback** (`BEGIN ... ROLLBACK`) so no half-migrated or corrupted records remain in the database.

> [!NOTE]
> **The Key Success Indicator**:
> As long as the final line displays:
> `All security, encryption-at-rest, atomic rollback, and DNS-pinning tests passed on disposable database!`
> and the process exits with **code 0**, **all 20 security suites have successfully passed**. If any security boundary failed or leaked plaintext, Python would raise an `AssertionError` and abort the process immediately.

---

## 📋 Comprehensive Breakdown of All 20 Security Test Suites

The test suite exercises 20 dedicated security boundaries:

| # | Test Suite | What It Validates |
| :--- | :--- | :--- |
| **1** | **Uninitialized Setup Detection** | Ensures unconfigured instances identify that setup is required and block normal operations until master credentials are created. |
| **2** | **Master Administrator Provisioning** | Verifies salted Bcrypt password hashing (`rounds=12`) and secure storage of administrative credentials. |
| **3** | **Unauthenticated Endpoint Lockdown** | Confirms that all REST endpoints (profiles, feeds, settings, updates, backups, etc.) reject unauthenticated requests with `HTTP 401 Unauthorized`. |
| **4** | **Public Endpoint Accessibility** | Ensures public health checks (`/health`) and setup status probes remain accessible without leaking internal state. |
| **5** | **Cryptographic JWT Token Validation** | Validates signed JSON Web Tokens (`HS256`), token expiration timestamps, and cookie/header transport. |
| **6** | **Credential & Secret Redaction** | Verifies that sensitive Instagram session cookies are **never returned in plaintext** across any API endpoint (only masked versions such as `sess_...abc` are returned). |
| **7** | **SSRF & Local Subnet Blocking** | Ensures the image proxy rejects loopback (`127.0.0.1`, `localhost`), cloud metadata services (`169.254.169.254`), private RFC1918 subnets (`192.168.x.x`, `10.x.x.x`), and unauthorized external domains. |
| **8** | **Dual-Mode Guest Browsing Isolation** | When guest mode is enabled (`auth_enabled=False`), verifies public media viewing is permitted while all settings, credentials, and updater controls remain strictly locked behind administrator auth. |
| **9** | **Transparent AES-256 Encryption at Rest** | Verifies that sensitive session credentials stored in SQLite are encrypted with AES-256 Fernet (`enc:...`) on disk, while decrypting transparently only inside Python memory. |
| **10** | **Automatic Legacy Plaintext Migration** | Verifies that legacy, unencrypted database sessions are automatically and transparently migrated to AES-256 ciphertext upon server startup. |
| **11** | **Unresolvable DNS Fail-Closed Protection** | Confirms that unresolvable domains or DNS lookup failures immediately fail closed and return an error without leaking socket exceptions. |
| **12** | **URL Parser & Scheme Hardening** | Rejects non-HTTP schemes (`ftp://`, `file:///etc/passwd`), embedded URL credentials (`user:pass@host`), and arbitrary non-standard ports. |
| **13** | **Cache Key Collision Resistance** | Ensures SHA-256 disk cache keys for proximate images with differing query tokens or signatures never collide or overwrite each other. |
| **14** | **Encryption Helper Fail-Closed Safety** | Validates internal cryptographic helper functions fail closed if unencrypted data or improper structures are supplied. |
| **15** | **Key Mismatch / Corrupted Ciphertext Detection** | *(Emits 1st FATAL log)* Injects invalid ciphertext and verifies that key mismatches raise explicit runtime errors and refuse decryption. |
| **16** | **DNS Rebinding & IP Pinning Defense** | Ensures proxy requests resolve DNS once, validate the resolved IP against private address blacklists, and pin the target IP for the HTTP connection using TLS Server Name Indication (SNI). |
| **17** | **Atomic Migration Rollback on Failure** | *(Emits 2nd FATAL log)* Simulates an error during batch encryption and verifies that SQLite rolls back the entire transaction rather than leaving partial unencrypted data. |
| **18** | **Multi-Hop Relative Redirect Path Resolution** | Validates URL path normalization across complex nested relative redirect chains (`../` and subpaths) to prevent path traversal attacks. |
| **19** | **End-to-End Pinned Proxy Network Fetch** | Performs a live, TLS-verified outbound request to an approved CDN asset with an empty disk cache, verifying end-to-end caching and image delivery. |
| **20** | **Full WAL-Safe Database & Key Backup Generator** | Generates a complete backup `.zip` bundle, unpacks it in memory, validates the presence of `zengram.db`, `jwt_secret.key`, and `metadata.json`, and executes SQLite `PRAGMA integrity_check;` to verify database consistency. |

---

## 🚀 How to Run the Security Test Suite

### 1. 1-Click In-App Diagnostic Runner (Web UI)

Inside the web interface:
1. Open **Settings ➔ Master Security & Web Access Control**.
2. Scroll to **Security & Hardening Diagnostic Runner** and click **"Run Security Check Now"**.
3. ZenGram will asynchronously execute all 20 test suites on a temporary in-memory database and stream real-time logs and pass/fail stage indicators directly inside the interactive diagnostic modal.

### 2. Workstation / Desktop Terminal (Non-Root User)

```bash
cd /path/to/ZenGram
source .venv/bin/activate
python backend/tests/test_security.py
```

### 3. Headless Server / Proxmox LXC Container Terminal (Root User)

```bash
cd /root/ZenGram
source .venv/bin/activate
python backend/tests/test_security.py
```

### 4. Direct CLI One-Liner (Without Activating Shell Venv)

```bash
PYTHONPATH=. .venv/bin/python backend/tests/test_security.py
```

---

## 🔒 Key Security Architecture Principles in ZenGram

1. **Hardware & OS Key Isolation**:
   * ZenGram derives its encryption keys from `~/.config/zengram/jwt_secret.key`.
   * This key file is created with strict POSIX permissions (`chmod 0600`), readable only by the owner process.
2. **Zero-Trust Image Proxy**:
   * Media URLs are never fetched blindly. Every request is resolved to an IP, validated against private IP blocklists, and pinned to prevent DNS rebinding attacks against your home network.
3. **Defense in Depth**:
   * Even if a malicious actor gains physical access to a copy of `zengram.db`, they cannot decrypt your Instagram session cookies without the hardware-isolated `jwt_secret.key` file stored outside the repository.
