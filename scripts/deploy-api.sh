#!/bin/bash
set -e

PROJECT_ID="medical-erp-dev"
REGION="southamerica-east1"
SERVICE_NAME="medical-erp-api"
REPOSITORY="medical-erp"

echo "🏗️  Building Docker image..."

# Build the image
docker build \
  -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest \
  -f apps/api/Dockerfile \
  .

echo "☁️  Configuring Docker for Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

echo "📦 Pushing image to Artifact Registry..."
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 60 \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database_url:latest,FIREBASE_ADMIN_KEY=firebase-admin-key:latest,ALLOWED_ORIGINS=allowed_origins:latest

echo "✅ API deployed!"
echo "   https://api-dev.rezeta.co"