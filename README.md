# InstaSave - Instagram Content Archiver & Media Downloader

**InstaSave** is a modern, high-performance local web application and desktop tool designed for Fedora Linux (and modern Linux distributions) to browse, download, and archive Instagram media (Photos, Videos, Reels, Carousels, and 24h Stories) with zero rate blocks and local storage integrity.

![InstaSave](assets/instasave.svg)

---

## 🌟 Key Features

- **Chronological Feed (Followed Accounts Only)**:
  - Displays media exclusively from your followed accounts, sorted chronologically (**newest post first**) across all accounts using precise Instagram Snowflake timestamp decoding.
  - Automatically isolates Tracked Accounts from the main feed to keep your daily dashboard uncluttered.
- **Dedicated Tracked Accounts Manager**:
  - Browse and archive public accounts without following them on Instagram.
  - **Bulk Import**: Import dozens of accounts simultaneously via single handle, multi-line text input (supporting spaces, commas, newlines, and URLs), or `.txt`/`.csv` file upload.
  - **High-Res Profile Photo Scraping**: Robust scraping engine extracts authentic profile avatars without sidebar collisions with the logged-in user's profile icon.
- **Interactive Multi-Slide Carousels**:
  - Full carousel navigation with Next/Previous slide controls and slide counters (`Slide X of Y`).
  - Seamless support for mixed-media carousels (combining photos and video slides).
  - Single-slide download, active slide deletion, or bulk `.zip` download of entire carousels.
- **Embedded & On-Demand Video Player**:
  - Progressive HTML5 `<video>` player with on-demand playback (no annoying autoplay on hover).
  - Default playback volume set to muted / safe low volume.
  - Correct video thumbnail extraction and display for both live feed and saved downloads.
  - Instant local playback for archived videos with zero latency.
- **Followed Account Sync**:
  - One-click **Sync Followed Accounts** to automatically import accounts followed by your Instagram session.
  - Automatic profile picture proxying (`/api/v1/proxy/image`) to bypass Instagram CDN referrer/CORS blocks.
- **Batch Archiving & Download Queue**:
  - Configurable batch downloader allowing users to archive up to N posts per account or specific post ranges.
  - Real-time Task Queue tab tracking active, completed, and pending download jobs.
  - Parallel download worker controls (1 to 8 workers, configurable in Settings).
  - Queue capacity limits (configurable in Settings).
- **Live Terminal & Console Docking**:
  - Real-time in-app live terminal viewer to monitor scraper and downloader logs directly from the UI.
  - Dockable console mode with instant restore and maximize options.
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
