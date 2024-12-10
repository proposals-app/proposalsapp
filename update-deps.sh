#!/bin/bash

# Update rust dependencies
cargo autoinherit
cargo upgrade
cargo sort -w

# Update root dependencies
npx npm-check-updates -u
yarn install

# Update dependencies in each workspace
for dir in $(yarn workspaces list --json | jq -r '.location'); do
  (cd "$dir" && npx npm-check-updates -u && yarn install)
done
