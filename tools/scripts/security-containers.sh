#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${repo_root}/.env"
if [[ ! -f "${env_file}" ]]; then
  echo "Local .env is missing. Run pnpm env:init before scanning containers." >&2
  exit 1
fi

compose_file="${repo_root}/infra/compose/compose.yaml"
exception_validator="${repo_root}/tools/scripts/check-container-exception.mjs"
trivy_image="aquasec/trivy:0.69.3@sha256:bcc376de8d77cfe086a917230e818dc9f8528e3c852f7b1aff648949b6258d1c"
trivy_cache="${repo_root}/.tools/trivy-cache"
docker_socket_gid="$(stat --format '%g' /var/run/docker.sock)"
mkdir -p "${trivy_cache}"

compose=(docker compose --env-file "${env_file}" -f "${compose_file}")
blocking_services=(gateway web api worker scheduler postgres redis migrate)
development_exception_services=(minio minio-init mailpit)
development_exception_id="SEC-EXC-002"
development_exception_expiry="2026-09-15"
development_exception_record="${repo_root}/docs/assurance/SECURITY_EXCEPTIONS.md"
declare -A approved_development_exception_images=(
  [minio]='minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e'
  [minio-init]='minio/mc:RELEASE.2025-08-13T08-35-41Z@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727'
  [mailpit]='axllent/mailpit:v1.30.7@sha256:d5ecbb067db3705fa953d79e1b7f81ef84038df67aba6c52825d8c02a1ea748a'
)

all_services=("${blocking_services[@]}" "${development_exception_services[@]}")
declare -A classified_services=()
for service in "${all_services[@]}"; do
  if [[ -n "${classified_services[${service}]:-}" ]]; then
    echo "Container security policy classifies service ${service} more than once." >&2
    exit 1
  fi
  classified_services["${service}"]=true
done

if ! configured_services_output="$("${compose[@]}" config --services)"; then
  echo 'Could not enumerate services from the current Compose configuration.' >&2
  exit 1
fi
configured_services=()
declare -A configured_service_set=()
while IFS= read -r service; do
  [[ -n "${service}" ]] || continue
  if [[ -n "${configured_service_set[${service}]:-}" ]]; then
    echo "Docker Compose returned duplicate service ${service}." >&2
    exit 1
  fi
  configured_services+=("${service}")
  configured_service_set["${service}"]=true
  if [[ -z "${classified_services[${service}]:-}" ]]; then
    echo "Compose service ${service} is not classified by the container security policy." >&2
    exit 1
  fi
done <<< "${configured_services_output}"
if [[ "${#configured_services[@]}" -eq 0 ]]; then
  echo 'The current Compose configuration contains no services.' >&2
  exit 1
fi
for service in "${all_services[@]}"; do
  if [[ -z "${configured_service_set[${service}]:-}" ]]; then
    echo "Container security policy references missing Compose service ${service}." >&2
    exit 1
  fi
done

normalize_image_id() {
  local image_id="$1"
  if [[ "${image_id}" =~ ^sha256:[[:xdigit:]]{64}$ ]]; then
    printf '%s\n' "${image_id}"
  elif [[ "${image_id}" =~ ^[[:xdigit:]]{64}$ ]]; then
    printf 'sha256:%s\n' "${image_id}"
  else
    echo "Docker returned an invalid image ID: ${image_id}" >&2
    return 1
  fi
}

resolve_current_service_image() {
  local service="$1"
  local container_output
  local hash_output
  local hash_line
  local inspect_output
  local current_image_output
  local current_image_id
  local container_id
  local actual_image_id
  local configured_image_reference
  local actual_config_hash
  local expected_config_hash
  local hash_service
  local extra_field
  local normalized_actual_image_id
  local normalized_current_image_id
  local -a container_ids=()
  local -a hash_lines=()
  local -a current_image_ids=()

  if ! container_output="$("${compose[@]}" ps --all --quiet "${service}")"; then
    echo "Could not resolve the Compose container for service ${service}." >&2
    return 1
  fi
  while IFS= read -r container_id; do
    [[ -n "${container_id}" ]] && container_ids+=("${container_id}")
  done <<< "${container_output}"
  if [[ "${#container_ids[@]}" -ne 1 ]]; then
    printf 'Expected exactly one current Compose container for %s, found %d. Run pnpm stack:up.\n' \
      "${service}" "${#container_ids[@]}" >&2
    return 1
  fi
  container_id="${container_ids[0]}"

  if ! hash_output="$("${compose[@]}" config --hash "${service}")"; then
    echo "Could not calculate the current Compose configuration hash for ${service}." >&2
    return 1
  fi
  while IFS= read -r hash_line; do
    [[ -n "${hash_line}" ]] && hash_lines+=("${hash_line}")
  done <<< "${hash_output}"
  if [[ "${#hash_lines[@]}" -ne 1 ]]; then
    echo "Docker Compose returned an ambiguous configuration hash for ${service}." >&2
    return 1
  fi
  read -r hash_service expected_config_hash extra_field <<< "${hash_lines[0]}"
  if [[ "${hash_service}" != "${service}" || -z "${expected_config_hash}" || -n "${extra_field:-}" ]]; then
    echo "Docker Compose returned an invalid configuration hash for ${service}." >&2
    return 1
  fi

  if ! inspect_output="$(docker inspect --type container \
    --format '{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.docker.compose.config-hash"}}' \
    "${container_id}")"; then
    echo "Could not inspect the Compose container for ${service}." >&2
    return 1
  fi
  IFS='|' read -r actual_image_id configured_image_reference actual_config_hash extra_field <<< "${inspect_output}"
  if [[ -z "${actual_image_id}" || -z "${configured_image_reference}" || -z "${actual_config_hash}" || -n "${extra_field:-}" ]]; then
    echo "Docker returned incomplete image metadata for service ${service}." >&2
    return 1
  fi
  if [[ "${actual_config_hash}" != "${expected_config_hash}" ]]; then
    echo "Service ${service} is stale relative to the current Compose configuration. Run pnpm stack:up." >&2
    return 1
  fi

  if ! current_image_output="$(docker image inspect --format '{{.Id}}' "${configured_image_reference}")"; then
    echo "The configured image for ${service} is unavailable locally. Run pnpm stack:up." >&2
    return 1
  fi
  while IFS= read -r current_image_id; do
    [[ -n "${current_image_id}" ]] && current_image_ids+=("${current_image_id}")
  done <<< "${current_image_output}"
  if [[ "${#current_image_ids[@]}" -ne 1 ]]; then
    echo "Docker returned an ambiguous current image ID for ${service}." >&2
    return 1
  fi

  normalized_actual_image_id="$(normalize_image_id "${actual_image_id}")" || return 1
  normalized_current_image_id="$(normalize_image_id "${current_image_ids[0]}")" || return 1
  if [[ "${normalized_actual_image_id}" != "${normalized_current_image_id}" ]]; then
    echo "Service ${service} is running a stale image. Run pnpm stack:up." >&2
    return 1
  fi

  printf '%s|%s\n' "${normalized_actual_image_id}" "${configured_image_reference}"
}

