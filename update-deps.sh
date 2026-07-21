#!/usr/bin/env bash

set -euo pipefail

readonly NESTED_LOCKFILE_PACKAGES=(
  "libs/ts/db"
  "libs/ts/emails"
  "libs/ts/visual-dom-diff"
)

echo "Updating compatible Rust dependencies..."
cargo autoinherit
cargo upgrade \
  --exclude alloy \
  --exclude alloy-ens \
  --exclude rindexer
cargo sort -w
cargo update

echo "Updating pnpm workspace dependencies..."
pnpm dlx npm-check-updates \
  --upgrade \
  --workspaces \
  --cooldown 7d \
  --reject @playwright/test \
  --reject @eslint/js \
  --reject eslint \
  --reject pnpm \
  --reject postcss \
  --reject typescript \
  --reject wagmi
pnpm install

echo "Refreshing nested lockfiles..."
for package_dir in "${NESTED_LOCKFILE_PACKAGES[@]}"; do
  pnpm --dir "${package_dir}" install --lockfile-only --ignore-workspace
done

echo "Dependency update complete. Run the full validation suite before committing."
