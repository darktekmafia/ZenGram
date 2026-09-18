# ZenGram - Distraction-Free Instagram Media Archiver & Feed Viewer

**ZenGram** is a self-hosted Instagram feed viewer and personal media archiver designed to put you back in control of your feed. Browse followed accounts chronologically, separate high-volume accounts from your daily feed, and preserve media locally, all without advertisements, suggested posts, or algorithmic recommendations.

![ZenGram](assets/zengram.svg)

---

## 🌟 Key Features

- **Distraction-Free Chronological Feed**:
  - Displays media exclusively from your followed accounts, sorted chronologically (**newest post first**) across all accounts using precise Instagram Snowflake timestamp decoding.
  - No algorithms, no ads, and no sponsored account injection.
  - Automatically isolates Tracked Accounts from the main feed to keep your daily dashboard uncluttered.
- **Automated Background Feed Crawler & Incremental Delta Checkpointing**:
  - **Sub-Second Delta Sync**: Automatically halts scraper pagination as soon as known local posts are encountered (`known_shortcodes` & `stop_at_shortcode`), cutting sync times from 20+ seconds down to ~1–2 seconds.
  - **Full Sync on Demand**: Scans recent media (posts, reels, stories) across all followed accounts in non-blocking background workers with live progress indicators.
  - **Periodic Auto-Sync**: Background timer automatically crawls fresh posts on a configurable schedule (default: every 6 hours).
  - **Rate-Limit Safe**: Polite jittered request pacing and quota tracking keep your Instagram session healthy.
- **Story Highlights Viewer & Bulk Archiver**:
  - **Highlights Carousel**: Displays permanent Story Highlight reels directly above creator feeds with circular gradient rings, live cover thumbnails, and story count badges.
  - **Interactive Story Viewer**: Fullscreen story player with segment progress bars, video audio controls, and keyboard navigation.
  - **Album & Slide Saving**: 1-click download of individual stories or entire highlight albums into organized `Highlights/<Album_Title>/` folders.
  - **Batch Download Integration**: Optional toggle in the Batch Config modal to include or exclude highlight albums during bulk account archiving.
- **Fullscreen Lightbox Gallery & Custom Media Player**:
  - **Zero-Crop Canvas**: High-resolution viewport canvas (`object-fit: contain`) for uncropped photos, videos, and multi-slide carousels.
  - **Interactive Photo Zoom & Pan**: Multi-level zoom (`1x`, `1.75x`, `2.5x`, `3.0x`), double-click toggle, and smooth mouse drag-panning.
  - **Custom HTML5 Video Controls**: Volume memory, progress scrubbing, and playback speed adjustments (`0.5x`, `1.0x`, `1.5x`, `2.0x`).
  - **Fast Post-to-Post Rail Navigation**: Browse seamlessly between posts via keyboard shortcuts (`[` / `]` and `Shift + ArrowLeft/Right`).
  - **Metadata Drawer**: Collapsible sidebar with creator avatar, formatted dates, full caption, likes & comments stats, and quick-save actions.
- **Dual Feed Display: Infinite Scroll & Numbered Pagination**:
  - **User-Selectable Navigation**: Switch between seamless **Continuous Infinite Scroll** or classic **Numbered Pagination** (`Page 1, 2, 3...` with 24, 36, 48, or 96 items per page) to eliminate browser RAM strain when viewing large profiles.
  - **Persistent Settings**: Selected display preference is saved across sessions.
- **Dedicated Tracked Accounts Manager (Unfollowed)**:
  - Browse and archive public accounts without following them on Instagram.
  - **Bulk Import**: Import dozens of accounts simultaneously via single handle, multi-line text input (supporting spaces, commas, newlines, and URLs), or `.txt`/`.csv` file upload.
  - **High-Res Profile Photo Scraping**: Extracts authentic profile avatars with local image caching.
- **Interactive Multi-Slide Carousels & Video Player**:
  - Full carousel navigation with Next/Previous slide controls and slide counters (`Slide X of Y`).
  - Deep manifest pre-caching stores child slide images and direct progressive video streams in SQLite without downloading unwanted files to disk.
  - Single-slide download, active slide deletion, or bulk `.zip` download of entire carousels.
- **Batch Archiving & Download Queue**:
  - Configurable batch downloader allowing users to archive up to N posts per account or specific post ranges.
  - Real-time Task Queue tab tracking active, completed, and pending download jobs.
  - Parallel download worker controls (1 to 8 workers, configurable in Settings).
  - Live in-app terminal console to monitor scraper and downloader events in real-time.
