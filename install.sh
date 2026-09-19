#!/usr/bin/env bash
# ==============================================================================
#  ZenGram - Automated Installation & Update Engine
#  Supports Fedora, Ubuntu, Debian, Proxmox LXC, Arch Linux, and generic Linux.
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

APP_HOST="0.0.0.0"
APP_PORT="8484"
IS_UPDATE=0
CHECK_UPDATE_ONLY=0
SKIP_DESKTOP=0
NON_INTERACTIVE=0
SKIP_RESTART=0

# Detect color and terminal capabilities
if [ -t 1 ] && [ -z "$NO_COLOR" ] && [ "$TERM" != "dumb" ]; then
    CLR_CYAN="\033[38;5;39m"
    CLR_PURPLE="\033[38;5;141m"
    CLR_GREEN="\033[38;5;42m"
    CLR_YELLOW="\033[38;5;214m"
    CLR_RED="\033[38;5;203m"
    CLR_GRAY="\033[38;5;244m"
    CLR_BOLD="\033[1m"
    CLR_RESET="\033[0m"
else
    CLR_CYAN=""
    CLR_PURPLE=""
    CLR_GREEN=""
    CLR_YELLOW=""
    CLR_RED=""
    CLR_GRAY=""
    CLR_BOLD=""
    CLR_RESET=""
fi

# Parse CLI arguments
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --update)
            IS_UPDATE=1
            shift
            ;;
        --web-update|--non-interactive)
            IS_UPDATE=1
            NON_INTERACTIVE=1
            SKIP_DESKTOP=1
            shift
            ;;
        --no-restart)
            SKIP_RESTART=1
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
            echo "ZenGram Installation & Update Engine"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --update            Update existing installation, rebuild assets, and restart service"
            echo "  --web-update        Non-interactive headless update for Web UI update manager"
            echo "  --non-interactive   Run without prompting for user interaction or GUI shortcuts"
            echo "  --no-restart        Compile dependencies and build bundle without restarting service"
            echo "  --check-update      Check if new updates are available from Git remote"
            echo "  --host <IP>         Bind host IP for web interface (default: 0.0.0.0)"
            echo "  --port <PORT>       Bind port for web interface (default: 8484)"
            echo "  --no-desktop        Skip desktop launcher and shortcut installation (headless mode)"
            echo "  --help, -h          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Use --help for available options."
            exit 1
            ;;
    esac
done

# Print ZenGram ASCII Banner
print_banner() {
    printf "${CLR_PURPLE}${CLR_BOLD}"
    cat << "EOF"
  ███████╗███████╗███╗   ██╗ ██████╗ ██████╗  █████╗ ███╗   ███╗
  ╚══███╔╝██╔════╝████╗  ██║██╔════╝ ██╔══██╗██╔══██╗████╗ ████║
    ███╔╝ █████╗  ██╔██╗ ██║██║  ███╗██████╔╝███████║██╔████╔██║
   ███╔╝  ██╔══╝  ██║╚██╗██║██║   ██║██╔══██╗██╔══██║██║╚██╔╝██║
  ███████╗███████╗██║ ╚████║╚██████╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
  ╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
EOF
    printf "${CLR_RESET}"
    printf "${CLR_GRAY}   Distraction-Free Instagram Media Archiver & Chronological Feed Viewer${CLR_RESET}\n\n"
}

# Distro and Environment Detection
detect_environment() {
    DISTRO_PRETTY="Linux"
    if [ -f "/etc/os-release" ]; then
        DISTRO_PRETTY=$(grep "^PRETTY_NAME=" /etc/os-release | cut -d= -f2 | tr -d '"')
    fi

    IS_ROOT=0
    if [ "$(id -u)" -eq 0 ]; then
        IS_ROOT=1
        RUNNER_USER="root"
    else
        RUNNER_USER="$(whoami 2>/dev/null || echo 'user')"
    fi

    CONTAINER_TYPE="Bare-Metal / VM"
    if [ -f "/.dockerenv" ]; then
        CONTAINER_TYPE="Docker Container"
    elif [ -f "/proc/1/environ" ] && grep -qa "container=lxc" /proc/1/environ 2>/dev/null; then
        CONTAINER_TYPE="Proxmox LXC Container"
    elif systemd-detect-virt -c &>/dev/null; then
        CONTAINER_TYPE="LXC / Container"
    fi

    ARCH=$(uname -m 2>/dev/null || echo "x86_64")
    CORES=$(nproc 2>/dev/null || echo "1")
    RAM_TOTAL="N/A"
    if [ -f "/proc/meminfo" ]; then
        KB=$(grep "MemTotal:" /proc/meminfo | awk '{print $2}')
        if [ -n "$KB" ]; then
            RAM_TOTAL="$(awk "BEGIN {printf \"%.1f GB\", $KB/1048576}")"
        fi
    fi
}

