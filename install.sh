#!/usr/bin/env bash
# InstaSave - Automated Installer & Updater
# Supports Fedora, Debian, Ubuntu, Proxmox LXC, Arch Linux, and generic Linux systems.

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

APP_HOST="0.0.0.0"
APP_PORT="8484"
IS_UPDATE=0
CHECK_UPDATE_ONLY=0
SKIP_DESKTOP=0

# Parse CLI arguments
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --update)
            IS_UPDATE=1
            shift
            ;;
        --check-update)
            CHECK_UPDATE_ONLY=1
            shift
            ;;
        --host)
            APP_HOST="$2"
            shift 2
            ;;
        --port)
            APP_PORT="$2"
            shift 2
            ;;
        --no-desktop|--headless)
            SKIP_DESKTOP=1
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --update         Update existing installation, rebuild assets, and restart service"
            echo "  --check-update   Check if new updates are available from Git remote"
            echo "  --host <IP>      Bind host IP for web interface (default: 0.0.0.0)"
            echo "  --port <PORT>    Bind port for web interface (default: 8484)"
            echo "  --no-desktop     Skip desktop launcher and shortcut installation (headless mode)"
            echo "  --help, -h       Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Use --help for available options."
            exit 1
            ;;
    esac
done

echo "============================================================"
echo "          InstaSave - Linux Installation & Update Engine    "
echo "============================================================"

# Check Update Mode Only
if [ "$CHECK_UPDATE_ONLY" -eq 1 ]; then
    echo "[*] Checking for updates from Git repository..."
    if [ -d ".git" ]; then
        git fetch origin main --quiet 2>/dev/null || true
        LOCAL_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        REMOTE_COMMIT=$(git rev-parse --short origin/main 2>/dev/null || echo "$LOCAL_COMMIT")
        if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
            echo "[!] Update available! (Local: $LOCAL_COMMIT, Remote: $REMOTE_COMMIT)"
            echo "[*] Run '$0 --update' to apply latest changes."
            exit 2
        else
            echo "[✓] InstaSave is up to date (Commit: $LOCAL_COMMIT)."
            exit 0
        fi
    else
        echo "[!] Not a git repository. Version checking skipped."
        exit 0
    fi
fi

if [ "$IS_UPDATE" -eq 1 ]; then
    echo "[*] Mode: Updating existing installation..."
    if [ -d ".git" ]; then
        echo "[*] Pulling latest changes from Git..."
        git pull --quiet 2>/dev/null || echo "[!] Notice: Git pull skipped (working tree clean or no upstream)."
    fi
else
    echo "[*] Mode: Initial Installation & Setup..."
fi

