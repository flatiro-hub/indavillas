#!/usr/bin/env bash
# Cloudflare Pages build: copies what the website serves into dist/.
#   Build command:  bash scripts/build.sh      Output directory:  dist
# Everything in the repo root goes out except the sources and tools below; a new page folder
# (e.g. about/) is published automatically. The /api endpoints are Cloudflare Functions (functions/).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
for f in * .well-known; do
  [ -e "$f" ] || continue
  case "$f" in
    _v3|_v4|_build|_design-guide|api|firebase|functions|functions-lib|scripts|dist|node_modules|*.md|*.zip|package.json|package-lock.json|wrangler.toml) continue ;;
  esac
  cp -R "$f" dist/
done
cp _headers _redirects dist/ 2>/dev/null || true
find dist -name '.htaccess' -delete
find dist -name '.DS_Store' -delete
echo "dist/: $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"
