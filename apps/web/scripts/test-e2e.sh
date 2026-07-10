#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR
PROJECT_DIR=$(cd -- "${SCRIPT_DIR}/.." && pwd)
readonly PROJECT_DIR
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

STORYBOOK_PID=''
ANVIL_PID=''
ANVIL_LOG=''

print_status() {
  printf '%b[E2E]%b %s\n' "${BLUE}" "${NC}" "$1"
}

print_success() {
  printf '%b[SUCCESS]%b %s\n' "${GREEN}" "${NC}" "$1"
}

print_error() {
  printf '%b[ERROR]%b %s\n' "${RED}" "${NC}" "$1" >&2
}

print_warning() {
  printf '%b[WARNING]%b %s\n' "${YELLOW}" "${NC}" "$1"
}

stop_process_tree() {
  local pid=$1
  local name=$2

  if [[ -z "${pid}" ]] || ! kill -0 "${pid}" 2>/dev/null; then
    return
  fi

  pkill -TERM -P "${pid}" 2>/dev/null || true
  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  print_status "Stopped ${name} (PID: ${pid})"
}

# Invoked through trap.
# shellcheck disable=SC2329
cleanup_offchain() {
  print_status 'Cleaning up offchain test processes...'
  stop_process_tree "${STORYBOOK_PID}" 'Storybook'
}

# Invoked through trap.
# shellcheck disable=SC2329
cleanup_onchain() {
  print_status 'Cleaning up onchain test processes...'
  stop_process_tree "${ANVIL_PID}" 'Anvil'
  stop_process_tree "${STORYBOOK_PID}" 'Storybook'
}

load_environment() {
  if [[ ! -f .env ]]; then
    print_warning "Environment file not found at ${PROJECT_DIR}/.env"
    return
  fi

  print_status 'Loading environment variables from .env...'
  set -a
  # Project-local optional environment file.
  # shellcheck disable=SC1091
  source .env
  set +a
}

check_service() {
  local url=$1
  local service_name=$2
  local max_attempts=30
  local attempt=1

  print_status "Waiting for ${service_name} at ${url}..."

  while ((attempt <= max_attempts)); do
    if curl --fail --silent --output /dev/null "${url}"; then
      print_success "${service_name} is ready"
      return 0
    fi

    printf 'Attempt %d/%d - waiting for %s...\n' \
      "${attempt}" "${max_attempts}" "${service_name}"
    sleep 2
    ((attempt += 1))
  done

  print_error "${service_name} did not start within the expected time"
  return 1
}

check_json_rpc() {
  local url=$1
  local service_name=$2
  local expected_chain_id=$3
  local max_attempts=30
  local attempt=1
  local response=''

  print_status "Waiting for ${service_name} JSON-RPC at ${url}..."

  while ((attempt <= max_attempts)); do
    response=$(curl --fail --silent --show-error \
      --header 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
      "${url}" 2>/dev/null || true)
    if [[ "${response}" == *"\"result\":\"${expected_chain_id}\""* ]]; then
      print_success "${service_name} JSON-RPC is ready"
      return 0
    fi

    printf 'Attempt %d/%d - waiting for %s JSON-RPC...\n' \
      "${attempt}" "${max_attempts}" "${service_name}"
    sleep 2
    ((attempt += 1))
  done

  print_error "${service_name} JSON-RPC did not start within the expected time"
  return 1
}

check_env() {
  if [[ -z "${TEST_ACCOUNT_SEED_PHRASE:-}" ]]; then
    print_error 'TEST_ACCOUNT_SEED_PHRASE is not set'
    exit 1
  fi
}

setup_wallet() {
  print_status 'Setting up the test wallet...'
  pnpm synpress-setup
  print_success 'Wallet setup completed'
}

run_offchain_test() {
  local test_name=$1
  print_status "Running offchain test: ${test_name}"

  case "${test_name}" in
    basic) pnpm e2e:test-basic ;;
    single-choice) pnpm e2e:test-single-choice ;;
    approval) pnpm e2e:test-approval ;;
    quadratic) pnpm e2e:test-quadratic ;;
    ranked-choice) pnpm e2e:test-ranked-choice ;;
    weighted) pnpm e2e:test-weighted ;;
    *)
      print_error "Unknown offchain test: ${test_name}"
      print_status 'Available tests: basic, single-choice, approval, quadratic, ranked-choice, weighted'
      return 2
      ;;
  esac

  print_success "Test ${test_name} passed"
}

run_onchain_test() {
  local test_name=$1
  print_status "Running onchain test: ${test_name}"

  case "${test_name}" in
    arbitrum-core) pnpm e2e:test-arbitrum-core ;;
    arbitrum-treasury) pnpm e2e:test-arbitrum-treasury ;;
    *)
      print_error "Unknown onchain test: ${test_name}"
      print_status 'Available tests: arbitrum-core, arbitrum-treasury'
      return 2
      ;;
  esac

  print_success "Test ${test_name} passed"
}

run_offchain() {
  local test_name=$1
  check_env
  trap cleanup_offchain EXIT

  print_status 'Starting Storybook...'
  pnpm e2e:start-storybook &
  STORYBOOK_PID=$!
  check_service 'http://localhost:6006' 'Storybook'
  setup_wallet

  if [[ -n "${test_name}" ]]; then
    run_offchain_test "${test_name}"
  else
    pnpm exec playwright test e2e/vote-offchain.spec.ts
  fi

  print_success 'Offchain tests completed successfully'
}

run_onchain() {
  local test_name=$1
  check_env
  trap cleanup_onchain EXIT

  print_status 'Starting Anvil and Storybook...'
  ANVIL_LOG="${TMPDIR:-/tmp}/proposalsapp-anvil.log"
  pnpm e2e:start-anvil >"${ANVIL_LOG}" 2>&1 &
  ANVIL_PID=$!
  pnpm e2e:start-storybook &
  STORYBOOK_PID=$!
  if ! check_json_rpc 'http://localhost:8545' 'Anvil' '0x7a69'; then
    print_error "Anvil log follows (${ANVIL_LOG})"
    tail -100 "${ANVIL_LOG}" >&2
    return 1
  fi
  check_service 'http://localhost:6006' 'Storybook'
  setup_wallet

  if [[ -n "${test_name}" ]]; then
    run_onchain_test "${test_name}"
  else
    pnpm exec playwright test e2e/vote-onchain.spec.ts
  fi

  print_success 'Onchain tests completed successfully'
}

print_help() {
  cat <<'EOF'
E2E Test Runner

Usage: ./scripts/test-e2e.sh [command] [test-name]

Commands:
  offchain [test-name]     Run offchain tests
  onchain [test-name]      Run onchain tests (requires Anvil)
  setup                    Set up the test wallet only
  help                     Show this help

Offchain tests:
  basic, single-choice, approval, quadratic, ranked-choice, weighted

Onchain tests:
  arbitrum-core, arbitrum-treasury

Required environment:
  TEST_ACCOUNT_SEED_PHRASE
EOF
}

cd "${PROJECT_DIR}"
load_environment

test_type=${1:-help}
test_name=${2:-}

case "${test_type}" in
  offchain) run_offchain "${test_name}" ;;
  onchain) run_onchain "${test_name}" ;;
  setup)
    check_env
    setup_wallet
    ;;
  help) print_help ;;
  *)
    print_error "Unknown command: ${test_type}"
    print_help
    exit 2
    ;;
esac