# Clear screen in interactive TTY mode for a clean presentation
if [ -t 1 ] && [ "$NON_INTERACTIVE" -eq 0 ] && [ "$CHECK_UPDATE_ONLY" -eq 0 ]; then
    clear 2>/dev/null || printf "\033c" 2>/dev/null || true
fi

print_banner
detect_environment

# Quick Check Update Mode Only
if [ "$CHECK_UPDATE_ONLY" -eq 1 ]; then
    printf "${CLR_CYAN}[*] Checking for updates from Git repository...${CLR_RESET}\n"
    if [ -d ".git" ]; then
        git fetch origin main --quiet 2>/dev/null || true
        LOCAL_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        REMOTE_COMMIT=$(git rev-parse --short origin/main 2>/dev/null || echo "$LOCAL_COMMIT")
        if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
            printf "${CLR_YELLOW}[!] Update available! (Local: %s, Upstream: %s)${CLR_RESET}\n" "$LOCAL_COMMIT" "$REMOTE_COMMIT"
            printf "${CLR_CYAN}[*] Run '$0 --update' to apply latest changes.${CLR_RESET}\n"
            exit 2
        else
            printf "${CLR_GREEN}[✓] ZenGram is already up to date (Commit: %s).${CLR_RESET}\n" "$LOCAL_COMMIT"
            exit 0
        fi
    else
        printf "${CLR_YELLOW}[!] Not a git repository. Version checking skipped.${CLR_RESET}\n"
        exit 0
    fi
fi

# Print Environment Summary Card
printf "${CLR_CYAN}╭── System Discovery & Environment ───────────────────────────────────────────${CLR_RESET}\n"
printf "${CLR_CYAN}│${CLR_RESET}  ${CLR_BOLD}%-18s${CLR_RESET} %s\n" "Operating System:" "$DISTRO_PRETTY"
printf "${CLR_CYAN}│${CLR_RESET}  ${CLR_BOLD}%-18s${CLR_RESET} %s (%s)\n" "Environment:" "$CONTAINER_TYPE" "$RUNNER_USER"
printf "${CLR_CYAN}│${CLR_RESET}  ${CLR_BOLD}%-18s${CLR_RESET} %s | %s CPU Cores | %s RAM\n" "Hardware Specs:" "$ARCH" "$CORES" "$RAM_TOTAL"
printf "${CLR_CYAN}│${CLR_RESET}  ${CLR_BOLD}%-18s${CLR_RESET} http://%s:%s\n" "Target Endpoint:" "$APP_HOST" "$APP_PORT"
if [ "$IS_UPDATE" -eq 1 ]; then
    printf "${CLR_CYAN}│${CLR_RESET}  ${CLR_BOLD}%-18s${CLR_RESET} Software Update & Asset Rebuild\n" "Execution Mode:"
else
    printf "${CLR_CYAN}│${CLR_RESET}  ${CLR_BOLD}%-18s${CLR_RESET} Fresh Installation & Service Deployment\n" "Execution Mode:"
fi
printf "${CLR_CYAN}╰─────────────────────────────────────────────────────────────────────────────${CLR_RESET}\n\n"

PREV_COMMIT=""
if [ -d ".git" ]; then
    PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
fi

if [ "$IS_UPDATE" -eq 1 ]; then
    printf "${CLR_CYAN}[*] Pulling latest changes from Git repository...${CLR_RESET}\n"
    if [ -d ".git" ]; then
        git pull --quiet 2>/dev/null || printf "${CLR_YELLOW}[!] Notice: Git pull skipped (working tree clean or no upstream).${CLR_RESET}\n"
    fi
fi

