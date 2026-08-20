#!/usr/bin/env bash
set -Eeuo pipefail

# MAXX Linux/Codespaces bootstrap for cti-enrichment-gateway.
# Debian/Ubuntu-family only. Safe to re-run.
# Installs a broad but bounded CTI/dev/forensics baseline while avoiding
# distro-sized offensive toolsets and packages that are unavailable on the host.

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Unsupported platform: apt-get not found (Debian/Ubuntu required)." >&2
  exit 1
fi

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  echo "Root privileges are required, but sudo is unavailable." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
export PIP_DISABLE_PIP_VERSION_CHECK=1

CORE_PACKAGES=(
  ca-certificates curl wget git git-lfs jq
  zip unzip p7zip-full tar gzip bzip2 xz-utils zstd lz4
  gnupg lsb-release software-properties-common
  build-essential make gcc g++ pkg-config cmake ninja-build clang llvm
  python3 python3-pip python3-venv pipx python3-dev python3-setuptools python3-wheel
  openssh-client rsync
  ripgrep fd-find fzf tree less nano vim
  tmux htop procps lsof strace ltrace gdb
  parallel moreutils pv entr time dos2unix
  diffutils patch shellcheck
  uuid-runtime cron
)

NETWORK_PACKAGES=(
  net-tools iproute2 iputils-ping dnsutils traceroute mtr-tiny whois
  netcat-openbsd socat nmap tcpdump tshark iperf3
  aria2 httpie
  openssl gnutls-bin
)

CTI_FORENSICS_PACKAGES=(
  yara dnsrecon
  libimage-exiftool-perl
  file binutils patchelf elfutils
  xxd bsdextrautils
  sqlite3 xmlstarlet libxml2-utils
  cabextract
  rhash ssdeep hashdeep
)

DEV_LIB_PACKAGES=(
  libssl-dev libffi-dev libxml2-dev libxslt1-dev zlib1g-dev
  libsqlite3-dev liblzma-dev libbz2-dev
)

OPTIONAL_PACKAGES=(
  shfmt
  binwalk
  sleuthkit
  testdisk
  foremost
  unar
  age
)

install_available() {
  local label="$1"
  shift
  local requested=("$@")
  local available=()
  local skipped=()
  local pkg

  for pkg in "${requested[@]}"; do
    if apt-cache show "${pkg}" >/dev/null 2>&1; then
      available+=("${pkg}")
    else
      skipped+=("${pkg}")
    fi
  done

  if ((${#available[@]})); then
    echo "[+] Installing ${label} (${#available[@]} packages)..."
    ${SUDO} apt-get install -y --no-install-recommends "${available[@]}"
  fi

  if ((${#skipped[@]})); then
    echo "[i] Skipped unavailable ${label}: ${skipped[*]}"
  fi
}

echo "[+] Updating apt metadata..."
${SUDO} apt-get update

install_available "core tooling" "${CORE_PACKAGES[@]}"
install_available "network/TLS tooling" "${NETWORK_PACKAGES[@]}"
install_available "CTI/forensics tooling" "${CTI_FORENSICS_PACKAGES[@]}"
install_available "development libraries" "${DEV_LIB_PACKAGES[@]}"
install_available "optional tooling" "${OPTIONAL_PACKAGES[@]}"

if command -v git-lfs >/dev/null 2>&1; then
  git lfs install --skip-repo >/dev/null 2>&1 || true
fi

if command -v pipx >/dev/null 2>&1; then
  pipx ensurepath >/dev/null 2>&1 || true
fi

# Debian/Ubuntu names fd as fdfind. Provide a user-local fd shim when needed.
if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then
  mkdir -p "${HOME}/.local/bin"
  ln -sf "$(command -v fdfind)" "${HOME}/.local/bin/fd"
fi

${SUDO} apt-get clean

echo "[+] Running tooling verification..."
if [[ -x "scripts/verify-tooling.sh" ]]; then
  bash scripts/verify-tooling.sh
else
  required=(curl wget git jq python3 pipx nmap openssl yara tshark rg fzf exiftool)
  missing=0
  for tool in "${required[@]}"; do
    printf "%-16s " "${tool}"
    if command -v "${tool}" >/dev/null 2>&1; then
      echo "OK"
    else
      echo "MISSING"
      missing=1
    fi
  done
  ((missing == 0)) || exit 2
fi

echo "[+] MAXX Linux bootstrap complete."
