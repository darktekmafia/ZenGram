#!/usr/bin/env bash
# ZenGram - Automated Installer & Updater
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
echo "          ZenGram - Linux Installation & Update Engine      "
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
            echo "[✓] ZenGram is up to date (Commit: $LOCAL_COMMIT)."
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
    
    IS_ROOT=0
    if [ "$(id -u)" -eq 0 ]; then
        IS_ROOT=1
        SUDO_PREFIX=""
    else
        SUDO_PREFIX="sudo"
    fi

    if command -v dnf &> /dev/null; then
        PM="dnf"
    elif command -v apt-get &> /dev/null; then
        PM="apt"
    elif command -v pacman &> /dev/null; then
        PM="pacman"
    elif command -v zypper &> /dev/null; then
        PM="zypper"
    else
        echo "[!] Unknown package manager. Please ensure python3, python3-pip, nodejs, npm, ffmpeg, sqlite3 are installed."
        return 0
    fi

    echo "[*] System package manager: $PM (Running as: $([ $IS_ROOT -eq 1 ] && echo 'root' || echo 'non-root user'))"
    
    # Required core system packages
    PKGS_TO_INSTALL=()
    if ! command -v python3 &> /dev/null; then PKGS_TO_INSTALL+=("python3"); fi
    if ! command -v pip3 &> /dev/null && ! python3 -m pip --version &> /dev/null; then 
        if [ "$PM" = "apt" ]; then 
            PKGS_TO_INSTALL+=("python3-pip" "python3-venv" "python3-dev"); 
        else 
            PKGS_TO_INSTALL+=("python3-pip"); 
        fi
    fi
    if ! command -v node &> /dev/null; then PKGS_TO_INSTALL+=("nodejs"); fi
    if ! command -v npm &> /dev/null; then PKGS_TO_INSTALL+=("npm"); fi
    if ! command -v ffmpeg &> /dev/null; then PKGS_TO_INSTALL+=("ffmpeg"); fi
    if ! command -v sqlite3 &> /dev/null; then PKGS_TO_INSTALL+=("sqlite3"); fi
    if ! command -v git &> /dev/null; then PKGS_TO_INSTALL+=("git"); fi

    # Core dependencies plus headless Chromium libraries for container environments
    if [ "$PM" = "apt" ]; then
        CHROMIUM_DEPS=("libnss3" "libnspr4" "libatk1.0-0" "libatk-bridge2.0-0" "libcups2" "libdrm2" "libxkbcommon0" "libxcomposite1" "libxdamage1" "libxfixes3" "libxrandr2" "libgbm1" "libpango-1.0-0" "libcairo2")
        for dep in "${CHROMIUM_DEPS[@]}"; do
            if ! dpkg -s "$dep" &> /dev/null; then PKGS_TO_INSTALL+=("$dep"); fi
        done
    fi

    if [ ${#PKGS_TO_INSTALL[@]} -gt 0 ]; then
        echo "[*] Installing missing system packages: ${PKGS_TO_INSTALL[*]}"
        if [ "$PM" = "apt" ]; then
            $SUDO_PREFIX apt-get update -qq
            DEBIAN_FRONTEND=noninteractive $SUDO_PREFIX apt-get install -y --no-install-recommends "${PKGS_TO_INSTALL[@]}"
        elif [ "$PM" = "dnf" ]; then
            $SUDO_PREFIX dnf install -y "${PKGS_TO_INSTALL[@]}"
        elif [ "$PM" = "pacman" ]; then
            $SUDO_PREFIX pacman -S --noconfirm "${PKGS_TO_INSTALL[@]}"
        elif [ "$PM" = "zypper" ]; then
            $SUDO_PREFIX zypper install -y "${PKGS_TO_INSTALL[@]}"
        fi
        echo "[✓] Missing system dependencies installed successfully."
    else
        echo "[✓] All essential system dependencies are present."
    fi
}

detect_and_install_deps

# 2. Python Virtual Environment (.venv)
echo "[2/6] Setting up Python virtual environment (.venv)..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "[✓] Virtual environment initialized."
fi

source .venv/bin/activate
pip install --upgrade pip --quiet

# 3. Install Python Dependencies & Headless Browser
echo "[3/6] Installing backend Python packages and Playwright Chromium..."
pip install -r backend/requirements.txt --quiet
echo "[*] Installing Playwright Chromium browser binaries..."
playwright install chromium 2>/dev/null || true
echo "[✓] Backend dependencies and browser engine installed."

# 4. Build Frontend Assets (Vite)
echo "[4/6] Installing frontend dependencies and compiling production bundle..."
cd "$PROJECT_DIR/frontend"
npm install --quiet
npm run build --quiet
cd "$PROJECT_DIR"
echo "[✓] Frontend production bundle compiled cleanly in 'frontend/dist'."

# 5. Desktop Launcher (If GUI / Desktop is present)
if [ "$SKIP_DESKTOP" -eq 0 ] && [ -n "$DISPLAY" -o -d "$HOME/Desktop" -o -d "$HOME/.local/share/applications" ]; then
    echo "[5/6] Installing Desktop shortcuts and app icons..."
    mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications" 2>/dev/null || true
    
    DESKTOP_ENTRY="$HOME/.local/share/applications/zengram.desktop"
    cat <<EOF > "$DESKTOP_ENTRY"
[Desktop Entry]
Version=1.0
Type=Application
Name=ZenGram
GenericName=Instagram Content Archiver & Feed Viewer
Comment=Local Web UI for browsing, archiving, and saving Instagram media
Exec=xdg-open http://localhost:$APP_PORT
Icon=$PROJECT_DIR/assets/zengram.svg
Terminal=false
Categories=Network;FileTransfer;Utility;
Keywords=Instagram;Downloader;Saver;Archive;Media;ZenGram;
StartupNotify=true
EOF
    chmod +x "$DESKTOP_ENTRY" 2>/dev/null || true

    if [ -d "$HOME/Desktop" ]; then
        cp "$DESKTOP_ENTRY" "$HOME/Desktop/ZenGram.desktop" 2>/dev/null || true
        chmod +x "$HOME/Desktop/ZenGram.desktop" 2>/dev/null || true
        echo "[✓] Desktop shortcut created at ~/Desktop/ZenGram.desktop"
    fi
else
    echo "[5/6] Headless / Container environment detected. Skipping Desktop GUI shortcut."
fi

# 6. Systemd Service Integration (Root / LXC vs User Session)
echo "[6/6] Configuring and starting Systemd service..."

# Stop any legacy instasave service if running
if [ "$(id -u)" -eq 0 ]; then
    systemctl stop instasave.service 2>/dev/null || true
    systemctl disable instasave.service 2>/dev/null || true
else
    systemctl --user stop instasave.service 2>/dev/null || true
    systemctl --user disable instasave.service 2>/dev/null || true
fi

SERVICE_CONTENT="[Unit]
Description=ZenGram Local Web Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
UMask=0077
ExecStart=$PROJECT_DIR/.venv/bin/uvicorn backend.app.main:app --host $APP_HOST --port $APP_PORT
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target default.target"

# Enforce secure owner-only permissions on database, storage, and secrets
chmod 700 "$PROJECT_DIR/storage" 2>/dev/null || true
chmod 600 "$PROJECT_DIR"/zengram.db* 2>/dev/null || true
mkdir -p "$HOME/.config/zengram"
chmod 700 "$HOME/.config/zengram" 2>/dev/null || true
chmod 600 "$HOME/.config/zengram"/jwt_secret.key 2>/dev/null || true

if [ "$(id -u)" -eq 0 ]; then
    # Running as Root (e.g. Proxmox LXC Container or Dedicated Linux Server)
    SYSTEMD_PATH="/etc/systemd/system/zengram.service"
    echo "$SERVICE_CONTENT" > "$SYSTEMD_PATH"
    systemctl daemon-reload
    systemctl enable --now zengram.service
    systemctl restart zengram.service
    echo "[✓] System-level service 'zengram.service' enabled and active."
else
    # Running as Standard User (e.g. Fedora Workstation)
    USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
    mkdir -p "$USER_SYSTEMD_DIR"
    echo "$SERVICE_CONTENT" > "$USER_SYSTEMD_DIR/zengram.service"
    systemctl --user daemon-reload
    systemctl --user enable --now zengram.service
    systemctl --user restart zengram.service
    echo "[✓] User-level service 'zengram.service' enabled and active."
fi

echo "============================================================"
echo "   [✓] ZenGram installation & configuration complete!"
echo "   Access the Web UI at: http://${APP_HOST}:${APP_PORT}"
echo "============================================================"
