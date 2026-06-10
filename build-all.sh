#!/usr/bin/env bash
# Build all artifacts for production deployment (bothost.ru / external VPS)
set -e

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Pushing database schema (creates tables if not exist)..."
pnpm --filter @workspace/db run push

echo "==> Building tg-shop frontend..."
BASE_PATH="/tg-shop/" PORT=3001 pnpm --filter @workspace/tg-shop run build

echo "==> Building admin-panel frontend..."
BASE_PATH="/admin-panel/" PORT=3000 pnpm --filter @workspace/admin-panel run build

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo ""
echo "✅ Build complete! Start the bot with:"
echo "   pm2 start ecosystem.config.cjs"
echo "   or: node artifacts/api-server/dist/index.mjs"
