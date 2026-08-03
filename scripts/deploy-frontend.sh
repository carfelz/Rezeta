#!/bin/bash
# Manual frontend deploy (normally done by .github/workflows/deploy-dev.yml).
# Builds the web app and publishes all Firebase Hosting targets
# (app-dev, api-dev, staff-dev) defined in firebase.json/.firebaserc.
set -e

PROJECT_ID="medical-erp-dev"

echo "🏗️  Building frontend..."
pnpm install --frozen-lockfile
pnpm --filter @rezeta/shared build
cd apps/web
pnpm build
cd ../..

echo "☁️  Deploying to Firebase Hosting..."
npx -y firebase-tools deploy --only hosting --project "$PROJECT_ID" --force

echo "✅ Frontend deployed!"
echo "   https://app-dev.rezeta.co"
echo "   https://staff-dev.rezeta.co"
