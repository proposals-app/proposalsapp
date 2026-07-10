#!/usr/bin/env bash

set -euo pipefail

readonly FORK_URL=${ARBITRUM_FORK_URL:-https://arbitrum-one.public.blastapi.io}
readonly FORK_BLOCK=${ANVIL_FORK_BLOCK:-330000000}
readonly MAX_ATTEMPTS=${ANVIL_START_ATTEMPTS:-5}

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1)); do
  printf 'Starting Anvil fork (attempt %d/%d)...\n' "${attempt}" "${MAX_ATTEMPTS}"
  if anvil \
    --chain-id 31337 \
    --fork-url "${FORK_URL}" \
    --fork-retry-backoff 1000 \
    --retries 10 \
    --block-time 1 \
    --quiet \
    --fork-block-number "${FORK_BLOCK}"; then
    exit 0
  fi

  if ((attempt < MAX_ATTEMPTS)); then
    printf 'Anvil fork startup failed; retrying in 2 seconds...\n' >&2
    sleep 2
  fi
done

printf 'Anvil fork failed to start after %d attempts.\n' "${MAX_ATTEMPTS}" >&2
exit 1
