#!/usr/bin/env bash

set -euo pipefail

for command in git node pnpm cargo; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Missing required command: ${command}" >&2
    exit 1
  fi
done

# JavaScript template literals are intentional.
# shellcheck disable=SC2016
node -e '
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) {
    throw new Error(`Node.js 20 or newer is required; found ${process.versions.node}`);
  }
'

expected_pnpm_version=$(node -p \
  'JSON.parse(require("fs").readFileSync("package.json", "utf8")).packageManager.split("@")[1]')
pnpm_command=(pnpm)
actual_pnpm_version=$("${pnpm_command[@]}" --version)

if [[ "${actual_pnpm_version}" != "${expected_pnpm_version}" ]]; then
  if ! command -v npx >/dev/null 2>&1; then
    echo "Expected pnpm ${expected_pnpm_version}, found ${actual_pnpm_version}" >&2
    exit 1
  fi
  pnpm_command=(npx --yes "pnpm@${expected_pnpm_version}")
  actual_pnpm_version=$("${pnpm_command[@]}" --version)
  if [[ "${actual_pnpm_version}" != "${expected_pnpm_version}" ]]; then
    echo "Unable to run pinned pnpm ${expected_pnpm_version}" >&2
    exit 1
  fi
fi

for path in package.json pnpm-lock.yaml pnpm-workspace.yaml Cargo.toml rust-toolchain.toml; do
  if [[ ! -f "${path}" ]]; then
    echo "Missing required project file: ${path}" >&2
    exit 1
  fi
done

"${pnpm_command[@]}" list --depth -1 >/dev/null
cargo metadata --format-version 1 --no-deps >/dev/null

echo "Project setup is valid."
