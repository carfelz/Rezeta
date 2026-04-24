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
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --set-secrets DATABASE_URL=database-url:latest,FIREBASE_ADMIN_KEY=firebase-admin-key:latest

echo "✅ API deployed!"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
echo "   $SERVICE_URL"

# Save URL for frontend
echo "VITE_API_URL=$SERVICE_URL" > apps/web/.env.production