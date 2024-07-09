#!/bin/bash

# Update rust dependencies
cargo autoinherit
cargo upgrade

# Update root dependencies
ncu -u
pnpm install

# Update dependencies in each workspace
for dir in $(pnpm recursive exec -- bash -c 'echo $PWD' | grep -v 'node_modules'); do
  (cd "$dir" && ncu -u && pnpm install)
done
