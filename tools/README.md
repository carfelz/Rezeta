# Tools

Developer scripts for local setup and database management.

## Local dev setup (first time)

```bash
# 1. Copy env vars and fill in Firebase + DB values
cp .env.example .env
cp apps/web/.env.example apps/web/.env

# 2. Start Postgres
docker compose up -d

# 3. Run migrations
pnpm db:migrate

# 4. (Optional) Seed dev users into Firebase and Postgres
#    Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env
pnpm seed:dev

# 5. Start everything
pnpm dev
```

## Scripts

| Command            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `pnpm docker:up`   | Start Postgres in the background                    |
| `pnpm docker:down` | Stop and remove containers                          |
| `pnpm db:migrate`  | Apply pending Prisma migrations                     |
| `pnpm db:seed`     | Seed system protocol templates                      |
| `pnpm db:reset`    | Drop, recreate, migrate, and seed                   |
| `pnpm db:studio`   | Open Prisma Studio at http://localhost:5555         |
| `pnpm seed:dev`    | Create dev users in Firebase dev project + Postgres |

## Regression seed

`tools/seed-regression.sh` populates a full MVP dataset for the test user (`test@test.com` / `Test12345`) so you can do a complete regression test of every module.

```bash
# Run against local API (default http://localhost:3000)
./tools/seed-regression.sh

# Run against a different API
API_URL=https://dev.api.rezeta.io ./tools/seed-regression.sh
```

What it seeds:

| Phase         | Count | Details                                                       |
| ------------- | ----- | ------------------------------------------------------------- |
| Locations     | 3     | Centro Médico Nacional, Clínica Santiago, Consultorio Privado |
| Patients      | 10    | Varied demographics, diagnoses, allergies                     |
| Appointments  | 18    | 10 past (completed), 8 upcoming                               |
| Consultations | 8     | 6 signed with SOAP notes + prescriptions; 2 draft             |
| Invoices      | 8     | 3 paid, 3 issued, 2 draft                                     |
| Protocols     | 5     | One per default type, all published with full block content   |

Requires the API to be running and the test user to exist (created by `pnpm seed:dev`).