- **1-Click Web-Based Software Updater & Multi-Commit Release Manager**:
  - Automatically checks the upstream Git repository for software updates in the background.
  - **Comprehensive Multi-Commit Breakdown**: When upstream updates contain multiple commits, ZenGram categorizes each change (✨ Features, 🐛 Fixes, 🔒 Security, ⚡ Performance, ♻️ Refactoring, 📄 Docs), displays author and relative dates, and provides expandable commit bodies for complete transparency before applying updates.
  - 1-click **"Apply Web Update Now"** modal directly inside the Settings page with streaming terminal logs and automatic service restart.
- **Local Disk Image Proxy & Reverse Proxy Compatibility**:
  - Dual Base64 and query image proxying prevents CDN token truncation behind Nginx Proxy Manager / Cloudflare.
  - Automatically caches avatar thumbnails locally on disk (`storage/cache/images/`) so images remain visible even after Instagram CDN token expiration.
- **Real-Time System Resource Telemetry**:
  - Built-in live CPU, RAM, Swap, and Disk volume meters.
  - Automatic detection of Proxmox LXC containers, Docker, and Host environments.
- **Full Database & Encryption Key Backup Manager (Browser & Server Storage)**:
  - **Browser Download**: Download a complete, consistent WAL-safe snapshot of `zengram.db` bundled with your hardware-isolated encryption key (`jwt_secret.key`) and metadata manifest in a timestamped `.zip` directly to your local computer.
  - **Server-Side Backups**: Create and persist point-in-time backup archives directly on the server filesystem (`storage/backups/`) with owner-only (`0600`) permissions, complete with in-app listing, direct download, and deletion management.
  - Zero downtime hot snapshotting with automatic temp file cleanup.
- **Master Security & Access Control**:
  - **Master Password Authentication**: Built-in administrator account secured with salted Bcrypt password hashing.
  - **Session Security**: Cryptographically signed JSON Web Tokens (JWT) stored in secure `HttpOnly`, `SameSite=Lax` cookies.
  - **Transparent Encryption at Rest**: Instagram session cookies are encrypted with AES-256 Fernet (`enc:...`) before SQLite persistence using a hardware/OS-isolated persistent key (`~/.config/zengram/jwt_secret.key`, permissions `0600`).
  - **Atomic Fail-Closed Migrations**: Automated database startup routines atomically migrate legacy plaintext sessions and verify cryptographic key integrity before accepting connections.
  - **SSRF & DNS Rebinding Protection**: Pinned IP connections with TLS SNI verification and multi-hop redirect validation prevent private subnet scanning and DNS rebinding attacks.
  - **Filesystem Hardening**: Strict owner-only permissions (`0600` on database and key files, `0700` on storage/config directories, `umask 0077` systemd isolation).

---

## 🏗️ Architecture & Requirements

- **Backend**:
  - **FastAPI** (Python 3.12+ async REST API).
  - **SQLAlchemy** + **aiosqlite** with SQLite WAL mode.
  - **Cryptography** (Fernet AES-256 encryption at rest for sensitive credentials).
  - **Passlib & Bcrypt** for secure administrator password hashing.
  - **PyJWT** for cryptographically signed access tokens.
  - **Playwright** + **Instaloader** + direct probe engine.
  - **psutil** for lightweight container & hardware resource telemetry.
- **Frontend**:
  - **React** (Vite build) with custom Vanilla CSS design system.
  - Dark-mode glassmorphism aesthetic with Lucide icons.
- **System Footprint (LXC & Low-Spec Friendly)**:
  - **RAM**: ~170 MB – 250 MB idle (~350 MB under active batch downloads).
  - **Recommended LXC Allocation**: 2 GB RAM, 2 Cores (Intel / AMD x86_64 or ARM64).

> [!NOTE]
> **🖥️ Desktop-First Experience**: ZenGram is designed and optimized specifically for desktop and workstation browsers (Google Chrome, Firefox, Microsoft Edge, Brave). Mobile-friendly and small-screen responsive design is currently not a priority as the majority of power users manage their archiving workflows on desktop screens. Mobile responsive layouts may be explored in future releases.

---

## 🚀 Installation & Quick Start

### 1. Clone the Repository

Clone the official ZenGram repository to your machine or Proxmox LXC container:

```bash
git clone https://github.com/darktekmafia/ZenGram.git
cd ZenGram
```

### 2. Run the Automated Installer

Make the script executable and run the installer:

**For Desktop Workstations (Fedora, Ubuntu, Debian, Arch):**
```bash
chmod +x install.sh
./install.sh
```

**For Headless Servers & Proxmox LXC Containers:**
```bash
chmod +x install.sh
./install.sh --no-desktop
```

> [!TIP]
> **Custom Host/Port Binding**: If you need to bind to a specific network interface or custom port:
> ```bash
> ./install.sh --host 0.0.0.0 --port 8484 --no-desktop
> ```

