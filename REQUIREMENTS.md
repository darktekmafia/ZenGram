# InstaSave - System Requirements & Dependencies Log

This document tracks all system, backend, and frontend dependencies required to run **InstaSave** on **Fedora Linux 44 Workstation**.

---

## 1. System Dependencies (Fedora 44 / `dnf`)

| Dependency | Minimum Version | Package Name | Purpose |
| :--- | :--- | :--- | :--- |
| **Python** | 3.12+ | `python3`, `python3-pip`, `python3-devel` | Core Async API & Scraper Engine |
| **Node.js** | 20+ | `nodejs`, `npm` | Frontend UI build system (Vite + React) |
| **FFmpeg** | Latest | `ffmpeg` (RPM Fusion) | Video stitching, audio extraction, audio/video encoding |
| **SQLite** | 3+ | Built-in / `sqlite` | Lightweight local database engine |
| **Playwright / Chromium** | Latest | Chromium browser | Headless browser automation for complex 2FA / Session handling |
| **Git & Systemd** | Native | `git`, `systemd` | Version control & background desktop service management |

---

## 2. Backend Dependencies (Python Virtual Environment)

| Package | Purpose |
| :--- | :--- |
| `fastapi` | Async web framework for backend REST API |
| `uvicorn[standard]` | ASGI web server |
| `pydantic` | Configuration & schema data validation |
| `httpx[http2]` | High-performance async HTTP client |
| `instaloader` | Instagram media extraction engine |
| `playwright` | Browser automation engine for fallback auth/scraping |
| `sqlalchemy` + `aiosqlite` | Async ORM database interface |
| `apscheduler` | Background job scheduler (profile syncs) |
| `pillow` | Image thumbnail processing & metadata |

---

## 3. Frontend Dependencies (Node.js / npm)

| Package | Purpose |
| :--- | :--- |
| `vite` | Ultra-fast frontend build tool |
| `react` + `react-dom` | Reactive component UI library |
| `lucide-react` | Icons for dark-mode UI |
| `@tanstack/react-query` | Server state management & caching |

---

## 4. Installation & Update Strategy

- **Local Git Repository (`git init`):** Initialized directly on Fedora workstation (`/run/media/psychlone/Projects/InstaSave`).
- **Installer Script (`install.sh`):** Handles DNF dependency checks, virtualenv creation, database migration, interactive configuration prompts, systemd user service registration (`systemctl --user enable instasave`), and update execution (`./install.sh --update`).
- **Remote Migration Target:** GitHub repository integration when ready for public/private distribution.
