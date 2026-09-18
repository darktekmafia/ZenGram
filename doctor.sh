#!/usr/bin/env bash
# ==============================================================================
#  ZenGram - Interactive CLI & TUI Diagnostic Hub
#  Quick execution wrapper for backend.cli
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ -f "$PROJECT_DIR/.venv/bin/python" ]; then
    PYTHON_EXEC="$PROJECT_DIR/.venv/bin/python"
elif command -v python3 &>/dev/null; then
    PYTHON_EXEC="python3"
else
    echo "Error: Python 3 executable not found. Run ./install.sh first."
    exit 1
fi

export PYTHONPATH="$PROJECT_DIR"
exec "$PYTHON_EXEC" -m backend.cli "$@"
