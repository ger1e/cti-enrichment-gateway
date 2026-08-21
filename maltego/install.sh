#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
BOOTSTRAP="$ROOT/bootstrap.py"

version_ok() {
    "$1" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1
}

find_python() {
    for candidate in \
        "${CTI_PYTHON:-}" \
        python3.12 \
        /opt/homebrew/bin/python3.12 \
        /usr/local/bin/python3.12 \
        python3.13 \
        python3.11 \
        python3.10 \
        python3 \
        python
    do
        [ -n "$candidate" ] || continue
        if command -v "$candidate" >/dev/null 2>&1; then
            resolved=$(command -v "$candidate")
        elif [ -x "$candidate" ]; then
            resolved=$candidate
        else
            continue
        fi
        if version_ok "$resolved"; then
            printf '%s\n' "$resolved"
            return 0
        fi
    done
    return 1
}

find_brew() {
    if command -v brew >/dev/null 2>&1; then
        command -v brew
        return 0
    fi
    for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew /home/linuxbrew/.linuxbrew/bin/brew; do
        if [ -x "$candidate" ]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done
    return 1
}

install_macos_python() {
    brew_bin=$(find_brew || true)
    if [ -z "$brew_bin" ]; then
        cat >&2 <<'EOF'
Python >=3.10 is required and no compatible interpreter was found.
Homebrew is not available. Install Homebrew from https://brew.sh/ and rerun ./install.sh.
The installer deliberately does not execute a remote bootstrap script automatically.
EOF
        return 1
    fi
    printf '%s\n' 'Installing Homebrew Python 3.12...' >&2
    "$brew_bin" install python@3.12
    prefix=$($brew_bin --prefix python@3.12)
    candidate="$prefix/bin/python3.12"
    if [ ! -x "$candidate" ] || ! version_ok "$candidate"; then
        printf '%s\n' 'Homebrew Python installation completed but Python >=3.10 could not be verified.' >&2
        return 1
    fi
    printf '%s\n' "$candidate"
}

linux_guidance() {
    if command -v apt-get >/dev/null 2>&1; then
        printf '%s\n' 'Install a Python >=3.10 interpreter plus venv support (for example: sudo apt-get install python3 python3-venv), then rerun ./install.sh.' >&2
    elif command -v dnf >/dev/null 2>&1; then
        printf '%s\n' 'Install Python >=3.10 (for example: sudo dnf install python3), then rerun ./install.sh.' >&2
    elif command -v yum >/dev/null 2>&1; then
        printf '%s\n' 'Install Python >=3.10 using yum, then rerun ./install.sh.' >&2
    elif command -v zypper >/dev/null 2>&1; then
        printf '%s\n' 'Install Python >=3.10 (for example: sudo zypper install python3), then rerun ./install.sh.' >&2
    elif command -v pacman >/dev/null 2>&1; then
        printf '%s\n' 'Install Python >=3.10 (for example: sudo pacman -S python), then rerun ./install.sh.' >&2
    elif command -v apk >/dev/null 2>&1; then
        printf '%s\n' 'Install Python >=3.10 (for example: sudo apk add python3 py3-pip), then rerun ./install.sh.' >&2
    else
        printf '%s\n' 'Install Python >=3.10 with venv support, then rerun ./install.sh.' >&2
    fi
}

PYTHON=$(find_python || true)
if [ -z "$PYTHON" ]; then
    case "$(uname -s 2>/dev/null || printf unknown)" in
        Darwin)
            PYTHON=$(install_macos_python || true)
            ;;
        Linux)
            brew_bin=$(find_brew || true)
            if [ -n "$brew_bin" ]; then
                printf '%s\n' 'Installing Homebrew Python 3.12...' >&2
                "$brew_bin" install python@3.12
                prefix=$($brew_bin --prefix python@3.12)
                candidate="$prefix/bin/python3.12"
                if [ -x "$candidate" ] && version_ok "$candidate"; then
                    PYTHON=$candidate
                fi
            fi
            if [ -z "$PYTHON" ]; then
                linux_guidance
            fi
            ;;
        *)
            printf '%s\n' 'Unsupported platform for install.sh. Use install.ps1 on Windows.' >&2
            ;;
    esac
fi

if [ -z "$PYTHON" ] || ! version_ok "$PYTHON"; then
    exit 2
fi

exec "$PYTHON" "$BOOTSTRAP" "$@"
