#!/bin/bash
set -e

echo "🌱 Seeding database against deployed environment..."

# Both URLs required for Prisma (pooled + direct)
DATABASE_URL=$(gcloud secrets versions access latest --secret="database_url")
DIRECT_URL=$(gcloud secrets versions access latest --secret="direct_url")
export DATABASE_URL DIRECT_URL

# Step 1: seed owner tenant + user + tenant-scoped protocol templates/types.
# Skips seed-dev-users.ts which requires the Firebase Auth emulator.
echo ""
echo "→ Seeding owner account and tenant templates..."
pnpm --filter @rezeta/db seed

echo ""
echo "✅ Done. Update the firebase_uid on the seeded user row to match"
echo "   your Firebase Auth UID before logging in:"
echo ""
echo "   UPDATE users SET firebase_uid = '<your-uid>' WHERE email = 'carlos.felizmedina@thryv.com';"
echo ""