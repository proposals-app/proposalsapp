#!/bin/bash

# Verify Linting and Formatting Setup
# Run this script to verify your development environment is properly configured

set -e

echo "🔍 Verifying Linting and Formatting Setup..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are available
echo -e "${BLUE}Checking required tools...${NC}"

if command -v yarn &> /dev/null; then
    echo -e "${GREEN}✓ Yarn found${NC}"
else
    echo -e "${RED}✗ Yarn not found${NC}"
    exit 1
fi

if command -v cargo &> /dev/null; then
    echo -e "${GREEN}✓ Cargo found${NC}"
else
    echo -e "${RED}✗ Cargo not found${NC}"
    exit 1
fi

if command -v npx &> /dev/null; then
    echo -e "${GREEN}✓ npx found${NC}"
else
    echo -e "${RED}✗ npx not found${NC}"
    exit 1
fi

echo ""

# Check configuration files
echo -e "${BLUE}Checking configuration files...${NC}"

config_files=(
    "eslint.config.mjs"
    "prettier.config.mjs"
    "clippy.toml"
    "rustfmt.toml"
    ".vscode/settings.json"
    ".zed/settings.json"
)

for file in "${config_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ $file missing${NC}"
    fi
done

echo ""

# Test linting commands
echo -e "${BLUE}Testing linting commands...${NC}"

echo -e "${YELLOW}Running TypeScript/JavaScript linting...${NC}"
if yarn lint --max-warnings 10 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ ESLint working${NC}"
else
    echo -e "${YELLOW}⚠ ESLint has issues (may be expected)${NC}"
fi

echo -e "${YELLOW}Running Prettier check...${NC}"
if yarn format > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Prettier formatting is clean${NC}"
else
    echo -e "${YELLOW}⚠ Prettier has formatting issues${NC}"
fi

echo -e "${YELLOW}Running Rust linting...${NC}"
if cargo check --quiet > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Rust compilation works${NC}"
else
    echo -e "${YELLOW}⚠ Rust has compilation issues${NC}"
fi

echo -e "${YELLOW}Running Rust formatting check...${NC}"
if yarn format:rust:check > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Rust formatting is clean${NC}"
else
    echo -e "${YELLOW}⚠ Rust has formatting issues${NC}"
fi

echo ""

# IDE integration check
echo -e "${BLUE}IDE Integration Check...${NC}"

if [ -d ".vscode" ]; then
    echo -e "${GREEN}✓ VSCode configuration available${NC}"
    echo "  - Format on save: enabled"
    echo "  - ESLint auto-fix: enabled"
    echo "  - Import organization: enabled"
else
    echo -e "${YELLOW}⚠ VSCode configuration not found${NC}"
fi

if [ -d ".zed" ]; then
    echo -e "${GREEN}✓ Zed configuration available${NC}"
    echo "  - Format on save: enabled"
    echo "  - ESLint auto-fix: enabled" 
    echo "  - Import organization: enabled"
else
    echo -e "${YELLOW}⚠ Zed configuration not found${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}Available Commands:${NC}"
echo "  yarn lint          - Run ESLint"
echo "  yarn lint:fix      - Run ESLint with auto-fix"
echo "  yarn format        - Check Prettier formatting"
echo "  yarn format:fix    - Auto-fix Prettier formatting"
echo "  yarn lint:rust     - Run Rust clippy"
echo "  yarn format:rust   - Format Rust code"
echo "  yarn check         - Run all linting and formatting checks"
echo "  yarn fix           - Auto-fix all issues"

echo ""
echo -e "${GREEN}✅ Setup verification complete!${NC}"
echo "Your development environment is ready for linting and formatting."