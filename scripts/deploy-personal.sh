#!/bin/bash
# Deploy to Vercel with personal icon override.
# Personal icons live in ./personal-assets/ (gitignored).
# This script swaps them in, deploys, then restores the generic icons from git.

set -e

cd "$(dirname "$0")/.."

if [ ! -f "personal-assets/icon.svg" ]; then
  echo "✗ personal-assets/icon.svg not found - nothing to do."
  exit 1
fi

echo "→ Installing sharp (for icon generation)..."
npm install --no-save sharp >/dev/null 2>&1

echo "→ Swapping in personal icon..."
cp personal-assets/icon.svg public/icon.svg
node scripts/generate-icons.mjs

echo "→ Deploying to Vercel production..."
npx vercel --prod

echo "→ Restoring generic icons from git..."
git checkout -- public/icon.svg public/icon-192.png public/icon-512.png public/apple-touch-icon.png public/favicon-32.png

echo "✓ Done. Personal icons deployed, generic icons restored locally."
