#!/usr/bin/env python3
"""
ZenGram CLI & TUI Diagnostic Hub
Interactive terminal diagnostic tool and command-line management utility for ZenGram.
"""

import sys
import os
import time
import shutil
import asyncio
import sqlite3
import argparse
import datetime
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List

# Ensure project root is in sys.path
PROJECT_DIR = Path(__file__).resolve().parent.parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

# Color and Styling Helpers
USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None and os.environ.get("TERM") != "dumb"

CLR_CYAN = "\033[38;5;39m" if USE_COLOR else ""
CLR_PURPLE = "\033[38;5;141m" if USE_COLOR else ""
CLR_GREEN = "\033[38;5;42m" if USE_COLOR else ""
CLR_YELLOW = "\033[38;5;214m" if USE_COLOR else ""
CLR_RED = "\033[38;5;203m" if USE_COLOR else ""
CLR_GRAY = "\033[38;5;244m" if USE_COLOR else ""
CLR_BOLD = "\033[1m" if USE_COLOR else ""
CLR_RESET = "\033[0m" if USE_COLOR else ""


def print_banner():
    """Print styled ZenGram ASCII banner."""
    print(f"{CLR_PURPLE}{CLR_BOLD}")
    print(r"""  ███████╗███████╗███╗   ██╗ ██████╗ ██████╗  █████╗ ███╗   ███╗
  ╚══███╔╝██╔════╝████╗  ██║██╔════╝ ██╔══██╗██╔══██╗████╗ ████║
    ███╔╝ █████╗  ██╔██╗ ██║██║  ███╗██████╔╝███████║██╔████╔██║
   ███╔╝  ██╔══╝  ██║╚██╗██║██║   ██║██╔══██╗██╔══██║██║╚██╔╝██║
  ███████╗███████╗██║ ╚████║╚██████╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
  ╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝""")
    print(f"{CLR_RESET}", end="")
    print(f"{CLR_GRAY}   Interactive Diagnostic Hub & Administrative Control Center{CLR_RESET}\n")


def print_section(title: str):
    """Print section header."""
    print(f"\n{CLR_CYAN}╭── {title} " + "─" * max(0, 68 - len(title)) + f"{CLR_RESET}")


def print_section_end():
    """Print section footer."""
    print(f"{CLR_CYAN}╰" + "─" * 73 + f"{CLR_RESET}\n")


def print_kv(label: str, value: str, status_color: str = ""):
    """Print formatted key-value line inside section bracket."""
    val_colored = f"{status_color}{value}{CLR_RESET}" if status_color else value
    print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}{label:<22}{CLR_RESET} {val_colored}")


# -------------------------------------------------------------
# Module 1: Security & Encryption Audit
# -------------------------------------------------------------

