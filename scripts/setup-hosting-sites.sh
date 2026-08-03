#!/bin/bash
# One-time setup: Firebase Hosting sites for the dev subdomains.
# Run in Google Cloud Shell (firebase CLI preinstalled) or anywhere
# firebase-tools is authenticated against the project. Safe to re-run.
#
# Sites map to targets in .firebaserc:
#   rezeta-app-dev   → app-dev.rezeta.co   (web app)
#   rezeta-api-dev   → api-dev.rezeta.co   (Cloud Run rewrite only)
#   rezeta-staff-dev → staff-dev.rezeta.co (staff console)
set -euo pipefail

PROJECT_ID="medical-erp-dev"

echo "==> Creating hosting sites..."
for SITE in rezeta-app-dev rezeta-api-dev rezeta-staff-dev; do
  firebase hosting:sites:create "$SITE" --project "$PROJECT_ID" \
    2>/dev/null || echo "    ${SITE} (already exists)"
done

echo "==> Adding dev origins to the allowed_origins secret..."
# The app calls the API same-origin through the Hosting rewrite, so CORS is
# only needed for anything hitting api-dev.rezeta.co cross-origin (e.g.
# Swagger "try it out" from the app domains, local dev).
printf '%s' "http://localhost:5173,http://localhost:5174,https://app-dev.rezeta.co,https://staff-dev.rezeta.co" |
  gcloud secrets versions add allowed_origins --project "$PROJECT_ID" --data-file=-
echo "    new secret version added (picked up on the next Cloud Run deploy)"

cat <<'EOF'

Done. Remaining MANUAL steps (cannot be scripted):

1. Custom domains — Firebase console → Hosting → (each site) → Add custom domain:
     rezeta-app-dev   → app-dev.rezeta.co
     rezeta-api-dev   → api-dev.rezeta.co
     rezeta-staff-dev → staff-dev.rezeta.co
   For each, copy the DNS records Firebase shows (TXT for verification, then
   A/AAAA records) into your registrar's DNS panel for rezeta.co.
   TLS certificates are provisioned automatically after DNS propagates.

2. Firebase Auth — Authentication → Settings → Authorized domains → add:
     app-dev.rezeta.co
     staff-dev.rezeta.co

3. Push to main (or run the Deploy to Dev workflow) so all three hosting
   targets get their first deploy and the API picks up the new CORS origins.
EOF
