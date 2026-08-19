#!/usr/bin/env bash
set -euo pipefail

user_binary_directory="${LEAGUE_USER_BIN:-${HOME}/.local/bin}"
mkdir -p "${user_binary_directory}"
user_prefix="$(cd "${user_binary_directory}/.." && pwd)"
pnpm_ready=false

if command -v corepack >/dev/null 2>&1; then
  if corepack enable --install-directory "${user_binary_directory}" \
    && corepack install --global pnpm@11.22.0 \
    && [[ "$("${user_binary_directory}/pnpm" --version 2>/dev/null)" == "11.22.0" ]]; then
    pnpm_ready=true
  else
    echo "Corepack could not activate the pin; using the exact user-local npm fallback." >&2
  fi
fi

if [[ "${pnpm_ready}" == false ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required for the user-local fallback. Install Node 24.19.0 first." >&2
    exit 1
  fi
  npm install --global --prefix "${user_prefix}" --force --no-audit --no-fund pnpm@11.22.0
fi

case ":${PATH}:" in
  *":${user_binary_directory}:"*) ;;
  *) echo "Add ${user_binary_directory} to PATH, then open a new shell." ;;
esac
"${user_binary_directory}/pnpm" --version