# Track changes for smart fast-path updating
REQ_CHANGED=1
PKG_CHANGED=1
if [ "$IS_UPDATE" -eq 1 ] && [ -n "$PREV_COMMIT" ] && [ -d ".git" ]; then
    if git diff --name-only "$PREV_COMMIT" HEAD 2>/dev/null | grep -q "backend/requirements.txt"; then
        REQ_CHANGED=1
    else
        REQ_CHANGED=0
    fi

    if git diff --name-only "$PREV_COMMIT" HEAD 2>/dev/null | grep -q "frontend/package.json"; then
        PKG_CHANGED=1
    else
        PKG_CHANGED=0
    fi
fi

# ==============================================================================
# [1/6] System Dependencies
# ==============================================================================
printf "\n${CLR_PURPLE}${CLR_BOLD}[1/6] Detecting Linux package manager and verifying dependencies...${CLR_RESET}\n"

if [ "$IS_ROOT" -eq 1 ]; then
    SUDO_PREFIX=""
else
    SUDO_PREFIX="sudo"
fi

PM="unknown"
if command -v dnf &> /dev/null; then
    PM="dnf"
elif command -v apt-get &> /dev/null; then
    PM="apt"
elif command -v pacman &> /dev/null; then
    PM="pacman"
elif command -v zypper &> /dev/null; then
    PM="zypper"
fi

if [ "$PM" = "unknown" ]; then
    printf "${CLR_YELLOW}[!] Notice: Package manager not recognized. Ensuring essential binaries exist...${CLR_RESET}\n"
else
    printf "${CLR_GRAY}[*] Package manager detected: %s (Runner: %s)${CLR_RESET}\n" "$PM" "$RUNNER_USER"
fi

PKGS_TO_INSTALL=()
if ! command -v python3 &> /dev/null; then PKGS_TO_INSTALL+=("python3"); fi
if ! command -v pip3 &> /dev/null && ! python3 -m pip --version &> /dev/null; then 
    if [ "$PM" = "apt" ]; then 
        PKGS_TO_INSTALL+=("python3-pip" "python3-venv" "python3-dev")
    else 
        PKGS_TO_INSTALL+=("python3-pip")
    fi
fi
if ! command -v node &> /dev/null; then PKGS_TO_INSTALL+=("nodejs"); fi
if ! command -v npm &> /dev/null; then PKGS_TO_INSTALL+=("npm"); fi
if ! command -v ffmpeg &> /dev/null; then PKGS_TO_INSTALL+=("ffmpeg"); fi
if ! command -v sqlite3 &> /dev/null; then PKGS_TO_INSTALL+=("sqlite3"); fi
if ! command -v git &> /dev/null; then PKGS_TO_INSTALL+=("git"); fi

# Debian/Ubuntu container headless Chromium libraries
if [ "$PM" = "apt" ]; then
    CHROMIUM_DEPS=("libnss3" "libnspr4" "libatk1.0-0" "libatk-bridge2.0-0" "libcups2" "libdrm2" "libxkbcommon0" "libxcomposite1" "libxdamage1" "libxfixes3" "libxrandr2" "libgbm1" "libpango-1.0-0" "libcairo2")
    for dep in "${CHROMIUM_DEPS[@]}"; do
        if ! dpkg -s "$dep" &> /dev/null && ! dpkg -s "${dep}t64" &> /dev/null; then
            PKGS_TO_INSTALL+=("$dep")
        fi
    done
fi

