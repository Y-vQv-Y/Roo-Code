#!/bin/sh
# ADTEC Code CLI Installer
# Usage: ADTEC_CODE_LOCAL_TARBALL=/path/to/adtec-code-cli.tar.gz ./install.sh
#
# Environment variables:
#   ADTEC_CODE_INSTALL_DIR   - Installation directory (default: ~/.adtec/cli)
#   ADTEC_CODE_BIN_DIR       - Binary symlink directory (default: ~/.local/bin)
#   ADTEC_CODE_VERSION       - Specific version to install (default: latest)
#   ADTEC_CODE_LOCAL_TARBALL - Path to local tarball to install (skips download)
#   ADTEC_CODE_RELEASE_REPOSITORY - Optional internal release repository (owner/name)

set -e

# Configuration
INSTALL_DIR="${ADTEC_CODE_INSTALL_DIR:-$HOME/.adtec/cli}"
BIN_DIR="${ADTEC_CODE_BIN_DIR:-$HOME/.local/bin}"
REPO="${ADTEC_CODE_RELEASE_REPOSITORY:-}"
MIN_NODE_VERSION=20
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

# Color output (only if terminal supports it)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    NC=''
fi

info() { printf "${GREEN}==>${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}Warning:${NC} %s\n" "$1"; }
error() { printf "${RED}Error:${NC} %s\n" "$1" >&2; exit 1; }

# Check Node.js version
check_node() {
    if ! command -v node >/dev/null 2>&1; then
        error "Node.js is not installed. Please install Node.js $MIN_NODE_VERSION or higher.

Install Node.js:
  - macOS: brew install node
  - Linux: https://nodejs.org/en/download/package-manager
  - Or use a version manager like fnm, nvm, or mise"
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt "$MIN_NODE_VERSION" ]; then
        error "Node.js $MIN_NODE_VERSION+ required. Found: $(node -v)

Please upgrade Node.js to version $MIN_NODE_VERSION or higher."
    fi
    
    info "Found Node.js $(node -v)"
}

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$OS" in
        darwin) OS="macos" ;;
        linux) OS="linux" ;;
        mingw*|msys*|cygwin*) 
            error "Use apps/cli/install.ps1 from PowerShell on Windows."
            ;;
        *) error "Unsupported OS: $OS" ;;
    esac
    
    case "$ARCH" in
        x86_64|amd64) ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *) error "Unsupported architecture: $ARCH" ;;
    esac
    
    PLATFORM="${OS}-${ARCH}"
    info "Detected platform: $PLATFORM"
}

# Get latest release version or use specified version
get_version() {
    # Skip version fetch if using local tarball
    if [ -n "$ADTEC_CODE_LOCAL_TARBALL" ]; then
        VERSION="${ADTEC_CODE_VERSION:-local}"
        ASSET_NAME="$(basename "$ADTEC_CODE_LOCAL_TARBALL")"
        info "Using local tarball (version: $VERSION)"
        return
	fi

	if [ -z "$REPO" ]; then
		error "No internal release repository is configured. Set ADTEC_CODE_RELEASE_REPOSITORY or install with ADTEC_CODE_LOCAL_TARBALL."
	fi

    ASSET_NAME="adtec-code-cli-${PLATFORM}.tar.gz"
    
    if [ -n "$ADTEC_CODE_VERSION" ]; then
        VERSION="$ADTEC_CODE_VERSION"
        info "Using specified version: $VERSION"
    fi
    
    info "Fetching latest version..."
    
    # Try to get the latest cli release
    RELEASES_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=100" 2>/dev/null) || {
        error "Failed to fetch releases from GitHub. Check your internet connection."
    }
    
    # Extract highest cli-v* tag by semantic version (do not rely on API ordering)
    if [ -z "${VERSION:-}" ]; then
    VERSION=$(printf "%s" "$RELEASES_JSON" | ASSET_NAME="$ASSET_NAME" node -e '
const fs = require("fs")
const input = fs.readFileSync(0, "utf8")
let releases
try {
  releases = JSON.parse(input)
} catch {
  process.exit(1)
}

function parseVersion(version) {
  const core = String(version).trim().split("+", 1)[0].split("-", 1)[0]
  if (!core) return null
  const parts = core.split(".")
  if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) {
    return null
  }
  return parts.map((part) => Number.parseInt(part, 10))
}

