# Dev Subdomains on rezeta.co + Workload Identity Federation — Design

**Date:** 2026-08-02
**Status:** Approved (dev-only scope; production environment deferred)

## Context

The `rezeta.co` domain was purchased, a GCP organization was created, and the
existing project was migrated into it. The project display name changed from
"Medical ERP Dev" to "Rezeta", but the **project ID remains `medical-erp-dev`**
(renames and org migrations never change project IDs), so all existing
infrastructure references keep working.

Production is explicitly out of scope for now — the app is not production-ready.
This slice wires the dev environment to real subdomains and replaces the
long-lived service-account key used by CI with Workload Identity Federation.

## Subdomains (dev)

| Subdomain             | Serves        | Mechanism                                                                 |
| --------------------- | ------------- | ------------------------------------------------------------------------- |
| `app-dev.rezeta.co`   | Main web app  | Firebase Hosting site `rezeta-app-dev`, serves `apps/web/dist`, keeps the `/v1/** → medical-erp-api` Cloud Run rewrite (same-origin API, no CORS) |
| `api-dev.rezeta.co`   | NestJS API    | Firebase Hosting site `rezeta-api-dev`, no static content, `** → medical-erp-api` Cloud Run rewrite |
| `staff-dev.rezeta.co` | Staff console | Firebase Hosting site `rezeta-staff-dev`, same built bundle; host-aware root redirect to `/staff/institutions` |

Reserved for later (production): `app.rezeta.co`, `api.rezeta.co`,
`staff.rezeta.co`.

**Why Hosting rewrites for the API domain:** Cloud Run domain mappings do not
support `southamerica-east1`, and an external HTTPS load balancer costs
~$18/month. A rewrite-only Hosting site is free and gives automatic TLS.

## Frontend changes

- `VITE_API_URL` is no longer baked into the deploy build. Empty value makes
  `api-client.ts`/`logger.ts` use relative `/v1/...` paths, which the Hosting
  rewrite forwards to Cloud Run same-origin.
- Host-aware root redirect: a pure helper (`apps/web/src/lib/staff-host.tsx`)
  detects staff hostnames (`staff.*` / `staff-dev.*`) and contributes a
  top-level `/` route that redirects to `/staff/institutions`. It is declared
  before the `AuthGate` layout so staff users (who 404 on `/v1/auth/me`) never
  get bounced to `/login` by the doctor-app auth gate.

## CI/CD changes (`.github/workflows/deploy-dev.yml`)

- Auth switches from `credentials_json: ${{ secrets.GCP_SA_KEY }}` to
  Workload Identity Federation:
  `workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}` +
  `service_account: ${{ vars.GCP_DEPLOYER_SA }}`.
- The `deploy-frontend` job gains `permissions: id-token: write`.
- The frontend build stops consuming the Cloud Run URL output; the Firebase
  deploy publishes all three hosting targets.
- After the first successful WIF deploy, the `GCP_SA_KEY` GitHub secret and the
  underlying service-account key are deleted.

## One-time GCP setup (run by the owner, e.g. in Cloud Shell)

- `scripts/setup-wif.sh` — creates the `github` workload identity pool, a
  GitHub OIDC provider restricted to the `carfelz/Rezeta` repository, the
  `github-deployer` service account with deploy roles (Cloud Run admin,
  service account user, Artifact Registry writer, Secret Manager accessor,
  Firebase Hosting admin, service usage consumer), and prints the two values
  to store as GitHub repo variables.
- `scripts/setup-hosting-sites.sh` — creates the three Hosting sites and adds
  the new origins to the `allowed_origins` secret.
- Console steps (cannot be scripted): add the three custom domains in Firebase
  Hosting, create the DNS records at the registrar, and add the domains to
  Firebase Auth → Authorized domains.

## Repo housekeeping in the same slice

- `firebase.json` → multi-site array with hosting targets; `.firebaserc` gains
  the target-to-site mapping.
- `scripts/deploy-frontend.sh` rewritten for Firebase Hosting (it still
  deployed to the retired GCS static-website bucket).
- `scripts/deploy-api.sh` aligned with the workflow (secret names
  `database_url`/`allowed_origins`; drops the stale `.env.production` write).
- `DEPLOYMENT.md` rewritten: domain table, DNS/console steps, WIF, display
  name vs project ID note.

## Testing

- Unit tests for the staff-host helper (hostname detection + route
  contribution), meeting the 95% per-file coverage gate.
- `pnpm lint` and `pnpm test` green before finishing.
- Live verification (custom domains resolving, WIF deploy) happens after the
  owner runs the setup scripts and DNS propagates.

## Out of scope

- Production environment (project, subdomains, deploy workflow).
- Splitting the staff console into its own app/bundle.
- Renaming existing GCP resources (`medical-erp-api` service, buckets,
  Artifact Registry repo) — cosmetic, not worth the migration risk.
