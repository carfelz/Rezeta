#!/bin/bash
set -e

echo "🗃️  Running Prisma migrations against Supabase..."

# Both URLs are required: DIRECT_URL for the migration connection, DATABASE_URL for schema resolution
DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")
DIRECT_URL=$(gcloud secrets versions access latest --secret="direct-url")
export DATABASE_URL DIRECT_URL

# Run migrations
pnpm --filter @rezeta/db exec prisma migrate deploy

echo "✅ Migrations complete!"
echo "   You can view your database at: https://supabase.com/dashboard/project/_/editor"