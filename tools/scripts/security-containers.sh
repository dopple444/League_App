#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${repo_root}/.env"
if [[ ! -f "${env_file}" ]]; then
  echo "Local .env is missing. Run pnpm env:init before scanning containers." >&2
  exit 1
fi
compose_file="${repo_root}/infra/compose/compose.yaml"
trivy_image="aquasec/trivy:0.69.3@sha256:bcc376de8d77cfe086a917230e818dc9f8528e3c852f7b1aff648949b6258d1c"
trivy_cache="${repo_root}/.tools/trivy-cache"
docker_socket_gid="$(stat --format '%g' /var/run/docker.sock)"
mkdir -p "${trivy_cache}"

mapfile -t images < <(docker compose --env-file "${env_file}" -f "${compose_file}" images --quiet | sort --unique)
if [[ "${#images[@]}" -eq 0 ]]; then
  echo "No Compose images exist. Run pnpm stack:up before the container scan." >&2
  exit 1
fi

scan_failed=false
for image_id in "${images[@]}"; do
  image_reference="${image_id}"
  if [[ "${image_id}" =~ ^[[:xdigit:]]{64}$ ]]; then
    image_reference="sha256:${image_id}"
  fi
  if ! docker run --rm \
    --user "$(id -u):$(id -g)" \
    --group-add "${docker_socket_gid}" \
    --volume /var/run/docker.sock:/var/run/docker.sock \
    --volume "${trivy_cache}:/trivy-cache" \
    "${trivy_image}" \
    image --cache-dir /trivy-cache --scanners vuln --table-mode detailed \
    --exit-code 1 --ignore-unfixed \
    --severity HIGH,CRITICAL "${image_reference}"; then
    scan_failed=true
  fi
done

if [[ "${scan_failed}" == true ]]; then
  echo "One or more Compose images contain fixable high or critical vulnerabilities." >&2
  exit 1
fi