# Detect Package Manager and Distro
detect_and_install_deps() {
    echo "[1/6] Detecting Linux distribution and verifying system dependencies..."
    
    if command -v dnf &> /dev/null; then
        PM="dnf"
        INSTALL_CMD="sudo dnf install -y"
        PKG_LIST="python3 python3-pip python3-devel ffmpeg nodejs npm sqlite git"
    elif command -v apt-get &> /dev/null; then
        PM="apt"
        INSTALL_CMD="sudo DEBIAN_FRONTEND=noninteractive apt-get install -y"
        PKG_LIST="python3 python3-pip python3-venv python3-dev ffmpeg nodejs npm sqlite3 git"
        if [ "$(id -u)" -eq 0 ]; then
            INSTALL_CMD="DEBIAN_FRONTEND=noninteractive apt-get install -y"
        fi
    elif command -v pacman &> /dev/null; then
        PM="pacman"
        INSTALL_CMD="sudo pacman -S --noconfirm --needed"
        PKG_LIST="python python-pip ffmpeg nodejs npm sqlite git"
    elif command -v zypper &> /dev/null; then
        PM="zypper"
        INSTALL_CMD="sudo zypper install -y"
        PKG_LIST="python3 python3-pip ffmpeg nodejs npm sqlite3 git"
    else
        PM="unknown"
    fi

    # Check for missing commands
    COMMAND_DEPS=("python3" "ffmpeg" "node" "npm" "git")
    MISSING=()
    for cmd in "${COMMAND_DEPS[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            MISSING+=("$cmd")
        fi
    done

    if [ ${#MISSING[@]} -gt 0 ]; then
        echo "[!] Missing required system packages: ${MISSING[*]}"
        if [ "$PM" != "unknown" ]; then
            echo "[*] Installing missing dependencies via $PM..."
            if [ "$PM" == "apt" ]; then
                if [ "$(id -u)" -eq 0 ]; then
                    apt-get update -qq
                else
                    sudo apt-get update -qq
                fi
            fi
            eval "$INSTALL_CMD $PKG_LIST"
        else
            echo "[ERROR] Unsupported package manager. Please install: Python 3, Node.js (v20+), npm, FFmpeg, SQLite3, and Git manually."
            exit 1
        fi
    else
        echo "[✓] All core system dependencies (Python, Node, npm, FFmpeg, SQLite, Git) are satisfied."
    fi
}

detect_and_install_deps

# 2. Python Virtual Environment
echo "[2/6] Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

.venv/bin/pip install --upgrade pip --quiet
.venv/bin/pip install -r backend/requirements.txt --quiet
echo "[✓] Python backend dependencies installed."

# 3. Playwright Chromium Installation
echo "[3/6] Installing Playwright Chromium browser binaries..."
.venv/bin/playwright install chromium --quiet || .venv/bin/playwright install chromium
echo "[✓] Playwright headless browser ready."

# 4. Frontend Compilation
echo "[4/6] Compiling frontend production bundle..."
cd "$PROJECT_DIR/frontend"
npm install --quiet
npm run build --quiet
cd "$PROJECT_DIR"
echo "[✓] Frontend production bundle compiled cleanly in 'frontend/dist'."

# 5. Desktop Launcher (If GUI / Desktop is present)
if [ "$SKIP_DESKTOP" -eq 0 ] && [ -n "$DISPLAY" -o -d "$HOME/Desktop" -o -d "$HOME/.local/share/applications" ]; then
    echo "[5/6] Installing Desktop shortcuts and app icons..."
    mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications" 2>/dev/null || true
    
    DESKTOP_ENTRY="$HOME/.local/share/applications/instasave.desktop"
    cat <<EOF > "$DESKTOP_ENTRY"
[Desktop Entry]
Version=1.0
Type=Application
Name=InstaSave
GenericName=Instagram Content Saver
Comment=Local Web UI for browsing, archiving, and saving Instagram media
Exec=xdg-open http://localhost:$APP_PORT
Icon=$PROJECT_DIR/assets/instasave.svg
Terminal=false
Categories=Network;FileTransfer;Utility;
Keywords=Instagram;Downloader;Saver;Archive;Media;
StartupNotify=true
EOF
    chmod +x "$DESKTOP_ENTRY" 2>/dev/null || true

    if [ -d "$HOME/Desktop" ]; then
        cp "$DESKTOP_ENTRY" "$HOME/Desktop/InstaSave.desktop" 2>/dev/null || true
        chmod +x "$HOME/Desktop/InstaSave.desktop" 2>/dev/null || true
        echo "[✓] Desktop shortcut created at ~/Desktop/InstaSave.desktop"
    fi
else
    echo "[5/6] Headless / Container environment detected. Skipping Desktop GUI shortcut."
fi

# 6. Systemd Service Integration (Root / LXC vs User Session)
echo "[6/6] Configuring and starting Systemd service..."

SERVICE_CONTENT="[Unit]
Description=InstaSave Local Web Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/.venv/bin/uvicorn backend.app.main:app --host $APP_HOST --port $APP_PORT
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target default.target"

if [ "$(id -u)" -eq 0 ]; then
    # Running as Root (e.g. Proxmox LXC Container or Dedicated Linux Server)
    SYSTEMD_PATH="/etc/systemd/system/instasave.service"
    echo "$SERVICE_CONTENT" > "$SYSTEMD_PATH"
    systemctl daemon-reload
    systemctl enable --now instasave.service
    systemctl restart instasave.service
    echo "[✓] System-level service 'instasave.service' enabled and active."
else
    # Running as Standard User (e.g. Fedora Workstation)
    USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
    mkdir -p "$USER_SYSTEMD_DIR"
    echo "$SERVICE_CONTENT" > "$USER_SYSTEMD_DIR/instasave.service"
    systemctl --user daemon-reload
    systemctl --user enable --now instasave.service
    systemctl --user restart instasave.service
    echo "[✓] User-level service 'instasave.service' enabled and active."
fi

echo "============================================================"
echo "   [✓] InstaSave installation & configuration complete!"
echo "   Access the Web UI at: http://${APP_HOST}:${APP_PORT}"
echo "============================================================"
