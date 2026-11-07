#!/usr/bin/env bash
# Packs game/ into dist/bloomfall-<version>.zip with index.html at the archive root.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-1.0.0}"
mkdir -p dist
OUT="dist/bloomfall-${VERSION}.zip"
rm -f "$OUT"
(cd game && zip -qr -X "../$OUT" index.html playgama-bridge.js playgama-bridge-config.json js audio)
echo "$OUT $(wc -c < "$OUT") bytes"
