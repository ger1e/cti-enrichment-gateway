#!/usr/bin/env bash
set -Eeuo pipefail

fail=0

check() {
  local label="$1"
  shift
  printf "%-30s " "${label}"
  if "$@"; then
    echo "OK"
  else
    echo "FAIL"
    fail=1
  fi
}

node_engine_ok() {
  [[ "$(jq -r '.engines.node // empty' package.json)" == "24.x" ]]
}

nvmrc_ok() {
  [[ "$(tr -d '[:space:]' < .nvmrc)" == "24" ]]
}

devcontainer_node_ok() {
  [[ "$(jq -r '.features["ghcr.io/devcontainers/features/node:1"].version // empty' .devcontainer/devcontainer.json)" == "24" ]]
}

actions_pinned_ok() {
  local workflow=.github/workflows/tooling-smoke.yml
  grep -Eq 'actions/checkout@[0-9a-f]{40}' "${workflow}" &&
    grep -Eq 'actions/setup-node@[0-9a-f]{40}' "${workflow}" &&
    ! grep -Eq 'uses:[[:space:]]+actions/(checkout|setup-node)@v[0-9]+' "${workflow}"
}

sensitive_files_untracked() {
  local matches
  matches="$(git ls-files | grep -E '(^|/)\.env($|\.)|\.(pem|key|p12|pfx|jks|keystore)$|(^|/)(samples|captures|artifacts)/' || true)"
  matches="$(printf '%s\n' "${matches}" | grep -v -E '(^|/)\.env\.example$' || true)"
  [[ -z "${matches}" ]]
}

ignore_rules_ok() {
  grep -Eq '^\.env$' .gitignore &&
    grep -Eq '^\.env\.\*$' .gitignore &&
    grep -Eq '^\*\.pem$' .gitignore &&
    grep -Eq '^samples/$' .gitignore &&
    grep -Eq '^captures/$' .gitignore
}

echo "== Repository invariants =="
check "package.json Node 24.x" node_engine_ok
check ".nvmrc Node 24" nvmrc_ok
check "devcontainer Node 24" devcontainer_node_ok
check "GitHub Actions SHA-pinned" actions_pinned_ok
check "sensitive artifacts untracked" sensitive_files_untracked
check "secret/artifact ignore rules" ignore_rules_ok

if [[ -f package-lock.json ]]; then
  echo
  echo "== Dependency audit =="
  npm audit --audit-level=high
else
  echo
  echo "[i] No package-lock.json; dependency audit skipped (no locked npm dependency set)."
fi

if ((fail != 0)); then
  echo "[!] Repository invariant verification failed." >&2
  exit 2
fi

echo "[+] Repository invariant verification passed."
