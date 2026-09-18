# ZenGram - System Requirements & Dependencies Log

This document tracks all system, backend, and frontend dependencies required to run **ZenGram** across **Fedora Workstation / Server**, **Debian / Ubuntu / Proxmox LXC containers**, and other Linux distributions.

---

## 1. Supported Operating Systems & Environments

- **Fedora Linux**: Workstation / Server 40, 41, 42, 44+
- **Proxmox VE (LXC Containers)**: Debian 12 (Bookworm), Ubuntu 22.04 / 24.04 LTS
- **Debian / Ubuntu**: Debian 11+, Ubuntu 20.04+
- **Arch Linux / Manjaro**: Rolling release
- **Enterprise Linux (RHEL / AlmaLinux / Rocky Linux)**: 9.x+
- **Target Form Factor**: **Desktop Workstation Browsers (Desktop-First)**. Mobile-responsive layouts are not currently prioritized.

---

## 2. System Package Matrix by Distribution

| Component | Fedora / RHEL / Alma (`dnf`) | Debian / Ubuntu / Proxmox LXC (`apt`) | Arch Linux (`pacman`) | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Python 3** | `python3`, `python3-pip`, `python3-devel` | `python3`, `python3-pip`, `python3-venv`, `python3-dev` | `python`, `python-pip` | Async REST API & Scraper runtime |
| **Node.js & npm** | `nodejs`, `npm` (Node.js 20+ LTS) | `nodejs`, `npm` (NodeSource / apt) | `nodejs`, `npm` | Frontend UI build system (Vite + React) |
| **FFmpeg** | `ffmpeg` (RPM Fusion) | `ffmpeg` | `ffmpeg` | Video encoding, frame extraction, media repair |
| **SQLite 3** | `sqlite` | `sqlite3` | `sqlite` | Local database storage (WAL mode) |
| **Git** | `git` | `git` | `git` | Version control & update tracking |
| **Browser Runtime** | `playwright install chromium` | `playwright install --with-deps chromium` | `playwright install chromium` | Headless browser automation for complex sessions |

---

## 3. Headless & Proxmox LXC Container Considerations

When running inside a headless Proxmox LXC container or server:
1. **Network Binding (`--host 0.0.0.0`)**:
   - The Uvicorn backend must bind to `0.0.0.0` so the web interface can be accessed across your local network (`http://<LXC_IP>:8484`).
2. **Playwright in Containers (`--no-sandbox`)**:
   - Playwright Chromium is executed with `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage` to run reliably inside unprivileged or privileged LXC containers.
3. **Headless Installation (No GUI)**:
   - The installer automatically detects if a desktop environment is missing and skips `.desktop` desktop shortcut creation without error.
4. **Systemd Services (Root vs User)**:
   - In Proxmox LXC containers running as `root`, the service is installed as a system-level unit (`/etc/systemd/system/zengram.service`).
   - On desktop workstations running as regular users, the service is installed as a user unit (`~/.config/systemd/user/zengram.service`).

---

## 4. Backend Dependencies (`backend/requirements.txt`)

| Package | Minimum Version | Purpose |
| :--- | :--- | :--- |
| `fastapi` | `>=0.110.0` | Async web framework for REST API |
| `uvicorn[standard]` | `>=0.28.0` | High-performance ASGI web server |
| `pydantic` | `>=2.6.0` | Data parsing and validation schemas |
| `pydantic-settings` | `>=2.2.0` | Environment and settings management |
| `httpx[http2]` | `>=0.27.0` | Async HTTP/2 client for high-speed scraping |
| `instaloader` | `>=4.10.0` | Secondary Instagram media probe engine |
| `playwright` | `>=1.42.0` | Headless Chromium browser automation |
| `sqlalchemy` | `>=2.0.0` | Async ORM database interface |
| `aiosqlite` | `>=0.20.0` | Async SQLite driver with WAL support |
| `pillow` | `>=10.2.0` | Image thumbnail processing & metadata extraction |
| `python-multipart` | `>=0.0.9` | Multipart form data support for file uploads |

---

## 5. Frontend Dependencies (`frontend/package.json`)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `react` & `react-dom` | `^18.2.0` | Reactive UI framework |
| `vite` | `^5.4.0` | High-speed frontend development and bundler |
| `lucide-react` | `^0.359.0` | Clean, modern vector icon set |
| `@vitejs/plugin-react` | `^4.2.1` | Fast React JSX transformation plugin |

---

## 6. Version Tracking & Upgrades

ZenGram includes a built-in **Version Tracker**:
- Query current version and commit status via `GET /api/v1/system/version`.
- Trigger live upstream checks via `POST /api/v1/system/check-update`.
- Upgrade in place using `./install.sh --update`.
