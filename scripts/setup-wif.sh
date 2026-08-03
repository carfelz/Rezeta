#!/bin/bash
# One-time setup: Workload Identity Federation for GitHub Actions deploys.
# Run in Google Cloud Shell (or anywhere gcloud is authenticated as an owner
# of the project). Safe to re-run: every step tolerates "already exists".
#
# After it finishes, store the two printed values as GitHub repo VARIABLES
# (Settings → Secrets and variables → Actions → Variables):
#   GCP_WIF_PROVIDER  — full provider resource name
#   GCP_DEPLOYER_SA   — service account email
# Then delete the GCP_SA_KEY repo secret and the old service-account key.
set -euo pipefail

PROJECT_ID="medical-erp-dev"
GITHUB_REPO="carfelz/Rezeta"
POOL_ID="github"
PROVIDER_ID="github-actions"
SA_NAME="github-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

echo "==> Enabling required APIs..."
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com \
  --project "$PROJECT_ID"

echo "==> Creating workload identity pool '${POOL_ID}'..."
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project "$PROJECT_ID" --location global \
  --display-name "GitHub Actions" 2>/dev/null || echo "    (already exists)"

echo "==> Creating OIDC provider '${PROVIDER_ID}' (restricted to ${GITHUB_REPO})..."
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project "$PROJECT_ID" --location global \
  --workload-identity-pool "$POOL_ID" \
  --display-name "GitHub Actions OIDC" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository=='${GITHUB_REPO}'" \
  2>/dev/null || echo "    (already exists)"

echo "==> Creating deployer service account '${SA_NAME}'..."
gcloud iam service-accounts create "$SA_NAME" \
  --project "$PROJECT_ID" \
  --display-name "GitHub Actions deployer" 2>/dev/null || echo "    (already exists)"

echo "==> Granting deploy roles to ${SA_EMAIL}..."
# run.admin                      — deploy Cloud Run revisions
# iam.serviceAccountUser         — deploy as the Cloud Run runtime SA
# artifactregistry.writer        — push Docker images
# secretmanager.secretAccessor   — read database_url/direct_url in the workflow
# firebasehosting.admin          — deploy Firebase Hosting sites
# serviceusage.serviceUsageConsumer — firebase-tools API calls
for ROLE in \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor \
  roles/firebasehosting.admin \
  roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${SA_EMAIL}" --role "$ROLE" \
    --condition None --quiet >/dev/null
  echo "    granted ${ROLE}"
done

echo "==> Allowing ${GITHUB_REPO} workflows to impersonate the deployer SA..."
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  --quiet >/dev/null

echo ""
echo "Done. Set these as GitHub repo VARIABLES (not secrets):"
echo ""
echo "  GCP_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo "  GCP_DEPLOYER_SA=${SA_EMAIL}"
echo ""
echo "After the first successful WIF deploy, delete the GCP_SA_KEY repo secret"
echo "and the old JSON key (gcloud iam service-accounts keys list/delete)."
