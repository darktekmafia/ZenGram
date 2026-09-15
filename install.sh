#!/usr/bin/env bash
# InstaSave Fedora 44 Automated Installer & Updater Script

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "============================================================"
echo "          InstaSave - Fedora 44 Installation & Update        "
echo "============================================================"

# Check if updating
IS_UPDATE=0
if [[ "$1" == "--update" ]]; then
    IS_UPDATE=1
    echo "[*] Mode: Self-Updating existing installation..."
else
    echo "[*] Mode: Initial Installation..."
fi

# 1. System Package Dependency Verification (Fedora DNF)
echo "[1/5] Verifying Fedora system dependencies..."
COMMAND_DEPS=("python3" "pip3" "ffmpeg" "node" "npm" "sqlite3")
MISSING_DEPS=()

for cmd in "${COMMAND_DEPS[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        MISSING_DEPS+=("$cmd")
    fi
done

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "[!] Missing system dependencies: ${MISSING_DEPS[*]}"
    echo "[*] Installing missing dependencies via dnf..."
    sudo dnf install -y python3 python3-pip ffmpeg nodejs npm sqlite
else
    echo "[✓] All system dependencies (Python, Node, FFmpeg, SQLite) are installed."
fi

# 2. Python Virtual Environment Setup
echo "[2/5] Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

.venv/bin/pip install --upgrade pip --quiet
.venv/bin/pip install -r backend/requirements.txt --quiet
echo "[✓] Python backend dependencies installed."

# 3. Frontend Asset Build
echo "[3/5] Building frontend Web UI assets..."
cd "$PROJECT_DIR/frontend"
npm install --quiet
npm run build --quiet
cd "$PROJECT_DIR"
echo "[✓] Frontend production bundle built cleanly."

# 4. Desktop Launcher & Applications Menu Integration
echo "[4/5] Installing Desktop shortcuts..."
mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications"

# Update path in .desktop file
cat <<EOF > "$HOME/Desktop/InstaSave.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=InstaSave
GenericName=Instagram Content Saver
Comment=Local Web UI for browsing, archiving, and saving Instagram media
Exec=xdg-open http://localhost:8484
Icon=$PROJECT_DIR/assets/instasave.svg
Terminal=false
Categories=Network;FileTransfer;Utility;
Keywords=Instagram;Downloader;Saver;Archive;Media;
StartupNotify=true
EOF

cp "$HOME/Desktop/InstaSave.desktop" "$HOME/.local/share/applications/instasave.desktop"
chmod +x "$HOME/Desktop/InstaSave.desktop" "$HOME/.local/share/applications/instasave.desktop"
echo "[✓] Desktop shortcut installed at ~/Desktop/InstaSave.desktop"

# 5. Systemd User Service Integration
echo "[5/5] Registering Systemd user service..."
mkdir -p "$HOME/.config/systemd/user"

cat <<EOF > "$HOME/.config/systemd/user/instasave.service"
[Unit]
Description=InstaSave Local Web Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8484
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now instasave.service
echo "[✓] Systemd user service 'instasave.service' enabled and started."

echo "============================================================"
echo "   [✓] InstaSave installation complete!"
echo "   Web UI is running at: http://localhost:8484"
echo "============================================================"
