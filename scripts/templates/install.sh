#!/usr/bin/env bash
# CodeGraph Installer
# Usage: ./install.sh [--local | --system | --prefix PATH] [--uninstall] [--force]
set -euo pipefail

VERSION="$(cat "$(dirname "$0")/VERSION" 2>/dev/null || echo "0.1.0")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

PREFIX=""
DATA_DIR=""
UNINSTALL=false
FORCE=false

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --local)
                PREFIX="$HOME/.local/bin"
                DATA_DIR="$HOME/.local/share/codegraph"
                shift ;;
            --system)
                PREFIX="/usr/local/bin"
                DATA_DIR="/usr/local/share/codegraph"
                shift ;;
            --prefix)    PREFIX="$2"; shift 2 ;;
            --data-dir)  DATA_DIR="$2"; shift 2 ;;
            --uninstall) UNINSTALL=true; shift ;;
            --force)     FORCE=true; shift ;;
            -h|--help)
                echo "Usage: $0 [--local | --system | --prefix PATH] [--uninstall] [--force]"
                echo ""
                echo "Scope shortcuts:"
                echo "  --local          User install: ~/.local/bin  (no sudo needed)"
                echo "  --system         System install: /usr/local/bin  (may need sudo)"
                echo ""
                echo "Manual options:"
                echo "  --prefix PATH    Custom binary install directory"
                echo "  --data-dir PATH  Custom data directory (wasm + queries)"
                echo "  --uninstall      Remove codegraph binary and data"
                echo "  --force          Skip confirmation prompts"
                echo ""
                echo "Default (no flags): auto-detects first writable location from:"
                echo "  ~/.local/bin  →  data in ~/.local/share/codegraph"
                echo "  /usr/local/bin  →  data in /usr/local/share/codegraph"
                exit 0
                ;;
            *) die "Unknown option: $1" ;;
        esac
    done
}

# Derive data dir from prefix when not explicitly set.
# Follows XDG: /usr/local/bin → /usr/local/share/codegraph
#               ~/.local/bin  → ~/.local/share/codegraph
derive_data_dir() {
    if [ -n "$DATA_DIR" ]; then return; fi
    local parent
    parent="$(dirname "$PREFIX")"
    DATA_DIR="$parent/share/codegraph"
}

detect_prefix() {
    if [ -n "$PREFIX" ]; then
        derive_data_dir
        return
    fi

    local candidates=(
        "$HOME/.local/bin:$HOME/.local/share/codegraph"
        "/usr/local/bin:/usr/local/share/codegraph"
        "$HOME/bin:$HOME/share/codegraph"
    )

    for entry in "${candidates[@]}"; do
        local dir="${entry%%:*}"
        local data="${entry##*:}"
        if mkdir -p "$dir" 2>/dev/null && [ -w "$dir" ]; then
            PREFIX="$dir"
            DATA_DIR="$data"
            return
        fi
    done

    die "No writable installation directory found. Use --local, --system, or --prefix."
}

check_existing() {
    local target="$PREFIX/codegraph"
    if [ -f "$target" ]; then
        local existing_version
        existing_version="$("$target" --version 2>/dev/null | grep -oP '[\d.]+' || echo "unknown")"
        warn "Existing installation found at $target (v$existing_version)"
        if [ "$FORCE" != true ]; then
            read -rp "Overwrite? [y/N] " confirm
            [[ "$confirm" =~ ^[Yy]$ ]] || die "Aborted"
        fi
    fi
}

install_data() {
    local src_wasm="$SCRIPT_DIR/wasm"
    local src_queries="$SCRIPT_DIR/queries"

    if [ -d "$src_wasm" ]; then
        mkdir -p "$DATA_DIR/wasm"
        cp -r "$src_wasm/." "$DATA_DIR/wasm/"
        ok "Data (wasm):    $DATA_DIR/wasm/"
    else
        warn "wasm/ directory not found in archive — skipping data install"
    fi

    if [ -d "$src_queries" ]; then
        mkdir -p "$DATA_DIR/queries"
        cp -r "$src_queries/." "$DATA_DIR/queries/"
        ok "Data (queries): $DATA_DIR/queries/"
    fi
}

add_to_path() {
    if echo "$PATH" | tr ':' '\n' | grep -q "^${PREFIX}$"; then
        return
    fi

    warn "$PREFIX is not in your PATH"
    echo ""

    local shell_rc=""
    if [ -f "$HOME/.zshrc" ]; then
        shell_rc="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        shell_rc="$HOME/.bashrc"
    elif [ -f "$HOME/.profile" ]; then
        shell_rc="$HOME/.profile"
    fi

    if [ -n "$shell_rc" ]; then
        if ! grep -q "$PREFIX" "$shell_rc" 2>/dev/null; then
            if [ "$FORCE" = true ]; then
                confirm="y"
            else
                read -rp "Add $PREFIX to PATH in $shell_rc? [y/N] " confirm
            fi
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                printf '\n# Added by CodeGraph installer\nexport PATH="%s:$PATH"\n' "$PREFIX" >> "$shell_rc"
                ok "Added to $shell_rc — run 'source $shell_rc' or open a new terminal"
                return
            fi
        fi
    fi

    info "Add this to your shell config to use codegraph:"
    echo "    export PATH=\"$PREFIX:\$PATH\""
}

do_install() {
    local binary="$SCRIPT_DIR/codegraph"

    if [ ! -f "$binary" ]; then
        die "Binary not found at $binary. Ensure you extracted the archive correctly."
    fi

    detect_prefix
    check_existing

    info "Installing CodeGraph v${VERSION}..."
    info "  Binary: $PREFIX/codegraph"
    info "  Data:   $DATA_DIR/"
    echo ""

    mkdir -p "$PREFIX"
    cp "$binary" "$PREFIX/codegraph"
    chmod +x "$PREFIX/codegraph"
    ok "Binary: $PREFIX/codegraph"

    install_data

    add_to_path

    echo ""
    ok "CodeGraph v${VERSION} installed successfully"
    echo ""
    echo "Quick start:"
    echo "    cd /path/to/your/project"
    echo "    codegraph init"
    echo "    codegraph scan"
    echo "    codegraph export"
    echo ""
    echo "Uninstall: $0 --uninstall"
}

do_uninstall() {
    detect_prefix
    local target="$PREFIX/codegraph"

    # Search common locations if not found at detected prefix
    if [ ! -f "$target" ]; then
        for dir in "$HOME/.local/bin" "/usr/local/bin" "$HOME/bin"; do
            if [ -f "$dir/codegraph" ]; then
                target="$dir/codegraph"
                PREFIX="$dir"
                derive_data_dir
                break
            fi
        done
    fi

    if [ ! -f "$target" ]; then
        die "codegraph is not installed (searched $PREFIX and common locations)"
    fi

    info "Uninstalling from $target..."
    rm -f "$target"
    ok "Removed binary: $target"

    if [ -d "$DATA_DIR" ]; then
        if [ "$FORCE" = true ]; then
            confirm="y"
        else
            read -rp "Remove data directory $DATA_DIR? [y/N] " confirm
        fi
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            rm -rf "$DATA_DIR"
            ok "Removed data:   $DATA_DIR"
        fi
    fi
}

parse_args "$@"

if [ "$UNINSTALL" = true ]; then
    do_uninstall
else
    do_install
fi

