#!/usr/bin/env bash
# Build and package the app for Hostinger web-app hosting (zip upload).
#
# Hostinger quirks this script accounts for (learned the hard way, 2026-06):
#  - The deploy pipeline copies zip sources + node_modules into the runtime dir
#    but NOT build artifacts, so dist/ (frontend) and dist-server/ (precompiled
#    backend) must ship inside the zip.
#  - The runtime strips execute bits, so the backend must not need tsx/esbuild
#    at runtime — server.js boots dist-server/index.js when present.
#
# Usage: bash scripts/package-hostinger.sh [output.zip]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-portal.zip}"

if ! git diff-index --quiet HEAD --; then
  echo "WARNING: uncommitted changes exist and will NOT be included (zip is built from HEAD)." >&2
fi

npm run build
git archive --format=zip -o "$OUT" HEAD
python3 - "$OUT" <<'EOF'
import os, sys, zipfile
out = sys.argv[1]
with zipfile.ZipFile(out, 'a') as z:
    z.write('dist-server/index.js', 'dist-server/index.js')
    for root, _, files in os.walk('dist'):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, full)
print(f'{out}: {len(zipfile.ZipFile(out).namelist())} files, ready to upload')
EOF