declare -A service_image_ids=()
declare -A service_image_references=()
for service in "${all_services[@]}"; do
  if ! resolution="$(resolve_current_service_image "${service}")"; then
    exit 1
  fi
  IFS='|' read -r service_image_ids["${service}"] service_image_references["${service}"] extra_field <<< "${resolution}"
  if [[ -z "${service_image_ids[${service}]:-}" || -z "${service_image_references[${service}]:-}" || -n "${extra_field:-}" ]]; then
    echo "Could not resolve complete image metadata for ${service}." >&2
    exit 1
  fi
done

blocking_images=()
development_exception_images=()
declare -A seen_blocking_images=()
declare -A seen_development_exception_images=()
for service in "${blocking_services[@]}"; do
  image_id="${service_image_ids[${service}]}"
  if [[ -z "${seen_blocking_images[${image_id}]:-}" ]]; then
    blocking_images+=("${image_id}")
    seen_blocking_images["${image_id}"]=true
  fi
done
for service in "${development_exception_services[@]}"; do
  image_id="${service_image_ids[${service}]}"
  if [[ -z "${seen_development_exception_images[${image_id}]:-}" ]]; then
    development_exception_images+=("${image_id}")
    seen_development_exception_images["${image_id}"]=true
  fi
done

development_exception_active=true
validator_arguments=(
  --record "${development_exception_record}"
  --id "${development_exception_id}"
  --expiry "${development_exception_expiry}"
  --current-date "$(date -u +%F)"
)
for service in "${development_exception_services[@]}"; do
  approved_image_reference="${approved_development_exception_images[${service}]:-}"
  if [[ -z "${approved_image_reference}" ]]; then
    echo "No approved exception image is recorded for ${service}." >&2
    development_exception_active=false
    continue
  fi
  validator_arguments+=(--approved-image "${service}=${approved_image_reference}")
  if [[ "${service_image_references[${service}]}" != "${approved_image_reference}" ]]; then
    printf 'Configured image for %s is not the exact image approved by %s.\n' \
      "${service}" "${development_exception_id}" >&2
    development_exception_active=false
  fi
done
if ! node "${exception_validator}" "${validator_arguments[@]}"; then
  development_exception_active=false
fi

scan_failed=false

scan_image() {
  local image_reference="$1"
  local vulnerability_exit_code="$2"

  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --group-add "${docker_socket_gid}" \
    --volume /var/run/docker.sock:/var/run/docker.sock \
    --volume "${trivy_cache}:/trivy-cache" \
    "${trivy_image}" \
    image --cache-dir /trivy-cache --scanners vuln --table-mode detailed \
    --exit-code "${vulnerability_exit_code}" --ignore-unfixed \
    --severity HIGH,CRITICAL "${image_reference}"
}

echo "Scanning hosted-beta-eligible runtime images; every fixable HIGH/CRITICAL finding is blocking."
for image_id in "${blocking_images[@]}"; do
  if ! scan_image "${image_id}" 1; then
    scan_failed=true
  fi
done

if [[ "${development_exception_active}" == true ]]; then
  printf 'Container scan exception: %s (expires %s; services: %s; record: docs/assurance/SECURITY_EXCEPTIONS.md)\n' \
    "${development_exception_id}" "${development_exception_expiry}" \
    "${development_exception_services[*]}"
  echo "Scanning development-only exception images in report-only mode; findings remain visible."
  for image_id in "${development_exception_images[@]}"; do
    if ! scan_image "${image_id}" 0; then
      echo "The development-only image scan could not complete." >&2
      scan_failed=true
    fi
  done
else
  echo "The development-only exception is unavailable, invalid, or expired; its findings are blocking." >&2
  scan_failed=true
  for image_id in "${development_exception_images[@]}"; do
    if ! scan_image "${image_id}" 1; then
      scan_failed=true
    fi
  done
fi

if [[ "${scan_failed}" == true ]]; then
  echo "One or more blocking images contain fixable high or critical vulnerabilities, or a required scan/policy check failed." >&2
  exit 1
fi

echo "Blocking runtime image scan passed; development-only findings remain governed by ${development_exception_id}."
