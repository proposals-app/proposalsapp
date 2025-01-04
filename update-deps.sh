#!/bin/bash

# Update rust dependencies
cargo autoinherit
cargo upgrade
cargo sort -w

# Update root dependencies
npx syncpack update
npx syncpack fix-mismatches
npx syncpack format
yarn install
