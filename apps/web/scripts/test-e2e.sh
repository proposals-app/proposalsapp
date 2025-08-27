#!/bin/bash

# E2E Test Runner Script
# Usage: ./scripts/test-e2e.sh [test-type] [options]

set -e

PROJECT_DIR="/Users/andrei/git/proposalsapp/apps/web"
cd "$PROJECT_DIR"

# Load environment variables from .env file
if [ -f ".env" ]; then
    print_status() { echo -e "\033[0;34m[E2E]\033[0m $1"; }
    print_status "Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
    print_status "Environment variables loaded successfully"
else
    echo "Warning: .env file not found in $PROJECT_DIR"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[E2E]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if service is running
check_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready at $url..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - waiting for $service_name..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name did not start within expected time"
    return 1
}

# Function to check environment variables
check_env() {
    if [ -z "$TEST_ACCOUNT_SEED_PHRASE" ]; then
        print_error "TEST_ACCOUNT_SEED_PHRASE environment variable is not set"
        print_status "Please set TEST_ACCOUNT_SEED_PHRASE in your environment"
        exit 1
    fi
}

# Function to setup wallet
setup_wallet() {
    print_status "Setting up MetaMask wallet..."
    pnpm synpress-setup
    if [ $? -eq 0 ]; then
        print_success "Wallet setup completed"
    else
        print_error "Wallet setup failed"
        exit 1
    fi
}

# Function to run individual offchain tests
run_offchain_test() {
    local test_name=$1
    print_status "Running offchain test: $test_name"
    
    local test_result=0
    case $test_name in
        "basic")
            pnpm e2e:test-basic
            test_result=$?
            ;;
        "single-choice")
            pnpm e2e:test-single-choice
            test_result=$?
            ;;
        "approval")
            pnpm e2e:test-approval
            test_result=$?
            ;;
        "quadratic")
            pnpm e2e:test-quadratic
            test_result=$?
            ;;
        "ranked-choice")
            pnpm e2e:test-ranked-choice
            test_result=$?
            ;;
        "weighted")
            pnpm e2e:test-weighted
            test_result=$?
            ;;
        *)
            print_error "Unknown offchain test: $test_name"
            print_status "Available tests: basic, single-choice, approval, quadratic, ranked-choice, weighted"
            exit 1
            ;;
    esac
    
    if [ $test_result -eq 0 ]; then
        print_success "Test $test_name passed"
    else
        print_error "Test $test_name failed with exit code $test_result"
        return $test_result
    fi
}

# Function to run individual onchain tests
run_onchain_test() {
    local test_name=$1
    print_status "Running onchain test: $test_name"
    
    local test_result=0
    case $test_name in
        "arbitrum-core")
            pnpm e2e:test-arbitrum-core
            test_result=$?
            ;;
        "arbitrum-treasury")
            pnpm e2e:test-arbitrum-treasury
            test_result=$?
            ;;
        *)
            print_error "Unknown onchain test: $test_name"
            print_status "Available tests: arbitrum-core, arbitrum-treasury"
            exit 1
            ;;
    esac
    
    if [ $test_result -eq 0 ]; then
        print_success "Test $test_name passed"
    else
        print_error "Test $test_name failed with exit code $test_result"
        return $test_result
    fi
}

# Main execution
TEST_TYPE=${1:-"help"}
TEST_NAME=${2:-""}

