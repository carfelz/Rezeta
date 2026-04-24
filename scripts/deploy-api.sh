#!/bin/bash
set -e

PROJECT_ID="medical-erp-dev"
REGION="southamerica-east1"
SERVICE_NAME="medical-erp-api"

echo "🏗️  Building and deploying API to Cloud Run..."

cd apps/api

# Deploy from source (Cloud Run builds the container for you)
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 60 \
  --set-env-vars "NODE_ENV=production,PORT=8080" \
  --set-secrets "DATABASE_URL=database-url:latest,FIREBASE_ADMIN_KEY=firebase-admin-key:latest"

echo "✅ API deployed!"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
echo "   $SERVICE_URL"

# Store the URL for frontend to use
echo "API_URL=$SERVICE_URL" > ../../apps/web/.env.production