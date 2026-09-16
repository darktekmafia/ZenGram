# InstaSave - Instagram Content Archiver & Media Downloader

**InstaSave** is a modern, high-performance local web application and desktop tool designed for Fedora Linux (and modern Linux distributions) to browse, download, and archive Instagram media (Photos, Videos, Reels, Carousels, and 24h Stories) with zero rate blocks and local storage integrity.

![InstaSave](assets/instasave.svg)

---

## 🌟 Key Features

- **Media Feed & Archiver**: Browse media from followed accounts and unfollowed tracked profiles with real-time stats (likes, comments, timestamps).
- **Interactive Multi-Slide Carousels**:
  - Full carousel navigation with Next/Previous slide controls and slide counters (`Slide X of Y`).
  - Seamless support for mixed-media carousels (combining photos and video slides).
  - Single-slide download, active slide deletion, or bulk `.zip` download of entire carousels.
- **Embedded & On-Demand Video Player**:
  - Live video streaming directly within post cards using progressive HTML5 `<video>` controls.
  - Centered glassmorphism Play button overlay on video thumbnails with automatic stream fetching.
  - Instant local playback for archived videos with zero latency.
- **Followed & Unfollowed Profile Management**:
  - One-click **Sync Followed Accounts** to automatically import accounts followed by your Instagram session.
  - Track public Instagram accounts without following them on Instagram.
  - Automatic profile picture proxying (`/api/v1/proxy/image`) to bypass Instagram CDN referrer/CORS blocks.
- **Batch Archiving & Download Queue**:
  - Configurable batch downloader allowing users to archive up to N posts per account or specific post ranges.
  - Real-time Task Queue tab tracking active, completed, and pending download jobs.
  - Parallel download worker controls (1 to 8 workers, configurable in Settings).
  - Queue capacity limits (configurable in Settings).
- **Live Terminal & Console**:
  - Real-time in-app live terminal viewer to monitor scraper and downloader logs directly from the UI.
- **Systemd & Desktop Integration**:
  - Automatic background service via `instasave.service` (`systemctl --user`).
  - Native GNOME application shortcut (`InstaSave.desktop`).

---

## 🏗️ Architecture

- **Backend**:
  - **FastAPI** (Python 3.12+ async REST API).
  - **SQLAlchemy** + **aiosqlite** with SQLite WAL mode.
  - **Playwright** + **Instaloader** + direct probe engine for robust multi-layer Instagram media extraction.
  - Stream integrity validation checking file magic bytes (`ftyp` MP4, `\xff\xd8\xff` JPEG, `moof` DASH rejection).
- **Frontend**:
  - **React** (Vite build) with custom Vanilla CSS design system.
  - Dark-mode glassmorphism aesthetic with Lucide icons.
  - Client-side proxying and state management.

---

## 🚀 Installation & Quick Start

### 1. Automated Installation (Fedora 44 / Linux)

Run the included installer script:

```bash
chmod +x install.sh
./install.sh
```

The installer will:
1. Verify and install system dependencies (`python3`, `nodejs`, `npm`, `ffmpeg`, `sqlite3`).
2. Create and populate the Python virtual environment (`.venv`).
3. Install frontend packages and compile the production bundle (`dist/`).
4. Register and enable the Systemd user service (`instasave.service`).
5. Install the desktop launcher to `~/Desktop/InstaSave.desktop` and `~/.local/share/applications/`.

### 2. Accessing the Web UI

Open your browser and navigate to:
```
http://localhost:8484
```

---

## ⚙️ Configuration & Settings

All settings can be customized through the **Settings** page in the web UI:

| Setting | Description | Default |
| :--- | :--- | :--- |
| **Download Storage Directory** | Local directory where archived media files are stored | `~/Downloads/InstaSave` |
| **Session Cookie (`sessionid`)** | Instagram session cookie for accessing high-res feeds and followed accounts | Configurable in UI |
| **Parallel Download Workers** | Number of simultaneous background download workers (1–8) | `2` |
| **Max Queue Capacity** | Maximum pending tasks in the download queue | `50` |
| **Rate Limit Delay** | Safety delay between Instagram scraping requests (seconds) | `3.0s` |

---

## 🛠️ Updating InstaSave

To update and rebuild the project after making code changes:

```bash
./install.sh --update
```

Or manually:
```bash
cd frontend && npm run build && cd ..
systemctl --user restart instasave.service
```

---

## 📄 License

Internal / Private Project. Developed with Google DeepMind Antigravity.
