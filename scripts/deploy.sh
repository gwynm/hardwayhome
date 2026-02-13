#!/bin/bash
set -euo pipefail

echo "=== Hard Way Home: Test, Build & Deploy ==="
echo ""

# Stamp build info (git hash + date)
echo "--- Generating build info ---"
bash scripts/generate-build-info.sh

# Run tests
echo "--- Running tests ---"
npm test
echo ""

# Regenerate native project to pick up any app.json changes (icons, permissions, plugins)
echo "--- Regenerating native project ---"
npx expo prebuild --platform ios 
echo ""

# Build and install on connected device
echo "--- Building and installing on device ---"
npx expo run:ios --device --configuration Release