def audit_security(interactive: bool = True) -> bool:
    """Audit encryption key, file permissions, and run security tests."""
    print_section("Security & Credential Encryption Audit")
    
    key_path = Path.home() / ".config" / "zengram" / "jwt_secret.key"
    config_dir = Path.home() / ".config" / "zengram"
    db_path = PROJECT_DIR / "zengram.db"
    storage_dir = PROJECT_DIR / "storage"
    
    all_ok = True
    
    # 1. Config directory permissions
    if config_dir.exists():
        mode = oct(config_dir.stat().st_mode)[-3:]
        if mode in ("700", "750", "755"):
            print_kv("Config Directory:", f"{config_dir} (Mode: {mode})", CLR_GREEN)
        else:
            print_kv("Config Directory:", f"{config_dir} (Mode: {mode} - should be 0700)", CLR_YELLOW)
    else:
        print_kv("Config Directory:", "Not found (Will be created on first start)", CLR_GRAY)

    # 2. Secret Key File & Permissions
    if key_path.exists():
        mode = oct(key_path.stat().st_mode)[-3:]
        key_valid = False
        try:
            with open(key_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if len(content) >= 32:
                    key_valid = True
        except Exception:
            key_valid = False

        if key_valid and mode in ("600", "400"):
            print_kv("Encryption Key:", f"Present & Protected ({key_path} - Mode: {mode})", CLR_GREEN)
        elif key_valid:
            print_kv("Encryption Key:", f"Valid Key (Mode: {mode} - Hardening recommended to 0600)", CLR_YELLOW)
            try:
                os.chmod(key_path, 0o600)
                print_kv("Auto-Hardened:", "Permissions adjusted to 0600", CLR_GREEN)
            except Exception as e:
                print_kv("Hardening Error:", str(e), CLR_RED)
        else:
            print_kv("Encryption Key:", "Key file corrupted or unreadable", CLR_RED)
            all_ok = False
    else:
        print_kv("Encryption Key:", "No secret key found (will auto-generate on first login)", CLR_YELLOW)

    # 3. Storage Directory & Database Permissions
    if storage_dir.exists():
        mode = oct(storage_dir.stat().st_mode)[-3:]
        print_kv("Storage Directory:", f"{storage_dir} (Mode: {mode})", CLR_GREEN if mode == "700" else CLR_YELLOW)
    if db_path.exists():
        mode = oct(db_path.stat().st_mode)[-3:]
        print_kv("SQLite Database:", f"{db_path.name} (Mode: {mode})", CLR_GREEN if mode in ("600", "644") else CLR_YELLOW)

    # 4. Run Automated Security Test Suite
    print(f"{CLR_CYAN}│{CLR_RESET}")
    print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}Running Security Regression Suite...{CLR_RESET}")
    
    test_script = PROJECT_DIR / "backend" / "tests" / "test_security.py"
    if test_script.exists():
        venv_python = PROJECT_DIR / ".venv" / "bin" / "python"
        py_exec = str(venv_python) if venv_python.exists() else sys.executable
        
        proc = subprocess.run(
            [py_exec, str(test_script)],
            cwd=str(PROJECT_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if proc.returncode == 0:
            print_kv("Security Tests:", "All automated tests PASSED [100% OK]", CLR_GREEN)
        else:
            print_kv("Security Tests:", f"FAILED with exit code {proc.returncode}", CLR_RED)
            all_ok = False
            for line in proc.stdout.splitlines()[-4:]:
                if line.strip():
                    print(f"{CLR_CYAN}│{CLR_RESET}    {CLR_GRAY}{line}{CLR_RESET}")
    else:
        print_kv("Security Tests:", "test_security.py not found", CLR_YELLOW)

    print_section_end()
    return all_ok


# -------------------------------------------------------------
# Module 2: Instagram Session Health & Relogin
# -------------------------------------------------------------

def check_instagram_session(interactive: bool = True):
    """Inspect active Instagram session, validate cookie decryption and API connectivity."""
    print_section("Instagram Session Health & Credentials")

    from backend.app.config import settings
    from backend.app.auth_utils import decrypt_secret

    db_path = PROJECT_DIR / "zengram.db"
    if not db_path.exists():
        print_kv("Database:", "No database found. Run ZenGram service first.", CLR_YELLOW)
        print_section_end()
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id, username, session_cookie, is_active, created_at, last_validated_at FROM user_sessions ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        
        if not row:
            print_kv("Instagram Session:", "No Instagram account currently logged in.", CLR_YELLOW)
            print_kv("Status:", "Guest / Anonymous scraping mode", CLR_GRAY)
            print_section_end()
            return

        session_id, username, raw_cookie, is_active, created_at, last_validated_at = row
        print_kv("Account Username:", f"@{username}", CLR_CYAN)
        print_kv("Session Active:", "Active" if is_active else "Inactive", CLR_GREEN if is_active else CLR_RED)
        print_kv("Created Date:", str(created_at) if created_at else "N/A")
        print_kv("Last Validated:", str(last_validated_at) if last_validated_at else "Not yet validated")

        # Decrypt cookie
        decrypted_cookie = ""
        try:
            decrypted_cookie = decrypt_secret(raw_cookie)
            if decrypted_cookie and decrypted_cookie != "dummy_session_cookie":
                masked = decrypted_cookie[:6] + "..." + decrypted_cookie[-4:] if len(decrypted_cookie) > 10 else "***"
                print_kv("Session ID Cookie:", f"Encrypted at Rest ({masked})", CLR_GREEN)
            else:
                print_kv("Session ID Cookie:", "No active sessionid cookie stored", CLR_YELLOW)
        except Exception as e:
            print_kv("Decryption:", f"Failed to decrypt ({e})", CLR_RED)

        # Optional interactive cookie update
        if interactive and decrypted_cookie:
            print(f"{CLR_CYAN}│{CLR_RESET}")
            print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}Options:{CLR_RESET} [1] Test Session Validity [2] Update sessionid Cookie [3] Clear Session [Enter to Skip]")
            choice = input(f"{CLR_CYAN}│{CLR_RESET}  Select action (1-3): ").strip()

            if choice == "1":
                _test_live_session(username, decrypted_cookie)
            elif choice == "2":
                _prompt_update_cookie(conn, cursor, session_id, username)
            elif choice == "3":
                cursor.execute("DELETE FROM user_sessions WHERE id = ?", (session_id,))
                conn.commit()
                print_kv("Action:", "Instagram session removed successfully.", CLR_GREEN)

    except sqlite3.OperationalError as e:
        print_kv("Database Error:", f"Could not read user_sessions table ({e})", CLR_RED)
    finally:
        conn.close()

    print_section_end()


def _test_live_session(username: str, sessionid: str):
    """Test session cookie against Instagram API."""
    print_kv("Testing Session:", "Connecting to Instagram API...", CLR_CYAN)
    import urllib.request
    import json

    req = urllib.request.Request(
        f"https://i.instagram.com/api/v1/users/web_profile_info/?username={username}",
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Cookie": f"sessionid={sessionid};",
            "X-IG-App-ID": "936619743392459"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                print_kv("Instagram API:", f"Session VALID for @{username} (HTTP 200 OK)", CLR_GREEN)
            else:
                print_kv("Instagram API:", f"Response Status: HTTP {resp.status}", CLR_YELLOW)
    except Exception as e:
        print_kv("Instagram API:", f"Verification failed ({e})", CLR_RED)


def _prompt_update_cookie(conn: sqlite3.Connection, cursor: sqlite3.Cursor, session_id: int, username: str):
    """Prompt user to paste a new sessionid cookie value."""
    from backend.app.auth_utils import encrypt_secret
    new_cookie = input(f"{CLR_CYAN}│{CLR_RESET}  Enter new sessionid cookie: ").strip()
    if new_cookie:
        encrypted = encrypt_secret(new_cookie)
        cursor.execute("UPDATE user_sessions SET session_cookie = ?, last_validated_at = ? WHERE id = ?",
                       (encrypted, datetime.datetime.utcnow().isoformat(), session_id))
        conn.commit()
        print_kv("Action:", f"sessionid cookie updated and encrypted for @{username}.", CLR_GREEN)


# -------------------------------------------------------------
# Module 3: Database Integrity & Optimization
# -------------------------------------------------------------

def check_database_health(interactive: bool = True):
    """Run PRAGMA integrity_check, table stats, and vacuum optimization."""
    print_section("Database Health & Integrity")

    db_path = PROJECT_DIR / "zengram.db"
    if not db_path.exists():
        print_kv("Database File:", "zengram.db does not exist yet.", CLR_YELLOW)
        print_section_end()
        return

    size_mb = db_path.stat().st_size / (1024 * 1024)
    print_kv("Database File:", f"{db_path.name} ({size_mb:.2f} MB)")

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    try:
        # 1. Integrity Check
        cursor.execute("PRAGMA integrity_check;")
        res_integrity = cursor.fetchone()[0]
        if res_integrity.lower() == "ok":
            print_kv("PRAGMA Integrity:", "OK (No corruption detected)", CLR_GREEN)
        else:
            print_kv("PRAGMA Integrity:", f"Warning: {res_integrity}", CLR_RED)

        # 2. Table Record Statistics
        tables = [
            ("media_items", "Archived Media Items"),
            ("watched_profiles", "Tracked Profiles"),
            ("bookmark_folders", "Bookmark Folders"),
            ("download_jobs", "Queued Download Jobs"),
            ("user_sessions", "Stored User Sessions")
        ]

        print(f"{CLR_CYAN}│{CLR_RESET}")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}Database Table Statistics:{CLR_RESET}")
        for table, label in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print_kv(f"  • {label}:", f"{count:,} records")
            except Exception:
                print_kv(f"  • {label}:", "Table not created yet", CLR_GRAY)

        # 3. Vacuum Option
        if interactive:
            print(f"{CLR_CYAN}│{CLR_RESET}")
            opt = input(f"{CLR_CYAN}│{CLR_RESET}  Run VACUUM & ANALYZE to optimize indexes and reclaim disk space? (y/N): ").strip().lower()
            if opt in ("y", "yes"):
                print_kv("Optimizing:", "Running SQLite VACUUM and ANALYZE...", CLR_CYAN)
                cursor.execute("VACUUM;")
                cursor.execute("ANALYZE;")
                conn.commit()
                new_size = db_path.stat().st_size / (1024 * 1024)
                print_kv("Result:", f"Database optimized successfully ({new_size:.2f} MB).", CLR_GREEN)

    except Exception as e:
        print_kv("Database Error:", str(e), CLR_RED)
    finally:
        conn.close()

    print_section_end()


# -------------------------------------------------------------
# Module 4: Server Database Backups & Restore
# -------------------------------------------------------------

def manage_backups(interactive: bool = True):
    """List snapshots, create immediate backup, or restore from a snapshot."""
    print_section("Server Database Backups & Recovery")

    backups_dir = PROJECT_DIR / "storage" / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(backups_dir, 0o700)

    snapshots = sorted(list(backups_dir.glob("zengram_backup_*.tar.gz")), key=os.path.getmtime, reverse=True)
    print_kv("Backup Location:", f"{backups_dir} (Mode: 0700)")
    print_kv("Saved Snapshots:", f"{len(snapshots)} snapshots found")

    if snapshots:
        print(f"{CLR_CYAN}│{CLR_RESET}")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}Available Snapshots:{CLR_RESET}")
        for idx, snap in enumerate(snapshots[:5], 1):
            size_kb = snap.stat().st_size / 1024
            mtime = datetime.datetime.fromtimestamp(snap.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            print_kv(f"  [{idx}] {snap.name}:", f"{size_kb:.1f} KB • {mtime}")

    if interactive:
        print(f"{CLR_CYAN}│{CLR_RESET}")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}Options:{CLR_RESET} [1] Create Backup Now [2] Restore from Snapshot [Enter to Skip]")
        choice = input(f"{CLR_CYAN}│{CLR_RESET}  Select action (1-2): ").strip()

        if choice == "1":
            create_backup_snapshot()
        elif choice == "2" and snapshots:
            snap_choice = input(f"{CLR_CYAN}│{CLR_RESET}  Enter snapshot number to restore (1-{len(snapshots[:5])}): ").strip()
            if snap_choice.isdigit() and 1 <= int(snap_choice) <= len(snapshots[:5]):
                target_snap = snapshots[int(snap_choice) - 1]
                _restore_snapshot(target_snap)

    print_section_end()


