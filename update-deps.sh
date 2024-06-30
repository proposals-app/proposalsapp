#!/bin/bash

# Update root dependencies
ncu -u
yarn install

# Update rust dependencies
cargo autoinherit
cargo upgrade

# Update dependencies in each workspace
for dir in $(yarn workspaces list --json | jq -r '.location'); do
  (cd "$dir" && ncu -u && yarn install)
done