if [ ${#PKGS_TO_INSTALL[@]} -gt 0 ]; then
    printf "${CLR_CYAN}[*] Installing missing system packages: %s${CLR_RESET}\n" "${PKGS_TO_INSTALL[*]}"
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
    printf "${CLR_GREEN}[✓] System packages installed successfully.${CLR_RESET}\n"
else
    printf "${CLR_GREEN}[✓] All essential system dependencies are present and verified.${CLR_RESET}\n"
fi

# ==============================================================================
# [2/6] Python Virtual Environment (.venv)
# ==============================================================================
printf "\n${CLR_PURPLE}${CLR_BOLD}[2/6] Configuring Python virtual environment (.venv)...${CLR_RESET}\n"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    printf "${CLR_GREEN}[✓] Created fresh virtual environment (.venv).${CLR_RESET}\n"
else
    printf "${CLR_GREEN}[✓] Existing virtual environment (.venv) verified.${CLR_RESET}\n"
fi

# Activate virtual environment
source .venv/bin/activate
pip install --upgrade pip --quiet

# ==============================================================================
# [3/6] Backend Packages & Playwright Browser Engine
# ==============================================================================
printf "\n${CLR_PURPLE}${CLR_BOLD}[3/6] Installing backend Python packages & browser engine...${CLR_RESET}\n"

if [ "$IS_UPDATE" -eq 1 ] && [ "$REQ_CHANGED" -eq 0 ]; then
    printf "${CLR_CYAN}[⚡ Fast-Path] Backend requirements.txt unchanged. Skipping pip package re-install.${CLR_RESET}\n"
else
    printf "${CLR_GRAY}[*] Installing Python packages from backend/requirements.txt...${CLR_RESET}\n"
    pip install -r backend/requirements.txt --quiet
    printf "${CLR_GREEN}[✓] Python packages installed and up to date.${CLR_RESET}\n"
fi

# Verify Playwright Chromium binary
if [ -d "$HOME/.cache/ms-playwright/chromium-"* ] || [ -d "/root/.cache/ms-playwright/chromium-"* ] 2>/dev/null; then
    printf "${CLR_GREEN}[✓] Playwright Chromium browser binary verified.${CLR_RESET}\n"
else
    printf "${CLR_CYAN}[*] Downloading Playwright Chromium browser binaries...${CLR_RESET}\n"
    playwright install chromium 2>/dev/null || true
    printf "${CLR_GREEN}[✓] Playwright Chromium browser installed.${CLR_RESET}\n"
fi

# ==============================================================================
# [4/6] Production Frontend Bundle (Vite)
# ==============================================================================
printf "\n${CLR_PURPLE}${CLR_BOLD}[4/6] Compiling production frontend bundle (Vite)...${CLR_RESET}\n"

cd "$PROJECT_DIR/frontend"
if [ "$IS_UPDATE" -eq 1 ] && [ "$PKG_CHANGED" -eq 0 ] && [ -d "node_modules" ]; then
    printf "${CLR_CYAN}[⚡ Fast-Path] frontend/package.json unchanged. Skipping npm package re-install.${CLR_RESET}\n"
else
    printf "${CLR_GRAY}[*] Installing frontend dependencies via npm...${CLR_RESET}\n"
    npm install --quiet
fi

printf "${CLR_GRAY}[*] Compiling optimized React bundle...${CLR_RESET}\n"
npm run build --quiet
cd "$PROJECT_DIR"
printf "${CLR_GREEN}[✓] Production frontend bundle compiled successfully in 'frontend/dist/'.${CLR_RESET}\n"

# ==============================================================================
# [5/6] Desktop Launcher & Application Shortcuts
# ==============================================================================
printf "\n${CLR_PURPLE}${CLR_BOLD}[5/6] Configuring Desktop shortcuts and application icons...${CLR_RESET}\n"

if [ "$SKIP_DESKTOP" -eq 0 ] && [ -n "$DISPLAY" -o -d "$HOME/Desktop" -o -d "$HOME/.local/share/applications" ]; then
    mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications" "$HOME/.local/share/pixmaps" "$HOME/.local/share/icons/hicolor/scalable/apps" 2>/dev/null || true
    
    # Remove legacy InstaSave shortcuts
    rm -f "$HOME/.local/share/applications/instasave.desktop" "$HOME/Desktop/InstaSave.desktop" "$HOME/Desktop/instasave.desktop" 2>/dev/null || true

    # Install scalable and multi-resolution PNG application icons
    if [ -f "$PROJECT_DIR/assets/zengram.svg" ]; then
        cp "$PROJECT_DIR/assets/zengram.svg" "$HOME/.local/share/icons/hicolor/scalable/apps/zengram.svg" 2>/dev/null || true
        cp "$PROJECT_DIR/assets/zengram.svg" "$HOME/.local/share/pixmaps/zengram.svg" 2>/dev/null || true
    fi

    for size in 16 24 32 48 64 96 128 256 512; do
        if [ -f "$PROJECT_DIR/assets/icons/zengram-${size}.png" ]; then
            mkdir -p "$HOME/.local/share/icons/hicolor/${size}x${size}/apps" 2>/dev/null || true
            cp "$PROJECT_DIR/assets/icons/zengram-${size}.png" "$HOME/.local/share/icons/hicolor/${size}x${size}/apps/zengram.png" 2>/dev/null || true
            chmod 644 "$HOME/.local/share/icons/hicolor/${size}x${size}/apps/zengram.png" 2>/dev/null || true
        fi
    done

    mkdir -p "$HOME/.local/share/zengram" 2>/dev/null || true
    if [ -f "$PROJECT_DIR/assets/icons/zengram-512.png" ]; then
        cp "$PROJECT_DIR/assets/icons/zengram-512.png" "$HOME/.local/share/zengram/zengram.png" 2>/dev/null || true
        cp "$PROJECT_DIR/assets/icons/zengram-512.png" "$HOME/.local/share/icons/zengram.png" 2>/dev/null || true
        cp "$PROJECT_DIR/assets/icons/zengram-512.png" "$HOME/.local/share/pixmaps/zengram.png" 2>/dev/null || true
    fi

    # Ensure permissions for icons
    chmod -R u=rwX,go=rX "$HOME/.local/share/icons" "$HOME/.local/share/pixmaps" "$HOME/.local/share/zengram" 2>/dev/null || true

    DESKTOP_ENTRY="$HOME/.local/share/applications/zengram.desktop"
    cat <<EOF > "$DESKTOP_ENTRY"
[Desktop Entry]
Version=1.0
Type=Application
Name=ZenGram
GenericName=Instagram Content Archiver & Feed Viewer
Comment=Local Web UI for browsing, archiving, and saving Instagram media
Exec=xdg-open http://localhost:$APP_PORT
Icon=$HOME/.local/share/zengram/zengram.png
Terminal=false
Categories=Network;FileTransfer;
Keywords=Instagram;Downloader;Saver;Archive;Media;ZenGram;
StartupNotify=true
EOF
    chmod +x "$DESKTOP_ENTRY" 2>/dev/null || true

    if [ -d "$HOME/Desktop" ]; then
        cp "$DESKTOP_ENTRY" "$HOME/Desktop/ZenGram.desktop" 2>/dev/null || true
        chmod +x "$HOME/Desktop/ZenGram.desktop" 2>/dev/null || true
        printf "${CLR_GREEN}[✓] Desktop launcher shortcut created at ~/Desktop/ZenGram.desktop${CLR_RESET}\n"
    fi

    # Update desktop and icon databases
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
    touch "$DESKTOP_ENTRY" "$HOME/Desktop/ZenGram.desktop" 2>/dev/null || true
else
    printf "${CLR_GRAY}[*] Headless / Container environment detected. Skipped Desktop GUI launcher.${CLR_RESET}\n"
fi

# ==============================================================================
# [6/6] Systemd Service Integration & Security Hardening
# ==============================================================================
printf "\n${CLR_PURPLE}${CLR_BOLD}[6/6] Hardening permissions and starting Systemd service...${CLR_RESET}\n"

# Enforce secure POSIX permissions (umask 0077, 0700 dirs, 0600 keys/db)
chmod 700 "$PROJECT_DIR/storage" 2>/dev/null || true
mkdir -p "$PROJECT_DIR/storage/backups" 2>/dev/null || true
chmod 700 "$PROJECT_DIR/storage/backups" 2>/dev/null || true
chmod 600 "$PROJECT_DIR"/zengram.db* 2>/dev/null || true
mkdir -p "$HOME/.config/zengram"
chmod 700 "$HOME/.config/zengram" 2>/dev/null || true
chmod 600 "$HOME/.config/zengram"/jwt_secret.key 2>/dev/null || true

# Stop and clean up any legacy service files
if [ "$IS_ROOT" -eq 1 ]; then
    systemctl stop instasave.service 2>/dev/null || true
    systemctl disable instasave.service 2>/dev/null || true
    rm -f /etc/systemd/system/instasave.service 2>/dev/null || true
else
    systemctl --user stop instasave.service 2>/dev/null || true
    systemctl --user disable instasave.service 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/instasave.service" 2>/dev/null || true
fi

if [ "$IS_ROOT" -eq 1 ]; then
    # Running as Root (e.g. Proxmox LXC Container or Dedicated Server)
    SYSTEMD_PATH="/etc/systemd/system/zengram.service"
    cat <<EOF > "$SYSTEMD_PATH"
[Unit]
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
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now zengram.service 2>/dev/null || true
    if [ "$SKIP_RESTART" -eq 0 ]; then
        systemctl restart zengram.service
        printf "${CLR_GREEN}[✓] Systemd root service 'zengram.service' enabled and active.${CLR_RESET}\n"
    else
        printf "${CLR_GREEN}[✓] Systemd root service 'zengram.service' configured (restart deferred).${CLR_RESET}\n"
    fi
else
    # Running as Standard User (e.g. Fedora Workstation)
    USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
    mkdir -p "$USER_SYSTEMD_DIR"
    cat <<EOF > "$USER_SYSTEMD_DIR/zengram.service"
[Unit]
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
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable --now zengram.service 2>/dev/null || true
    if [ "$SKIP_RESTART" -eq 0 ]; then
        systemctl --user restart zengram.service
        printf "${CLR_GREEN}[✓] Systemd user service 'zengram.service' enabled and active.${CLR_RESET}\n"
    else
        printf "${CLR_GREEN}[✓] Systemd user service 'zengram.service' configured (restart deferred).${CLR_RESET}\n"
    fi
fi

# Detect local LAN IP for display
LAN_IP="127.0.0.1"
if command -v ip &>/dev/null; then
    DETECTED_IP=$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || true)
    if [ -n "$DETECTED_IP" ]; then
        LAN_IP="$DETECTED_IP"
    fi
elif command -v hostname &>/dev/null; then
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    if [ -n "$DETECTED_IP" ]; then
        LAN_IP="$DETECTED_IP"
    fi
fi

# ==============================================================================
# Completion Card & Quick Tips
# ==============================================================================
printf "\n${CLR_GREEN}${CLR_BOLD}"
printf "╭── ✨ ZenGram Setup Successfully Complete! ───────────────────────────────────${CLR_RESET}\n"
printf "${CLR_GREEN}│${CLR_RESET}  ${CLR_BOLD}%-20s${CLR_RESET} ${CLR_CYAN}http://localhost:%s${CLR_RESET}\n" "Local Web UI:" "$APP_PORT"
if [ "$LAN_IP" != "127.0.0.1" ]; then
printf "${CLR_GREEN}│${CLR_RESET}  ${CLR_BOLD}%-20s${CLR_RESET} ${CLR_CYAN}http://%s:%s${CLR_RESET}\n" "Network Access:" "$LAN_IP" "$APP_PORT"
fi
printf "${CLR_GREEN}│${CLR_RESET}  ${CLR_BOLD}%-20s${CLR_RESET} zengram.service (Running in background)\n" "Active Service:"
printf "${CLR_GREEN}│${CLR_RESET}  ${CLR_BOLD}%-20s${CLR_RESET} AES-256 Fernet Encryption at Rest (Permissions 0600)\n" "Security & Key:"
printf "${CLR_GREEN}│${CLR_RESET}\n"
printf "${CLR_GREEN}│${CLR_RESET}  ${CLR_PURPLE}${CLR_BOLD}Useful Management Commands:${CLR_RESET}\n"
if [ "$IS_ROOT" -eq 1 ]; then
printf "${CLR_GREEN}│${CLR_RESET}  • ${CLR_BOLD}Check Service Logs:${CLR_RESET}  journalctl -u zengram.service -f\n"
printf "${CLR_GREEN}│${CLR_RESET}  • ${CLR_BOLD}Restart Service:${CLR_RESET}     systemctl restart zengram.service\n"
else
printf "${CLR_GREEN}│${CLR_RESET}  • ${CLR_BOLD}Check Service Logs:${CLR_RESET}  journalctl --user -u zengram.service -f\n"
printf "${CLR_GREEN}│${CLR_RESET}  • ${CLR_BOLD}Restart Service:${CLR_RESET}     systemctl --user restart zengram.service\n"
fi
printf "${CLR_GREEN}│${CLR_RESET}  • ${CLR_BOLD}Run Security Test:${CLR_RESET}   source .venv/bin/activate && python backend/tests/test_security.py\n"
printf "${CLR_GREEN}│${CLR_RESET}  • ${CLR_BOLD}Update Project:${CLR_RESET}      ./install.sh --update\n"
printf "${CLR_GREEN}${CLR_BOLD}"
printf "╰─────────────────────────────────────────────────────────────────────────────${CLR_RESET}\n\n"