def create_backup_snapshot() -> Optional[Path]:
    """Create a tar.gz snapshot of zengram.db and jwt_secret.key."""
    import tarfile
    backups_dir = PROJECT_DIR / "storage" / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_tar = backups_dir / f"zengram_backup_{timestamp}.tar.gz"

    db_path = PROJECT_DIR / "zengram.db"
    key_path = Path.home() / ".config" / "zengram" / "jwt_secret.key"

    if not db_path.exists():
        print_kv("Backup Error:", "zengram.db not found. Nothing to backup.", CLR_YELLOW)
        return None

    try:
        with tarfile.open(backup_tar, "w:gz") as tar:
            tar.add(db_path, arcname="zengram.db")
            if key_path.exists():
                tar.add(key_path, arcname="jwt_secret.key")

        os.chmod(backup_tar, 0o600)
        size_kb = backup_tar.stat().st_size / 1024
        print_kv("Backup Created:", f"{backup_tar.name} ({size_kb:.1f} KB)", CLR_GREEN)
        return backup_tar
    except Exception as e:
        print_kv("Backup Failed:", str(e), CLR_RED)
        return None


def _restore_snapshot(snap_path: Path):
    """Restore database and secret key from snapshot archive."""
    import tarfile
    confirm = input(f"{CLR_CYAN}│{CLR_RESET}  {CLR_YELLOW}Warning: This will overwrite active zengram.db! Confirm? (yes/N): {CLR_RESET}").strip().lower()
    if confirm != "yes":
        print_kv("Restore:", "Cancelled by user.", CLR_GRAY)
        return

    try:
        with tarfile.open(snap_path, "r:gz") as tar:
            for member in tar.getmembers():
                if member.name == "zengram.db":
                    tar.extract(member, path=str(PROJECT_DIR))
                    os.chmod(PROJECT_DIR / "zengram.db", 0o600)
                elif member.name == "jwt_secret.key":
                    key_dir = Path.home() / ".config" / "zengram"
                    key_dir.mkdir(parents=True, exist_ok=True)
                    tar.extract(member, path=str(key_dir))
                    os.chmod(key_dir / "jwt_secret.key", 0o600)

        print_kv("Restore Result:", f"Successfully restored from {snap_path.name}", CLR_GREEN)
    except Exception as e:
        print_kv("Restore Failed:", str(e), CLR_RED)


