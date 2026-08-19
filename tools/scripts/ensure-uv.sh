#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
uv_version="0.12.5"
tool_directory="${repo_root}/.tools/uv-${uv_version}"
uv_binary="${tool_directory}/uv"

if [[ -x "${uv_binary}" ]]; then
  echo "${uv_binary}"
  exit 0
fi

case "$(uname -m)" in
  x86_64)
    archive="uv-x86_64-unknown-linux-gnu.tar.gz"
    expected_sha256="68a509da24b06b4223a1c0175fb5eb5bc79342b76cbeff0cfe51ac3f5b17b6b2"
    ;;
  aarch64|arm64)
    archive="uv-aarch64-unknown-linux-gnu.tar.gz"
    expected_sha256="9bf43b4d1a07665bf64d4c4e710930b382321a785e0eb10aac07f46471f86a31"
    ;;
  *)
    echo "Unsupported architecture for pinned uv bootstrap: $(uname -m)" >&2
    exit 1
    ;;
esac

mkdir -p "${tool_directory}"
temporary_archive="$(mktemp)"
curl --fail --location --silent --show-error \
  "https://github.com/astral-sh/uv/releases/download/${uv_version}/${archive}" \
  --output "${temporary_archive}"
echo "${expected_sha256}  ${temporary_archive}" | sha256sum --check --status
tar --extract --gzip --file "${temporary_archive}" --directory "${tool_directory}" \
  --strip-components=1 "${archive%.tar.gz}/uv" "${archive%.tar.gz}/uvx"
rm -f -- "${temporary_archive}"
chmod 0755 "${uv_binary}" "${tool_directory}/uvx"
echo "${uv_binary}"
