#!/bin/bash
set -e

echo "🌱 Seeding protocol templates..."

# Get the database URL
DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")
export DATABASE_URL

# Run the seed script
cd tools
npx tsx seed-protocol-templates.ts

echo "✅ Templates seeded!"