# -------------------------------------------------------------
# Module 5: System Diagnostics & Live Logs
# -------------------------------------------------------------

def check_system_diagnostics(interactive: bool = True):
    """Check systemd service status, memory/disk usage, and stream logs."""
    print_section("System Diagnostics & Service Health")

    # 1. Systemd Service Detection
    is_root = (os.geteuid() == 0) if hasattr(os, "geteuid") else False
    svc_cmd = ["systemctl", "status", "zengram.service"] if is_root else ["systemctl", "--user", "status", "zengram.service"]
    log_cmd = "journalctl -u zengram.service -f" if is_root else "journalctl --user -u zengram.service -f"

    proc = subprocess.run(svc_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if "Active: active (running)" in proc.stdout:
        print_kv("Systemd Service:", "zengram.service is ACTIVE (Running)", CLR_GREEN)
    elif "Active: inactive" in proc.stdout:
        print_kv("Systemd Service:", "zengram.service is INACTIVE (Stopped)", CLR_YELLOW)
    else:
        print_kv("Systemd Service:", "zengram.service status unknown or uninstalled", CLR_GRAY)

    # 2. Disk Usage
    storage_dir = PROJECT_DIR / "storage"
    if storage_dir.exists():
        total_bytes = sum(f.stat().st_size for f in storage_dir.rglob('*') if f.is_file())
        size_mb = total_bytes / (1024 * 1024)
        print_kv("Media Storage Disk:", f"{size_mb:.1f} MB used in storage/")

    # 3. Live Logs Streaming Option
    if interactive:
        print(f"{CLR_CYAN}│{CLR_RESET}")
        opt = input(f"{CLR_CYAN}│{CLR_RESET}  Stream live ZenGram service logs now? (y/N): ").strip().lower()
        if opt in ("y", "yes"):
            print_kv("Logs:", f"Streaming live logs via '{log_cmd}' (Press Ctrl+C to exit)...", CLR_CYAN)
            print_section_end()
            try:
                cmd_list = ["journalctl", "-u", "zengram.service", "-f"] if is_root else ["journalctl", "--user", "-u", "zengram.service", "-f"]
                subprocess.run(cmd_list)
            except KeyboardInterrupt:
                print(f"\n{CLR_GRAY}Log streaming ended.{CLR_RESET}")
            return

    print_section_end()


# -------------------------------------------------------------
# Module 6: Software Update Runner
# -------------------------------------------------------------

def run_update_engine():
    """Run ./install.sh --update directly."""
    print_section("ZenGram Software Update Runner")
    installer = PROJECT_DIR / "install.sh"
    if not installer.exists():
        print_kv("Update Error:", "install.sh script not found.", CLR_RED)
        print_section_end()
        return

    print_kv("Launching:", "./install.sh --update", CLR_CYAN)
    print_section_end()
    subprocess.run(["bash", str(installer), "--update"], cwd=str(PROJECT_DIR))


# -------------------------------------------------------------
# One-Shot Dashboard
# -------------------------------------------------------------

def show_status_dashboard():
    """Display comprehensive non-interactive health dashboard."""
    print_banner()
    audit_security(interactive=False)
    check_instagram_session(interactive=False)
    check_database_health(interactive=False)
    manage_backups(interactive=False)
    check_system_diagnostics(interactive=False)


# -------------------------------------------------------------
# Main Interactive TUI Menu Loop
# -------------------------------------------------------------

def interactive_menu_loop():
    """Main interactive TUI menu loop."""
    while True:
        # Clear screen for crisp presentation if TTY
        if USE_COLOR:
            os.system("clear 2>/dev/null || printf '\\033c' 2>/dev/null || true")

        print_banner()
        print(f"{CLR_CYAN}╭── Diagnostic & Management Menu ─────────────────────────────────────────────{CLR_RESET}")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[1]{CLR_RESET} 🔒 Security & Credential Encryption Audit")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[2]{CLR_RESET} 📸 Instagram Session Health & Relogin")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[3]{CLR_RESET} 🗄️  Database Integrity & Vacuum Optimization")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[4]{CLR_RESET} 💾 Server Database Backups & Recovery")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[5]{CLR_RESET} 📊 System Diagnostics & Live Logs")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[6]{CLR_RESET} ⚡ Run Software Update (install.sh --update)")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[7]{CLR_RESET} 📈 Full Status Overview (One-Shot Dashboard)")
        print(f"{CLR_CYAN}│{CLR_RESET}  {CLR_BOLD}[0]{CLR_RESET} 🚪 Exit")
        print(f"{CLR_CYAN}╰─────────────────────────────────────────────────────────────────────────────{CLR_RESET}\n")

        try:
            choice = input(f"{CLR_BOLD}Select an option (0-7): {CLR_RESET}").strip()
            if choice == "1":
                audit_security(interactive=True)
            elif choice == "2":
                check_instagram_session(interactive=True)
            elif choice == "3":
                check_database_health(interactive=True)
            elif choice == "4":
                manage_backups(interactive=True)
            elif choice == "5":
                check_system_diagnostics(interactive=True)
            elif choice == "6":
                run_update_engine()
            elif choice == "7":
                show_status_dashboard()
            elif choice in ("0", "q", "quit", "exit"):
                print(f"\n{CLR_GREEN}Exiting ZenGram Diagnostic Hub. Goodbye!{CLR_RESET}\n")
                break
            else:
                print(f"\n{CLR_YELLOW}Invalid choice. Please select an option from 0 to 7.{CLR_RESET}")
            
            if choice in ("1", "2", "3", "4", "5", "7"):
                input(f"\n{CLR_GRAY}Press Enter to return to main menu...{CLR_RESET}")

        except (KeyboardInterrupt, EOFError):
            print(f"\n\n{CLR_GREEN}Exiting ZenGram Diagnostic Hub.{CLR_RESET}\n")
            break