case $TEST_TYPE in
    "offchain")
        check_env
        print_status "Starting offchain tests..."
        
        # Cleanup function for offchain tests
        cleanup_offchain() {
            print_status "Cleaning up offchain test processes..."
            if [ ! -z "$STORYBOOK_PID" ]; then
                kill $STORYBOOK_PID 2>/dev/null || true
                print_status "Stopped Storybook (PID: $STORYBOOK_PID)"
            fi
            # Kill any remaining Storybook processes
            pkill -f "storybook" 2>/dev/null || true
            # Kill any remaining Playwright processes
            pkill -f "playwright" 2>/dev/null || true
        }
        
        # Set trap for cleanup on script exit
        trap cleanup_offchain EXIT
        
        # Start storybook in background
        print_status "Starting Storybook..."
        pnpm e2e:start-storybook &
        STORYBOOK_PID=$!
        
        # Wait for storybook to be ready
        if check_service "http://localhost:6006" "Storybook"; then
            # Setup wallet
            if setup_wallet; then
                # Run specific test or all tests
                if [ -n "$TEST_NAME" ]; then
                    if run_offchain_test "$TEST_NAME"; then
                        print_success "Offchain test '$TEST_NAME' completed successfully"
                        exit 0
                    else
                        print_error "Offchain test '$TEST_NAME' failed"
                        exit 1
                    fi
                else
                    print_status "Running all offchain tests..."
                    if npx playwright test e2e/vote-offchain.spec.ts; then
                        print_success "All offchain tests completed successfully"
                        exit 0
                    else
                        print_error "Some offchain tests failed"
                        exit 1
                    fi
                fi
            else
                print_error "Wallet setup failed"
                exit 1
            fi
        else
            print_error "Storybook failed to start"
            exit 1
        fi
        ;;
        
    "onchain")
        check_env
        print_status "Starting onchain tests..."
        
        # Cleanup function for onchain tests
        cleanup_onchain() {
            print_status "Cleaning up onchain test processes..."
            if [ ! -z "$ANVIL_PID" ]; then
                kill $ANVIL_PID 2>/dev/null || true
                print_status "Stopped Anvil (PID: $ANVIL_PID)"
            fi
            if [ ! -z "$STORYBOOK_PID" ]; then
                kill $STORYBOOK_PID 2>/dev/null || true
                print_status "Stopped Storybook (PID: $STORYBOOK_PID)"
            fi
            # Kill any remaining processes
            pkill -f "anvil" 2>/dev/null || true
            pkill -f "storybook" 2>/dev/null || true
            pkill -f "playwright" 2>/dev/null || true
        }
        
        # Set trap for cleanup on script exit
        trap cleanup_onchain EXIT
        
        # Start services in background
        print_status "Starting Anvil and Storybook..."
        pnpm e2e:start-anvil &
        ANVIL_PID=$!
        pnpm e2e:start-storybook &
        STORYBOOK_PID=$!
        
        # Wait for services to be ready
        if check_service "http://localhost:8545" "Anvil" && check_service "http://localhost:6006" "Storybook"; then
            # Setup wallet
            if setup_wallet; then
                # Run specific test or all tests
                if [ -n "$TEST_NAME" ]; then
                    if run_onchain_test "$TEST_NAME"; then
                        print_success "Onchain test '$TEST_NAME' completed successfully"
                        exit 0
                    else
                        print_error "Onchain test '$TEST_NAME' failed"
                        exit 1
                    fi
                else
                    print_status "Running all onchain tests..."
                    if npx playwright test e2e/vote-onchain.spec.ts; then
                        print_success "All onchain tests completed successfully"
                        exit 0
                    else
                        print_error "Some onchain tests failed"
                        exit 1
                    fi
                fi
            else
                print_error "Wallet setup failed"
                exit 1
            fi
        else
            print_error "Services failed to start"
            exit 1
        fi
        ;;
        
    "setup")
        check_env
        setup_wallet
        ;;
        
    "help"|*)
        echo "E2E Test Runner"
        echo ""
        echo "Usage: $0 [command] [test-name]"
        echo ""
        echo "Commands:"
        echo "  offchain [test-name]    Run offchain tests"
        echo "  onchain [test-name]     Run onchain tests (requires anvil)"
        echo "  setup                   Setup MetaMask wallet only"
        echo "  help                    Show this help"
        echo ""
        echo "Offchain test names:"
        echo "  basic, single-choice, approval, quadratic, ranked-choice, weighted"
        echo ""
        echo "Onchain test names:"
        echo "  arbitrum-core, arbitrum-treasury"
        echo ""
        echo "Examples:"
        echo "  $0 offchain basic       # Run basic offchain test"
        echo "  $0 offchain             # Run all offchain tests"
        echo "  $0 onchain arbitrum-core # Run arbitrum core test"
        echo "  $0 setup                # Setup wallet only"
        echo ""
        echo "Environment variables required:"
        echo "  TEST_ACCOUNT_SEED_PHRASE - MetaMask seed phrase for testing"
        ;;
esac

print_status "Script completed"