The installer automatically:
1. Detects your distribution package manager (`dnf`, `apt`, `pacman`, `zypper`) and installs required packages (Python 3, Node.js 20+, FFmpeg, SQLite3).
2. Sets up the Python virtual environment (`.venv`) and installs backend dependencies.
3. Installs frontend packages and compiles the optimized production Vite bundle (`frontend/dist/`).
4. Registers, enables, and starts the systemd service (`zengram.service`).
5. Generates desktop launchers & application menu shortcuts (on desktop environments).

---

### 3. Accessing the Web Interface & First-Time Setup

Once installation finishes, open your browser:
- **Local Machine**: [http://localhost:8484](http://localhost:8484)
- **Remote Server / Proxmox LXC**: `http://<YOUR_SERVER_IP>:8484`

> [!IMPORTANT]
> **First-Time Master Setup**:
> On your very first visit to the web interface after installation, ZenGram will automatically display the **Initial Setup Screen**. You will be prompted to create your administrator username and secure master password. Once configured, all future access and remote sessions will require these credentials to unlock the application.

---

## ⚙️ Configuration & Settings

All settings can be customized through the **Settings** page in the web UI:

| Setting | Description | Default |
| :--- | :--- | :--- |
| **Download Storage Directory** | Local directory where archived media files are stored | `~/Downloads/ZenGram` |
| **Session Cookie (`sessionid`)** | Instagram session cookie for accessing high-res feeds and followed accounts | Configurable in UI (Encrypted at Rest) |
| **Parallel Download Workers** | Number of simultaneous background download workers (1–8) | `2` |
| **Max Queue Capacity** | Maximum pending tasks in the download queue | `8` |
| **Rate Limit Delay** | Safety delay between Instagram scraping requests (seconds) | `3.0s` |

---

## 💾 Database Backups & Maintenance

### 1. 1-Click Web Backup Manager (Recommended)
Inside the web UI under **Settings ➔ Database & Storage Maintenance**, the **Database & Encryption Key Backup Manager** provides two options:
- **Download to Browser (.zip)**: Generates a consistent WAL-safe hot snapshot of `zengram.db` packaged with your encryption key (`jwt_secret.key`) and metadata manifest, streamed directly to your browser.
- **Save Backup on Server**: Generates and persists timestamped backups in `storage/backups/` directly on the server filesystem. Backups are stored with strict `0600` permissions and can be downloaded or deleted directly from the web interface.

### 2. Manual Terminal Hot Backup
ZenGram operates SQLite in **WAL (Write-Ahead Logging)** mode for high-concurrency performance. To create a consistent command-line backup without copying in-flight transaction locks:

```bash
# Recommended WAL-safe hot backup command:
sqlite3 zengram.db ".backup zengram_backup_$(date +%Y%m%d).db"
```

> [!TIP]
> Do not use plain `cp zengram.db backup.db` while the server is active, as transactions held in `zengram.db-wal` may be excluded from the snapshot. Always use the in-app Backup Manager or `sqlite3 .backup`.

---

## 🛠️ Updating ZenGram

To update, pull new changes, migrate database records, and rebuild:

```bash
./install.sh --update
```

Or manually:
```bash
git pull
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
# Desktop user service:
systemctl --user restart zengram.service
# Or LXC root service:
# systemctl restart zengram.service
```

---

## 🧪 Running Security & Regression Tests

ZenGram includes a comprehensive automated test suite covering 20 security boundaries: authentication enforcement, secret redaction, SSRF/DNS rebinding defense, AES-256 encryption-at-rest, key tampering detection, and atomic database migrations.

### 1. 1-Click In-App Diagnostic Runner (Web UI)
Inside the web UI under **Settings ➔ Master Security & Web Access Control**, click **"Run Security Check Now"**. ZenGram launches the test suite in the background on an isolated in-memory test database and streams real-time diagnostic output into an in-app terminal modal with milestone detection and pass/fail verification.

### 2. Manual Terminal Command
```bash
source .venv/bin/activate
python backend/tests/test_security.py
```

> [!NOTE]
> **Understanding Test Output**:
> During execution, the test suite actively attacks the application with simulated corrupted payloads and key mismatches to verify fail-closed behavior. You will see two intentional `FATAL:` log lines as proof that the security detectors triggered properly. The test is successful when the final summary reads:
> `All security, encryption-at-rest, atomic rollback, and DNS-pinning tests passed on disposable database!`
>
> 📖 For a detailed breakdown of all 20 test suites and what the outputs mean, see the [Security Tests Guide](SECURITY_TESTS_README.md).

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