# -------------------------------------------------------------
# CLI Entry Point
# -------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="ZenGram CLI & TUI Diagnostic Hub",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--status", action="store_true", help="Display full one-shot status overview")
    parser.add_argument("--security", action="store_true", help="Run security audit and automated regression tests")
    parser.add_argument("--session", action="store_true", help="Inspect Instagram session and cookie health")
    parser.add_argument("--db-check", action="store_true", help="Run SQLite integrity check and table record stats")
    parser.add_argument("--vacuum", action="store_true", help="Run database VACUUM and ANALYZE optimization")
    parser.add_argument("--backup", action="store_true", help="Create an immediate server database backup snapshot")
    parser.add_argument("--logs", action="store_true", help="Stream live service logs (journalctl)")
    parser.add_argument("--update", action="store_true", help="Trigger install.sh --update")

    args = parser.parse_args()

    # Direct flag handling
    if args.status:
        show_status_dashboard()
    elif args.security:
        audit_security(interactive=False)
    elif args.session:
        check_instagram_session(interactive=False)
    elif args.db_check:
        check_database_health(interactive=False)
    elif args.vacuum:
        print_section("Database Optimization")
        db_path = PROJECT_DIR / "zengram.db"
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            conn.execute("VACUUM;")
            conn.execute("ANALYZE;")
            conn.close()
            print_kv("Result:", f"Database {db_path.name} vacuumed and optimized.", CLR_GREEN)
        print_section_end()
    elif args.backup:
        print_section("Database Snapshot Backup")
        create_backup_snapshot()
        print_section_end()
    elif args.logs:
        check_system_diagnostics(interactive=True)
    elif args.update:
        run_update_engine()
    else:
        # Launch Interactive TUI Menu
        interactive_menu_loop()


if __name__ == "__main__":
    main()
