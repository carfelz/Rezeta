#!/bin/bash
set -e

PROJECT_ID="medical-erp-dev"
BUCKET="gs://medical-erp-dev-frontend"

echo "🏗️  Building frontend..."
pnpm install --frozen-lockfile
cd apps/web
pnpm build

echo "☁️  Deploying to GCS..."
gsutil -m rsync -r -d dist/ $BUCKET

echo "🔄 Setting cache headers..."
# Long cache for hashed assets (Vite adds hashes to filenames)
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
  "$BUCKET/assets/**"

# Short cache for HTML (no hash in filename)
gsutil -m setmeta -h "Cache-Control:public, max-age=0, must-revalidate" \
  "$BUCKET/*.html"

echo "✅ Frontend deployed!"
echo "   https://storage.googleapis.com/medical-erp-dev-frontend/index.html"