# Tools

Developer scripts for local setup and database management.

## Local dev setup (first time)

```bash
# 1. Copy env vars
cp .env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Fill in Firebase values in both files

# 2. Start Postgres
docker compose up -d

# 3. Run migrations + seed system templates
pnpm db:migrate
pnpm db:seed

# 4. (Optional) Load demo data
#    Create a Firebase user first via the emulator UI at http://localhost:4000/auth
#    then run:
pnpm demo:data --firebase-uid=<uid-from-firebase>

# 5. Start everything
pnpm dev
```

## Firebase emulator (local auth)

The Firebase Auth emulator is not included in Docker Compose — run it separately:

```bash
# Requires firebase-tools: npm install -g firebase-tools
firebase emulators:start --only auth
# UI available at http://localhost:4000/auth
```

Point the API at the emulator by adding to `apps/api/.env`:
```
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

## Scripts

| Command | Description |
|---|---|
| `pnpm docker:up` | Start Postgres in the background |
| `pnpm docker:down` | Stop and remove containers |
| `pnpm db:migrate` | Apply pending Prisma migrations |
| `pnpm db:seed` | Seed system protocol templates |
| `pnpm db:reset` | Drop, recreate, migrate, and seed |
| `pnpm db:studio` | Open Prisma Studio at http://localhost:5555 |
| `pnpm demo:data` | Create demo tenant, user, locations, and patients |
