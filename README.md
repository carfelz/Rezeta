# Rezeta — Medical ERP

A medical ERP for Latin American specialists (initial market: Dominican Republic). Multi-location by default, with a first-class protocol engine for reusable clinical workflows.

- **API:** NestJS + Prisma — `apps/api`
- **Web:** React + Vite + Tailwind + Radix — `apps/web`
- **DB schema / migrations:** Prisma — `packages/db`
- **Shared types / Zod schemas:** `packages/shared`
- **Auth:** Firebase Authentication (Email/Password)

For deeper architectural context see `CLAUDE.md` and `specs/`.

## Prerequisites

| Tool   | Version    | Notes                                                  |
| ------ | ---------- | ------------------------------------------------------ |
| Node   | `>= 20.0`  | Tested on 24.x.                                        |
| pnpm   | `>= 10.0`  | `corepack enable && corepack prepare pnpm@latest --activate`. |
| Docker | any recent | Runs the local Postgres 16 container.                  |
| Firebase project | — | Needed for Authentication (Admin SDK + Web SDK keys). |

## 1. Clone & install

```bash
git clone <repo-url> Rezeta
cd Rezeta
pnpm install
```

## 2. Configure environment variables

Copy the template and fill in the Firebase values:

```bash
cp .env.example .env
```

Variables to set in `.env`:

| Key | Source | Notes |
| --- | ------ | ----- |
| `DATABASE_URL`       | template default | Points at the local Docker Postgres. Don't change unless you're running Postgres elsewhere. |
| `DIRECT_URL`         | template default | Same as `DATABASE_URL` locally. Prisma uses it for migrations when `DATABASE_URL` goes through a connection pooler. |
| `FIREBASE_PROJECT_ID`     | Firebase Console → Project settings → Service accounts → **Generate new private key** | `project_id` from the JSON. |
| `FIREBASE_CLIENT_EMAIL`   | same JSON | `client_email`. |
| `FIREBASE_PRIVATE_KEY`    | same JSON | `private_key`. Wrap in double quotes and keep the literal `\n` escapes (do **not** turn them into real newlines). |
| `VITE_FIREBASE_API_KEY`            | Firebase Console → Project settings → General → Your apps → SDK setup | `apiKey`. |
| `VITE_FIREBASE_AUTH_DOMAIN`        | same | `authDomain`. |
| `VITE_FIREBASE_PROJECT_ID`         | same | `projectId`. |
| `VITE_FIREBASE_APP_ID`             | same | `appId`. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| same | `messagingSenderId`. |

Other defaults (`PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`, `GCS_BUCKET`, `VITE_API_URL`) can stay as shipped.

**Never commit the service-account JSON or `.env`.** Both are gitignored — keep it that way.

## 3. Start Postgres

```bash
pnpm docker:up
```

This brings up `rezeta-postgres` on port 5432 (user `rezeta`, password `rezeta`, database `rezeta_dev`). The init script in `tools/postgres/init.sql` pre-enables the `uuid-ossp` and `pgcrypto` extensions so manual `psql` sessions work.

Healthcheck: `docker ps` should show `(healthy)` within a few seconds.

## 4. Apply migrations

For a fresh database, run **deploy** (not `migrate:dev`) — the pre-created extensions otherwise look like schema drift to `migrate dev` and it will demand a reset.

```bash
pnpm db:migrate
```

Later, when you change `packages/db/prisma/schema.prisma` and want a new migration:

```bash
pnpm db:migrate:dev
```

## 5. Seed data

```bash
pnpm db:seed
```

Two-phase seed:

1. **Postgres seed** (`packages/db/src/seed.ts`) — 3 tenants, 3 users, 6 locations, 12 patients, 6 appointments, 15 protocol templates.
2. **Firebase user seed** (`tools/seed-dev-users.ts`) — creates dev users in your Firebase Auth project. Idempotent; safe to re-run.

Dev login credentials:

| Email | Password |
| ----- | -------- |
| `test@test.com`        | `Test12345` |
| `dr.garcia@ejemplo.do` | `Test1234!` |
| `dra.reyes@ejemplo.do` | `Test1234!` |

## 6. Run the dev servers

```bash
pnpm dev
```

The root `predev` hook regenerates the Prisma client and builds `@rezeta/shared` first (both apps import from these and they have no source-watch). After that, API and Web run in parallel:

- API: http://localhost:3000 (health: `GET /health`)
- Web: http://localhost:5173

Stop with `Ctrl+C`.

## Common commands

| Command | What it does |
| ------- | ------------ |
| `pnpm dev`             | API + Web in parallel (with prebuild). |
| `pnpm build`           | Build packages, then both apps. |
| `pnpm typecheck`       | Workspace-wide `tsc --noEmit`. |
| `pnpm lint` / `lint:fix` | ESLint. Zero errors is the bar. |
| `pnpm test`            | Vitest across all packages. |
| `pnpm test:coverage`   | Coverage report. Bar is 90%+ on statements/branches/functions/lines. |
| `pnpm docker:up` / `docker:down` | Start/stop the Postgres container. |
| `pnpm db:migrate`      | Apply pending migrations (`prisma migrate deploy`). |
| `pnpm db:migrate:dev`  | Create a new migration from schema changes. |
| `pnpm db:reset`        | Drop and re-apply everything. **Destructive.** |
| `pnpm db:seed`         | Run both Postgres and Firebase seeders. |
| `pnpm db:studio`       | Prisma Studio (DB GUI). |

## Troubleshooting

**`Environment variable not found: DIRECT_URL` when running Prisma.** `.env` is missing `DIRECT_URL`. Set it to the same value as `DATABASE_URL` for local development.

**`Drift detected: Your database schema is not in sync` on first `migrate:dev`.** The init script pre-creates the `uuid-ossp` and `pgcrypto` extensions. Use `pnpm db:migrate` for the first run; switch to `migrate:dev` afterwards.

**`Cannot find module '@rezeta/shared/dist/index.js'` or `Failed to resolve entry for package "@rezeta/shared"`.** Run `pnpm --filter @rezeta/shared build`, or just `pnpm dev` — the `predev` hook handles it.

**`Service account object must contain a string "project_id" property`.** `FIREBASE_PROJECT_ID` (and likely the other two Admin keys) are empty in `.env`. Fill them from the service-account JSON.

**Port already in use (`EADDRINUSE`).** Something else is on 3000 or 5432. Find and kill it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`) or change `PORT` in `.env` for the API.

**Postgres container not healthy.** `docker logs rezeta-postgres` will show why. The most common cause is a stale volume from an earlier project with conflicting credentials — `docker compose down -v` will wipe the volume (destroys local data).
