#!/usr/bin/env bash
set -Eeuo pipefail

# Baseline Linux tooling for local development / GitHub Codespaces.
# Safe to re-run. Tested assumptions: Debian/Ubuntu-family environment with apt.

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

BASE_PACKAGES=(
  ca-certificates curl wget git jq
  zip unzip p7zip-full tar gzip bzip2 xz-utils
  gnupg lsb-release software-properties-common
  build-essential make gcc g++ pkg-config
  python3 python3-pip python3-venv pipx python3-dev
  openssh-client rsync
  ripgrep fd-find fzf tree less nano vim
  tmux htop procps lsof
  net-tools iproute2 iputils-ping dnsutils traceroute whois
  netcat-openbsd socat nmap tcpdump
  openssl sqlite3 file binutils uuid-runtime cron shellcheck
)

CTI_PACKAGES=(
  yara tshark dnsrecon
  libimage-exiftool-perl
  libssl-dev libffi-dev libxml2-dev libxslt1-dev zlib1g-dev
)

echo "[+] Updating apt metadata..."
${SUDO} apt-get update

echo "[+] Installing baseline packages..."
${SUDO} apt-get install -y --no-install-recommends "${BASE_PACKAGES[@]}" "${CTI_PACKAGES[@]}"

echo "[+] Cleaning apt cache..."
${SUDO} apt-get autoremove -y
${SUDO} apt-get clean

if command -v pipx >/dev/null 2>&1; then
  pipx ensurepath >/dev/null 2>&1 || true
fi

echo "[+] Verifying core tooling..."
TOOLS=(curl wget git jq python3 pipx nmap openssl yara tshark rg fzf exiftool)
missing=0
for tool in "${TOOLS[@]}"; do
  printf "%-12s " "${tool}"
  if command -v "${tool}" >/dev/null 2>&1; then
    echo "OK"
  else
    echo "MISSING"
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  echo "[!] Bootstrap completed, but one or more verification tools are missing." >&2
  exit 2
fi

echo "[+] Linux bootstrap complete."
