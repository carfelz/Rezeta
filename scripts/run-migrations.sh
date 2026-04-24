#!/bin/bash
set -e

echo "🗃️  Running Prisma migrations against Supabase..."

# Get the database URL from Secret Manager
DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")

# Export it for Prisma
export DATABASE_URL

# Run migrations
cd packages/db
npx prisma migrate deploy

echo "✅ Migrations complete!"
echo "   You can view your database at: https://supabase.com/dashboard/project/_/editor"