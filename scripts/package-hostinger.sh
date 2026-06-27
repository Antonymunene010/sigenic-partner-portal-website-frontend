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
# Usage: bash scripts/package-hostinger.sh [--staging] [output.zip]
#
# Default builds the production zip (demo-account shortcuts on the login page
# are tree-shaken out). Pass --staging to build the test-env zip — the demo
# shortcuts stay visible, and the default output filename gets a `-staging`
# suffix so the two artifacts can't be uploaded to the wrong site by mistake.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET=prod
OUT=
while [[ $# -gt 0 ]]; do
  case "$1" in
    --staging) TARGET=staging; shift ;;
    --prod)    TARGET=prod;    shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *)  OUT="$1"; shift ;;
  esac
done
if [[ -z "$OUT" ]]; then
  OUT="portal$([[ $TARGET == staging ]] && echo '-staging').zip"
fi

if ! git diff-index --quiet HEAD --; then
  echo "WARNING: uncommitted changes exist and will NOT be included (zip is built from HEAD)." >&2
fi

if [[ $TARGET == staging ]]; then
  echo "Building for STAGING (VITE_IS_STAGING=true → demo accounts visible)"
  export VITE_IS_STAGING=true
else
  echo "Building for PRODUCTION (VITE_IS_STAGING unset → demo accounts hidden)"
  unset VITE_IS_STAGING
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
