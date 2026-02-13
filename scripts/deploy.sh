#!/bin/bash
set -euo pipefail

echo "=== Hard Way Home: Test, Build & Deploy ==="
echo ""

# Run tests
echo "--- Running tests ---"
npm test
echo ""

# Build and install on connected device
echo "--- Building and installing on device ---"
npx expo run:ios --device --configuration Release
