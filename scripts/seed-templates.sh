#!/bin/bash
set -e

echo "🌱 Seeding protocol templates..."

# Both URLs required for Prisma
DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")
DIRECT_URL=$(gcloud secrets versions access latest --secret="direct-url")
export DATABASE_URL DIRECT_URL

# Run the seed script
pnpm --filter @rezeta/tools exec tsx seed-protocol-templates.ts

echo "✅ Templates seeded!"