function compareVersions(a, b) {
  const maxLength = Math.max(a.length, b.length)
  for (let i = 0; i < maxLength; i++) {
    const aPart = a[i] ?? 0
    const bPart = b[i] ?? 0
    if (aPart > bPart) return 1
    if (aPart < bPart) return -1
  }
  return 0
}

let latestVersion = ""
let latestParts = null

if (Array.isArray(releases)) {
  for (const release of releases) {
    if (
      !release ||
      typeof release.tag_name !== "string" ||
      !/^(?:cli-)?v/.test(release.tag_name) ||
      !Array.isArray(release.assets) ||
      !release.assets.some((asset) => asset && asset.name === process.env.ASSET_NAME)
    ) {
      continue
    }
    const candidate = release.tag_name.replace(/^(?:cli-)?v/, "")
    const candidateParts = parseVersion(candidate)
    if (!candidateParts) continue
    if (!latestParts || compareVersions(candidateParts, latestParts) > 0) {
      latestVersion = candidate
      latestParts = candidateParts
    }
  }
}

if (latestVersion) {
  process.stdout.write(latestVersion)
}
')
    fi
    
    if [ -z "$VERSION" ]; then
        error "Could not find any CLI releases. The CLI may not have been released yet."
    fi
    
    RELEASE_METADATA=$(printf "%s" "$RELEASES_JSON" | node "$SCRIPT_DIR/scripts/resolve-release.mjs" --asset "$ASSET_NAME" --version "$VERSION")
    if [ -z "$RELEASE_METADATA" ]; then
        error "Could not find a CLI release containing $ASSET_NAME."
    fi

    RELEASE_TAG=$(printf "%s" "$RELEASE_METADATA" | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).tag)')
    ASSET_URL=$(printf "%s" "$RELEASE_METADATA" | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).url)')
    info "Using release $RELEASE_TAG (version: $VERSION)"
}

# Download and extract
download_and_install() {
    TARBALL="${ASSET_NAME:-adtec-code-cli-${PLATFORM}.tar.gz}"
    
    # Create temp directory
    TMP_DIR=$(mktemp -d)
    trap "rm -rf $TMP_DIR" EXIT
    
    # Use local tarball if provided, otherwise download
    if [ -n "$ADTEC_CODE_LOCAL_TARBALL" ]; then
        if [ ! -f "$ADTEC_CODE_LOCAL_TARBALL" ]; then
            error "Local tarball not found: $ADTEC_CODE_LOCAL_TARBALL"
        fi
        info "Using local tarball: $ADTEC_CODE_LOCAL_TARBALL"
        cp "$ADTEC_CODE_LOCAL_TARBALL" "$TMP_DIR/$TARBALL"
    else
        URL="$ASSET_URL"
        
        info "Downloading from $URL..."
        
        # Download with progress indicator
        HTTP_CODE=$(curl -fsSL -w "%{http_code}" "$URL" -o "$TMP_DIR/$TARBALL" 2>/dev/null) || {
            if [ "$HTTP_CODE" = "404" ]; then
                error "Release not found for platform $PLATFORM version $VERSION.

Available at: https://github.com/$REPO/releases"
            fi
            error "Download failed. HTTP code: $HTTP_CODE"
        }

        # Verify we got something
        if [ ! -s "$TMP_DIR/$TARBALL" ]; then
            error "Downloaded file is empty. Please try again."
        fi
    fi

    # Remove old installation if exists
    if [ -d "$INSTALL_DIR" ]; then
        info "Removing previous installation..."
        rm -rf "$INSTALL_DIR"
    fi
    
    mkdir -p "$INSTALL_DIR"
    
    # Extract
    info "Extracting to $INSTALL_DIR..."
    tar -xzf "$TMP_DIR/$TARBALL" -C "$INSTALL_DIR" --strip-components=1 || {
        error "Failed to extract tarball. The download may be corrupted."
    }
    
    # Save ripgrep binary before npm install (npm install will overwrite node_modules)
    RIPGREP_BIN=""
    if [ -f "$INSTALL_DIR/node_modules/@vscode/ripgrep/bin/rg" ]; then
        RIPGREP_BIN="$TMP_DIR/rg"
        cp "$INSTALL_DIR/node_modules/@vscode/ripgrep/bin/rg" "$RIPGREP_BIN"
    fi
    
    # Install npm dependencies
    info "Installing dependencies..."
    cd "$INSTALL_DIR"
    npm install --production --silent 2>/dev/null || {
        warn "npm install failed, trying with --legacy-peer-deps..."
        npm install --production --legacy-peer-deps --silent 2>/dev/null || {
            error "Failed to install dependencies. Make sure npm is available."
        }
    }
    cd - > /dev/null
    
    # Restore ripgrep binary after npm install
    if [ -n "$RIPGREP_BIN" ] && [ -f "$RIPGREP_BIN" ]; then
        mkdir -p "$INSTALL_DIR/node_modules/@vscode/ripgrep/bin"
        cp "$RIPGREP_BIN" "$INSTALL_DIR/node_modules/@vscode/ripgrep/bin/rg"
        chmod +x "$INSTALL_DIR/node_modules/@vscode/ripgrep/bin/rg"
    fi
    
    # Make executable
    chmod +x "$INSTALL_DIR/bin/adtec-code"
    
    # Also make ripgrep executable if it exists
    if [ -f "$INSTALL_DIR/bin/rg" ]; then
        chmod +x "$INSTALL_DIR/bin/rg"
    fi
}

