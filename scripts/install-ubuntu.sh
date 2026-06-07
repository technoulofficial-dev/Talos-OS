#!/usr/bin/env bash
# Talos OS — Ubuntu/Linux Self-Installer
# The Bronze Automaton · Metis Corp
#
# Usage: curl -fsSL https://talos.metis.corp/install.sh | bash
# Or:    ./install-ubuntu.sh

set -euo pipefail

TALOS_VERSION="8.0.0"
INSTALL_DIR="${TALOS_HOME:-$HOME/.talos}"
GITHUB_REPO="metis-corp/talos-os"

# Bronze-Punk colors
BRONZE='\033[38;5;130m'
CYAN='\033[38;5;51m'
GREEN='\033[38;5;82m'
YELLOW='\033[38;5;221m'
RED='\033[38;5;196m'
NC='\033[0m'

banner() {
    echo -e "${BRONZE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ⚒  T A L O S  O S  I N S T A L L E R  ⚒                  ║"
    echo "║  The Bronze Automaton · Metis Corp                          ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log() { echo -e "${CYAN}[talos]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

check_requirements() {
    log "Checking system requirements..."

    # OS check
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        fail "This installer is for Linux. For Windows, use install-windows.ps1"
    fi

    # Architecture
    local arch
    arch=$(uname -m)
    if [[ "$arch" != "x86_64" && "$arch" != "aarch64" ]]; then
        fail "Unsupported architecture: $arch. Supported: x86_64, aarch64"
    fi

    # Required tools
    for cmd in curl wget git; do
        if ! command -v "$cmd" &> /dev/null; then
            fail "Required command not found: $cmd. Please install it first."
        fi
    done

    success "System requirements met"
}

install_docker() {
    if command -v docker &> /dev/null; then
        success "Docker already installed: $(docker --version)"
        return
    fi

    log "Installing Docker..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    sudo usermod -aG docker "$USER"
    success "Docker installed"
    warn "You may need to log out and back in for docker group permissions to take effect"
}

install_node() {
    if command -v node &> /dev/null && [[ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -ge 20 ]]; then
        success "Node.js already installed: $(node --version)"
        return
    fi

    log "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    success "Node.js installed: $(node --version)"
}

install_ollama() {
    if command -v ollama &> /dev/null; then
        success "Ollama already installed"
        return
    fi

    log "Installing Ollama (local AI engine)..."
    curl -fsSL https://ollama.com/install.sh | sh
    success "Ollama installed"
}

setup_directories() {
    log "Creating Talos directories at $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"/{agents,blueprint,memory,plugins,logs,config}
    success "Directories created"
}

download_talos() {
    log "Downloading Talos OS v$TALOS_VERSION..."

    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log "Talos already cloned, updating..."
        (cd "$INSTALL_DIR" && git pull origin main)
    else
        git clone "https://github.com/$GITHUB_REPO.git" "$INSTALL_DIR"
    fi

    success "Talos OS downloaded"
}

install_dependencies() {
    log "Installing dependencies..."
    cd "$INSTALL_DIR"
    npm install --production
    success "Dependencies installed"
}

setup_env() {
    log "Setting up environment..."

    if [[ ! -f "$INSTALL_DIR/.env" ]]; then
        cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
        log "Created .env file. Please edit it with your Supabase credentials."
    fi

    # Add Talos to PATH
    local shell_rc
    if [[ -f "$HOME/.bashrc" ]]; then
        shell_rc="$HOME/.bashrc"
    elif [[ -f "$HOME/.zshrc" ]]; then
        shell_rc="$HOME/.zshrc"
    fi

    if [[ -n "${shell_rc:-}" ]]; then
        if ! grep -q "TALOS_HOME" "$shell_rc"; then
            echo "" >> "$shell_rc"
            echo "# Talos OS" >> "$shell_rc"
            echo "export TALOS_HOME=\"$INSTALL_DIR\"" >> "$shell_rc"
            echo "export PATH=\"\$PATH:$INSTALL_DIR/packages/cli/dist\"" >> "$shell_rc"
            success "Added Talos to PATH in $shell_rc"
        fi
    fi
}

start_talos() {
    log "Starting Talos OS for the first time..."

    cd "$INSTALL_DIR"

    # Build the project
    log "Building Talos packages..."
    npm run build

    # Start the system
    log "Starting services..."
    "$INSTALL_DIR/packages/cli/dist/index.js" start --detach
}

post_install() {
    echo
    echo -e "${BRONZE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ⚒ Talos OS v$TALOS_VERSION installed successfully! ⚒${NC}"
    echo -e "${BRONZE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "  ${CYAN}Mission Control:${NC} http://localhost:3000"
    echo -e "  ${CYAN}HTTP API:${NC}        http://localhost:8642"
    echo -e "  ${CYAN}CLI:${NC}             talos <command>"
    echo
    echo -e "  ${YELLOW}Next steps:${NC}"
    echo "  1. Edit $INSTALL_DIR/.env with your Supabase credentials"
    echo "  2. Run: talos start"
    echo "  3. Open http://localhost:3000 in your browser"
    echo
    echo -e "  ${BRONZE}The Bronze Automaton awaits.${NC}"
    echo
}

main() {
    banner
    check_requirements
    install_docker
    install_node
    install_ollama
    setup_directories
    download_talos
    install_dependencies
    setup_env
    start_talos
    post_install
}

main "$@"