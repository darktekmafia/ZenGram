# ZenGram - Distraction-Free Instagram Media Archiver & Feed Viewer

**ZenGram** is a self-hosted, lightweight, and high-performance local web application designed for Linux (Fedora, Debian, Ubuntu, Proxmox LXC containers, and Arch Linux) to browse, archive, and save Instagram media (Photos, Videos, Reels, Multi-slide Carousels, and 24h Stories) with zero ads, true chronological ordering, and local storage integrity.

![ZenGram](assets/instasave.svg)

---

## 🌟 Key Features

- **Distraction-Free Chronological Feed**:
  - Displays media exclusively from your followed accounts, sorted chronologically (**newest post first**) across all accounts using precise Instagram Snowflake timestamp decoding.
  - No algorithms, no ads, and no sponsored account injection.
  - Automatically isolates Tracked Accounts from the main feed to keep your daily dashboard uncluttered.
- **Dedicated Tracked Accounts Manager (Unfollowed)**:
  - Browse and archive public accounts without following them on Instagram.
  - **Bulk Import**: Import dozens of accounts simultaneously via single handle, multi-line text input (supporting spaces, commas, newlines, and URLs), or `.txt`/`.csv` file upload.
  - **High-Res Profile Photo Scraping**: Extracts authentic profile avatars with local image caching.
- **High-Performance Server-Side Pagination**:
  - Sub-25ms response times across tens of thousands of saved posts and feed records.
  - Seamless infinite scrolling and chunk loading powered by `IntersectionObserver`.
- **Interactive Multi-Slide Carousels & Video Player**:
  - Full carousel navigation with Next/Previous slide controls and slide counters (`Slide X of Y`).
  - Seamless support for mixed-media carousels (combining photos and video slides).
  - Single-slide download, active slide deletion, or bulk `.zip` download of entire carousels.
  - Progressive HTML5 `<video>` player with on-demand playback (no annoying autoplay on hover).
- **Batch Archiving & Download Queue**:
  - Configurable batch downloader allowing users to archive up to N posts per account or specific post ranges.
  - Real-time Task Queue tab tracking active, completed, and pending download jobs.
  - Parallel download worker controls (1 to 8 workers, configurable in Settings).
  - Live in-app terminal console to monitor scraper and downloader events in real-time.
- **Real-Time System Resource Telemetry**:
  - Built-in live CPU, RAM, Swap, and Disk volume meters.
  - Automatic detection of Proxmox LXC containers, Docker, and Host environments.
- **Master Security & Access Control**:
  - Master password protection and cryptographically signed session tokens stored in secure `HttpOnly` cookies.
  - Protects direct LAN / reverse proxy setups (such as Nginx Proxy Manager / Cloudflare Tunnels).

---

## 🏗️ Architecture & Requirements

- **Backend**:
  - **FastAPI** (Python 3.12+ async REST API).
  - **SQLAlchemy** + **aiosqlite** with SQLite WAL mode.
  - **Playwright** + **Instaloader** + direct probe engine.
  - **psutil** for lightweight container & hardware resource telemetry.
- **Frontend**:
  - **React** (Vite build) with custom Vanilla CSS design system.
  - Dark-mode glassmorphism aesthetic with Lucide icons.
- **System Footprint (LXC & Low-Spec Friendly)**:
  - **RAM**: ~170 MB – 250 MB idle (~350 MB under active batch downloads).
  - **Recommended LXC Allocation**: 2 GB RAM, 2 Cores (Intel / AMD x86_64 or ARM64).

---

## 🚀 Installation & Quick Start

### 1. Automated Installation

Run the included installer script:

```bash
chmod +x install.sh
./install.sh
```

For headless servers or Proxmox LXC containers (skips desktop shortcuts):
```bash
./install.sh --no-desktop
```

The installer will:
1. Detect distribution package manager (`dnf`, `apt`, `pacman`, `zypper`) and verify system dependencies.
2. Initialize the Python virtual environment (`.venv`) and install dependencies.
3. Install frontend packages and compile the production bundle (`frontend/dist/`).
4. Register and enable the Systemd service (`zengram.service`).
5. Install desktop launchers (if GUI environment is present).

### 2. Accessing the Web UI

Open your browser and navigate to:
```
http://localhost:8484
```
*(Or your server/LXC container's IP on port 8484)*

---

## ⚙️ Configuration & Settings

All settings can be customized through the **Settings** page in the web UI:

| Setting | Description | Default |
| :--- | :--- | :--- |
| **Download Storage Directory** | Local directory where archived media files are stored | `~/Downloads/ZenGram` |
| **Session Cookie (`sessionid`)** | Instagram session cookie for accessing high-res feeds and followed accounts | Configurable in UI |
| **Parallel Download Workers** | Number of simultaneous background download workers (1–8) | `2` |
| **Max Queue Capacity** | Maximum pending tasks in the download queue | `8` |
| **Rate Limit Delay** | Safety delay between Instagram scraping requests (seconds) | `3.0s` |

---

## 🛠️ Updating ZenGram

To update, pull new changes, and rebuild:

```bash
./install.sh --update
```

Or manually:
```bash
cd frontend && npm run build && cd ..
systemctl --user restart zengram.service
```

---

## ⚖️ Legal Disclaimer & Terms of Use

**ZenGram** is an open-source software project developed exclusively for personal data backup, archival research, and educational purposes.

### 1. Non-Affiliation
This project is an independent, community-driven tool and is **not affiliated, associated, authorized, endorsed by, or in any way officially connected with Instagram, Meta Platforms, Inc., or any of their subsidiaries or affiliates**. The official Instagram website is accessible at [instagram.com](https://www.instagram.com).

### 2. Personal Archiving & Fair Use
* This tool is intended for users to backup their own content, save media with permission, or archive publicly accessible media for non-commercial, personal, and research purposes under applicable **Fair Use** principles.
* This software is **not intended for copyright infringement, commercial distribution, or violating the privacy of individuals**. Users are solely responsible for ensuring that their download and archival activities comply with local copyright laws, intellectual property rights, and data protection regulations.

### 3. Terms of Service & Account Safety
* Automated data retrieval may be subject to platform Terms of Service.
* The developers and contributors of this project assume **no liability and are not responsible for any misuse, account restrictions, temporary checkpoints, or consequences** resulting from the use of this software.
* Users are advised to use reasonable rate limits (enforced by default within the application engine) and exercise caution when managing personal session credentials.

---

## 📄 License

Open-source under the MIT License.