# Create symlink in bin directory
setup_bin() {
    mkdir -p "$BIN_DIR"
    
    # Remove old symlink if exists
    if [ -L "$BIN_DIR/adtec-code" ] || [ -f "$BIN_DIR/adtec-code" ]; then
        rm -f "$BIN_DIR/adtec-code"
    fi
    
    ln -sf "$INSTALL_DIR/bin/adtec-code" "$BIN_DIR/adtec-code"
    info "Created symlink: $BIN_DIR/adtec-code"
}

# Check if bin dir is in PATH and provide instructions
check_path() {
    case ":$PATH:" in
        *":$BIN_DIR:"*) 
            # Already in PATH
            return 0
            ;;
    esac
    
    warn "$BIN_DIR is not in your PATH"
    echo ""
    echo "Add this line to your shell profile:"
    echo ""
    
    # Detect shell and provide specific instructions
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        zsh)
            echo "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc"
            echo "  source ~/.zshrc"
            ;;
        bash)
            if [ -f "$HOME/.bashrc" ]; then
                echo "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.bashrc"
                echo "  source ~/.bashrc"
            else
                echo "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.bash_profile"
                echo "  source ~/.bash_profile"
            fi
            ;;
        fish)
            echo "  set -Ux fish_user_paths $BIN_DIR \$fish_user_paths"
            ;;
        *)
            echo "  export PATH=\"$BIN_DIR:\$PATH\""
            ;;
    esac
    echo ""
}

# Verify installation
verify_install() {
    if [ -x "$BIN_DIR/adtec-code" ]; then
        info "Verifying installation..."
        # Just check if it runs without error
        "$BIN_DIR/adtec-code" --version >/dev/null 2>&1 || true
    fi
}

# Print success message
print_success() {
    echo ""
    printf "${GREEN}${BOLD}✓ ADTEC Code CLI installed successfully!${NC}\n"
    echo ""
    echo "  Installation: $INSTALL_DIR"
    echo "  Binary: $BIN_DIR/adtec-code"
    echo "  Version: $VERSION"
    echo ""
    echo "  ${BOLD}Get started:${NC}"
    echo "    adtec-code --help"
    echo ""
    echo "  ${BOLD}Example:${NC}"
    echo "    export OPENROUTER_API_KEY=sk-or-v1-..."
    echo "    cd ~/my-project && adtec-code \"What is this project?\""
    echo ""
}

# Main
main() {
    echo ""
    printf "${BLUE}${BOLD}"
    echo "  ╭─────────────────────────────────╮"
    echo "  │     ADTEC Code CLI Installer      │"
    echo "  ╰─────────────────────────────────╯"
    printf "${NC}"
    echo ""
    
    check_node
    detect_platform
    get_version
    download_and_install
    setup_bin
    check_path
    verify_install
    print_success
}

main "$@"
