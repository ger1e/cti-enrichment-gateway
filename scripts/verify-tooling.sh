#!/usr/bin/env bash
set -Eeuo pipefail

required=(
  bash curl wget git jq
  node npm
  python3 pipx
  rg fzf
  nmap tcpdump tshark
  openssl yara exiftool
  sqlite3 file strings xxd
  shellcheck
)

optional=(
  cmake ninja clang llvm-config
  strace ltrace gdb
  mtr iperf3 http
  dnsrecon
  patchelf eu-readelf
  xmlstarlet
  rhash ssdeep hashdeep
  yq jo mlr csvcut gron
  ngrep tcptraceroute
  binwalk fls testdisk foremost unar age skopeo
)

missing=0

echo "== Required tooling =="
for tool in "${required[@]}"; do
  printf "%-18s " "${tool}"
  if command -v "${tool}" >/dev/null 2>&1; then
    echo "OK"
  else
    echo "MISSING"
    missing=1
  fi
done

echo
echo "== Optional tooling =="
for tool in "${optional[@]}"; do
  printf "%-18s " "${tool}"
  if command -v "${tool}" >/dev/null 2>&1; then
    echo "OK"
  else
    echo "not installed"
  fi
done

echo
echo "== Runtime versions =="
node --version 2>/dev/null || true
npm --version 2>/dev/null || true
python3 --version 2>/dev/null || true
git --version 2>/dev/null || true
openssl version 2>/dev/null || true
yara --version 2>/dev/null || true

echo
echo "== Repository guardrails =="
if [[ -f .gitignore ]] && grep -Eq '^\.env(\*|\.)?' .gitignore; then
  echo ".env ignore rule   OK"
else
  echo ".env ignore rule   MISSING"
  missing=1
fi

if [[ -f .devcontainer/devcontainer.json ]]; then
  jq -e . .devcontainer/devcontainer.json >/dev/null
  echo "devcontainer JSON  OK"
else
  echo "devcontainer JSON  MISSING"
  missing=1
fi

if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if ((node_major < 20)); then
    echo "[!] Node.js >=20 required by package.json; found $(node --version)." >&2
    missing=1
  fi
fi

if ((missing != 0)); then
  echo "[!] FINAL MAXX tooling verification failed." >&2
  exit 2
fi

echo "[+] FINAL MAXX tooling verification passed."
