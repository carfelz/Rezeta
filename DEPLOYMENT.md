# Deployment Guide

## GCP Project

- Organization: rezeta.co (project migrated into the org 2026-08)
- Display name: **Rezeta** · Project ID: **`medical-erp-dev`** (display-name
  renames and org migrations never change the project ID — all resource
  references keep using `medical-erp-dev`)
- Region: `southamerica-east1` (São Paulo, Brazil)

## Domains (dev)

| URL                           | Serves        | Hosting site       |
| ----------------------------- | ------------- | ------------------ |
| `https://app-dev.rezeta.co`   | Web app       | `rezeta-app-dev`   |
| `https://api-dev.rezeta.co`   | NestJS API    | `rezeta-api-dev`   |
| `https://staff-dev.rezeta.co` | Staff console | `rezeta-staff-dev` |

Reserved for production later: `app.rezeta.co`, `api.rezeta.co`,
`staff.rezeta.co`.

All three are Firebase Hosting sites (targets mapped in `.firebaserc`,
config in `firebase.json`):

- **app-dev / staff-dev** serve the same built SPA (`apps/web/dist`) and
  rewrite `/v1/**` to the `medical-erp-api` Cloud Run service, so the app
  calls the API same-origin — no CORS involved. On staff hosts the app
  redirects `/` to `/staff/institutions` (`apps/web/src/lib/staff-host.tsx`).
- **api-dev** has no static content — a `**` rewrite forwards everything to
  Cloud Run. This is the standard workaround for Cloud Run domain mappings
  not supporting `southamerica-east1` (the alternative, an external HTTPS
  load balancer, costs ~$18/month).

## CI/CD (GitHub Actions)

`.github/workflows/deploy-dev.yml` runs on every push to `main`:
lint/typecheck/test → migrate DB → build & deploy API to Cloud Run → build
frontend → deploy all Hosting targets.

Auth is **keyless** via Workload Identity Federation — no service-account
JSON key. Repo **variables** (Settings → Secrets and variables → Actions):

- `GCP_WIF_PROVIDER` — workload identity provider resource name
- `GCP_DEPLOYER_SA` — `github-deployer@medical-erp-dev.iam.gserviceaccount.com`
- `VITE_FIREBASE_*` (5 vars) — Firebase web app config (public, ships in bundle)

`VITE_API_URL` is deliberately **not** set in CI: an empty value makes the
app use relative `/v1/...` paths through the Hosting rewrite.

## One-Time Setup (performed 2026-08-02)

The setup scripts (`scripts/setup-wif.sh`, `scripts/setup-hosting-sites.sh`)
were removed after running — recover them from git history if a new
environment ever needs the same bootstrap. What they did:

1. WIF: created the `github` workload identity pool, a GitHub OIDC provider
   locked to `carfelz/Rezeta`, and the `github-deployer` service account
   with deploy roles (Cloud Run admin, SA user, Artifact Registry writer,
   Secret Manager accessor, Firebase Hosting admin, service usage consumer).
2. Hosting: created the three sites and added the dev origins to the
   `allowed_origins` secret.
3. Firebase console → Hosting → added each custom domain to its site (DNS
   CNAMEs at GoDaddy point each subdomain at `<site>.web.app`).
4. Firebase console → Authentication → Settings → Authorized domains →
   added `app-dev.rezeta.co` and `staff-dev.rezeta.co`.

## Cloud Resources

- **Cloud Run:** `medical-erp-api` (512Mi / 1 CPU / 0–10 instances)
- **Database:** **Supabase** Postgres, reached through the connection pooler at
  `aws-1-us-east-1.pooler.supabase.com:5432`. It is **not** Cloud SQL — the
  Cloud SQL Admin API is disabled on the project and there is no
  `medical-erp-dev-db` instance. The pooler is publicly reachable, so Prisma
  connects straight to it; no `cloud-sql-proxy` is involved.
- **Artifact Registry:** `medical-erp` repository (Docker images)
- **GCS:** `gs://medical-erp-dev-uploads` (private, signed URLs only)
- **Secret Manager:** `database_url`, `direct_url`, `firebase-admin-key`,
  `allowed_origins`

Note: Cloud Run pins `:latest` secret versions per revision — updating a
secret (e.g. `allowed_origins`) takes effect on the **next deploy**.

### Running a script against the dev database

`deploy-dev.yml` runs `prisma migrate deploy` and nothing else — it never
seeds. Anything else (for example provisioning the first staff account) is a
manual step:

```bash
gcloud secrets versions access latest --secret=database_url --project=medical-erp-dev
gcloud secrets versions access latest --secret=direct_url --project=medical-erp-dev
```

Copy `.env`, replace `DATABASE_URL` / `DIRECT_URL` with those values, and run
the script **with `apps/api` as the working directory** — from the repo root
`tsx` misses that package's tsconfig and fails with `Parameter decorators only
work when experimental decorators are enabled`.

## Staff Console Accounts

Staff sign-in uses a **different account per environment**: the Firebase
project is shared, but the databases are not, and a `PlatformUser` row in one
says nothing about the other.

| Environment | Account            |
| ----------- | ------------------ |
| dev         | `staff@rezeta.co`  |
| local       | `staff@rezeta.test`|

Provision one with `create-institution.ts` (npm script
`bootstrap:platform`) against that environment's database:

```bash
pnpm --filter @rezeta/api bootstrap:platform --platform-email=<email> --platform-name="<name>"
```

It prints a set-password link. Note it calls `createUser` unconditionally, so
an email that already exists in the shared Firebase project fails with
`USER_ALREADY_EXISTS` — use a fresh address per environment.

`POST /v1/auth/provision` answering `USER_NOT_PROVISIONED` for a staff
identity is **expected**: a `PlatformUser` has no institution `User` row, and
the frontend deliberately ignores that code. It is not an auth failure.

## Manual Deployment

Normally deploys happen from CI. For manual pushes (require local gcloud +
Docker):

```bash
./scripts/deploy-api.sh       # build image, push, deploy Cloud Run
./scripts/deploy-frontend.sh  # build SPA, deploy all Hosting targets
./scripts/run-migrations.sh   # prisma migrate deploy
```

## Org Migration Notes (2026-08)

New organizations enforce secure-by-default policies; if a deploy fails
after policy changes, check:

- `iam.allowedPolicyMemberDomains` — blocks `allUsers` grants; the API's
  `--allow-unauthenticated` needs a project-level exception if enforced.
- `iam.disableServiceAccountKeyCreation` — key creation may be blocked;
  irrelevant once WIF is in place (which is the point).

## Cost Estimate

- Database: billed by Supabase, not GCP — see the Supabase dashboard
- Cloud Run: ~$5-10/month (minimal traffic)
- GCS + Hosting: ~$1-2/month
- **Total: ~$15-20/month**

## Disaster Recovery

- Database backups are Supabase's, governed by the project's plan — verify the
  retention there rather than assuming GCP-side backups exist
- Manual: Export Prisma schema + seed data monthly
