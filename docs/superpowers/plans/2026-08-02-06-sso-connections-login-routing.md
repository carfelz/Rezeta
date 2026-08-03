# SSO Connections + Login Routing (identity slice 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff-managed per-institution OIDC SSO connections + a public login-method routing endpoint + login-screen SSO/Google sign-in, per `docs/superpowers/specs/2026-08-02-sso-connections-login-routing-design.md`.

**Architecture:** Each `SsoConnection` row maps 1:1 to a GCP Identity Platform OIDC provider config (`oidc.<slug>`) managed through `IAuthProvider`; the browser signs in with `signInWithPopup(OAuthProvider(providerId))`. A public endpoint maps an email's domain to advertised sign-in methods without ever touching the User table. Secrets are write-only pass-through — never stored in Postgres, never returned by the API.

**Tech Stack:** NestJS + Prisma (apps/api), firebase-admin (provider configs), React + TanStack Query + firebase/auth web SDK (apps/web), Zod contracts in packages/shared.

## Global Constraints

- All UI strings Spanish, colocated in `strings.ts` next to the page (CLAUDE.md → Language). Everything else (code, comments, changelog, this plan) English.
- Design tokens only — no arbitrary `prop-[value]` Tailwind classes; existing UI components (`apps/web/src/components/ui/`).
- TDD per task; 95% per-file coverage gate (`pnpm test:coverage`); zero lint errors (`pnpm lint`); no TODO/FIXME comments.
- DB: snake_case columns, UUID PKs, soft delete via `deleted_at` for `SsoConnection`.
- Error codes come from the closed enum in `packages/shared/src/errors.ts`.
- Commit messages: conventional-commit, **subject entirely lower-case** (commitlint `subject-case` rejects capitals), trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Run commands from the repo root unless stated. API tests: `cd apps/api && pnpm exec vitest run <path>`. Web tests: `cd apps/web && pnpm exec vitest run <path>`.
- Environment precondition (manual, not code): Identity Platform "one account per email" stays ON so provider sign-ins link to invited users' accounts.

---

### Task 1: Shared contracts (Zod schemas + error code)

**Files:**
- Create: `packages/shared/src/schemas/sso.ts`
- Modify: `packages/shared/src/schemas/identity.ts` (no change needed — verify only), `packages/shared/src/index.ts` (export `./schemas/sso.js`), `packages/shared/src/errors.ts`
- Test: `packages/shared/src/schemas/__tests__/sso.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later task):
  - `SsoConnectionTypeSchema = z.enum(['oidc'])`
  - `CreateSsoConnectionSchema` → `{ tenantId: string(uuid), displayName: string 1..80, issuerUrl: string url https, clientId: string 1..255, clientSecret: string 1..512, domains: string[] 1..20 (lowercased, hostname regex), allowPassword: boolean default true }`
  - `UpdateSsoConnectionSchema` = Create minus `tenantId`, all fields optional, `clientSecret` optional
  - `SsoConnectionDto` = `{ id, tenantId, tenantName: string | null, type: 'oidc', providerId, displayName, issuerUrl, clientId, domains: string[], allowPassword: boolean, status: 'active' | 'disabled', createdAt: string }` (NO clientSecret field — it must not exist on the DTO)
  - `SsoConnectionStatusSchema = z.enum(['active', 'disabled'])`
  - `LoginMethodsRequestSchema = z.object({ email: z.string().email().max(254) })`
  - `LoginMethodsResponseDto = { methods: ('password'|'google'|'sso')[], ssoProviderId?: string, ssoDisplayName?: string }`
  - Error code `SSO_DOMAIN_ALREADY_CLAIMED` in the `ErrorCode` enum.

- [ ] **Step 1: Write failing tests**

```ts
// packages/shared/src/schemas/__tests__/sso.test.ts
import { describe, expect, it } from 'vitest'
import { CreateSsoConnectionSchema, UpdateSsoConnectionSchema, LoginMethodsRequestSchema } from '../sso.js'

describe('CreateSsoConnectionSchema', () => {
  const valid = {
    tenantId: '4b1c2f9e-0000-4000-8000-000000000001',
    displayName: 'Hospital General',
    issuerUrl: 'https://login.microsoftonline.com/x/v2.0',
    clientId: 'client-1',
    clientSecret: 'shhh',
    domains: ['hospitalgeneral.do'],
  }

  it('accepts a valid payload and defaults allowPassword to true', () => {
    const parsed = CreateSsoConnectionSchema.parse(valid)
    expect(parsed.allowPassword).toBe(true)
  })

  it('lowercases domains', () => {
    const parsed = CreateSsoConnectionSchema.parse({ ...valid, domains: ['Hospital.DO'] })
    expect(parsed.domains).toEqual(['hospital.do'])
  })

  it('rejects a non-https issuer', () => {
    expect(() => CreateSsoConnectionSchema.parse({ ...valid, issuerUrl: 'http://x.com' })).toThrow()
  })

  it('rejects an empty domains list', () => {
    expect(() => CreateSsoConnectionSchema.parse({ ...valid, domains: [] })).toThrow()
  })

  it('rejects a domain that is not a bare hostname', () => {
    expect(() => CreateSsoConnectionSchema.parse({ ...valid, domains: ['user@x.com'] })).toThrow()
  })
})

describe('UpdateSsoConnectionSchema', () => {
  it('accepts a partial payload without clientSecret', () => {
    expect(UpdateSsoConnectionSchema.parse({ displayName: 'Nuevo' })).toEqual({ displayName: 'Nuevo' })
  })
})

describe('LoginMethodsRequestSchema', () => {
  it('accepts an email and rejects a non-email', () => {
    expect(LoginMethodsRequestSchema.parse({ email: 'a@b.do' })).toEqual({ email: 'a@b.do' })
    expect(() => LoginMethodsRequestSchema.parse({ email: 'nope' })).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `cd packages/shared && pnpm exec vitest run src/schemas/__tests__/sso.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/schemas/sso.ts
import { z } from 'zod'

export const SsoConnectionTypeSchema = z.enum(['oidc'])
export const SsoConnectionStatusSchema = z.enum(['active', 'disabled'])

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/

const DomainSchema = z
  .string()
  .max(253)
  .transform((d) => d.toLowerCase())
  .pipe(z.string().regex(DOMAIN_RE, 'must be a bare domain like clinica.do'))

export const CreateSsoConnectionSchema = z.object({
  tenantId: z.string().uuid(),
  displayName: z.string().min(1).max(80),
  issuerUrl: z.string().url().startsWith('https://'),
  clientId: z.string().min(1).max(255),
  clientSecret: z.string().min(1).max(512),
  domains: z.array(DomainSchema).min(1).max(20),
  allowPassword: z.boolean().default(true),
})
export type CreateSsoConnectionDto = z.infer<typeof CreateSsoConnectionSchema>

export const UpdateSsoConnectionSchema = CreateSsoConnectionSchema.omit({ tenantId: true }).partial()
export type UpdateSsoConnectionDto = z.infer<typeof UpdateSsoConnectionSchema>

export const LoginMethodsRequestSchema = z.object({ email: z.string().email().max(254) })
export type LoginMethodsRequestDto = z.infer<typeof LoginMethodsRequestSchema>

export type LoginMethod = 'password' | 'google' | 'sso'

export interface LoginMethodsResponseDto {
  methods: LoginMethod[]
  ssoProviderId?: string
  ssoDisplayName?: string
}

export interface SsoConnectionDto {
  id: string
  tenantId: string
  tenantName: string | null
  type: z.infer<typeof SsoConnectionTypeSchema>
  providerId: string
  displayName: string
  issuerUrl: string
  clientId: string
  domains: string[]
  allowPassword: boolean
  status: z.infer<typeof SsoConnectionStatusSchema>
  createdAt: string
}

export interface SsoTestResultDto {
  ok: boolean
  checked: string[]
  failure?: string
}
```

Add to `packages/shared/src/errors.ts` inside the existing `ErrorCode` enum/const (match the file's exact style): `SSO_DOMAIN_ALREADY_CLAIMED: 'SSO_DOMAIN_ALREADY_CLAIMED'` with the same doc-comment style as its neighbors. Export the new schema file from `packages/shared/src/index.ts` following the existing `export * from './schemas/identity.js'` pattern.

- [ ] **Step 4: Run tests** — same command → PASS. Also `pnpm --filter @rezeta/shared build` → clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(shared): sso connection and login-methods contracts"` (+ trailer).

---

### Task 2: Prisma `SsoConnection` model + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append after `IdentityPolicy`)
- Create: migration via `pnpm --filter @rezeta/db exec prisma migrate dev --name sso_connection` (requires a local dev DATABASE_URL; if unavailable, use `prisma migrate diff` to author SQL under `packages/db/prisma/migrations/<ts>_sso_connection/migration.sql` following the previous migration's format)
- Test: none (schema-only; repository tests in Task 4 cover usage)

**Interfaces:**
- Produces Prisma model `SsoConnection` with client accessor `prisma.ssoConnection`.

- [ ] **Step 1: Add the model**

```prisma
/// Per-tenant enterprise SSO configuration (identity design §4, slice 6 spec
/// docs/superpowers/specs/2026-08-02-sso-connections-login-routing-design.md).
/// Maps 1:1 to a GCP Identity Platform OIDC provider config (providerId).
/// NO secret column by design: the client secret is write-only pass-through
/// to the provider config. A domain may belong to at most one ACTIVE
/// connection platform-wide — enforced in SsoConnectionService, not the DB
/// (soft deletes + status make a partial unique index awkward).
model SsoConnection {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId      String    @map("tenant_id") @db.Uuid
  type          String    @default("oidc") @db.VarChar(10)
  providerId    String    @unique @map("provider_id") @db.VarChar(120)
  displayName   String    @map("display_name") @db.VarChar(80)
  issuerUrl     String    @map("issuer_url") @db.VarChar(512)
  clientId      String    @map("client_id") @db.VarChar(255)
  domains       String[]  @map("domains")
  allowPassword Boolean   @default(true) @map("allow_password")
  status        String    @default("active") @db.VarChar(10)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@map("sso_connections")
}
```

Also add `ssoConnections SsoConnection[]` to the `Tenant` model's relation list (match neighboring relation formatting).

- [ ] **Step 2: Generate migration + client** — run the migrate command above, then `pnpm --filter @rezeta/db generate`. Verify `packages/db/prisma/migrations/` contains the new folder and `pnpm build` passes.
- [ ] **Step 3: Commit** — `git commit -m "feat(db): sso_connections table"` (+ trailer).

---

### Task 3: `IAuthProvider` OIDC provider-config methods

**Files:**
- Modify: `apps/api/src/lib/auth/auth-provider.interface.ts`, `apps/api/src/lib/auth/firebase-auth.provider.ts`
- Test: `apps/api/src/lib/auth/__tests__/firebase-auth.provider.spec.ts` (extend)

**Interfaces:**
- Produces (consumed by Task 5):

```ts
export interface OidcProviderConfigInput {
  providerId: string   // 'oidc.<slug>'
  displayName: string
  issuer: string
  clientId: string
  clientSecret?: string // omit on update to keep the existing secret
  enabled: boolean
}

// on IAuthProvider:
createOidcProviderConfig(input: Required<OidcProviderConfigInput>): Promise<void>
updateOidcProviderConfig(input: OidcProviderConfigInput): Promise<void>
deleteProviderConfig(providerId: string): Promise<void>  // idempotent: swallow not-found
```

Enable/disable is done through `updateOidcProviderConfig({ ..., enabled })` — no separate method.

- [ ] **Step 1: Write failing tests.** Follow the existing spec's mocking style for `firebase-admin` (it already mocks `admin.auth()`; extend the mock object with `createProviderConfig`, `updateProviderConfig`, `deleteProviderConfig` vi.fns):

```ts
describe('oidc provider configs', () => {
  it('createOidcProviderConfig maps input to the admin sdk shape', async () => {
    await provider.createOidcProviderConfig({
      providerId: 'oidc.hospital-x1',
      displayName: 'Hospital',
      issuer: 'https://issuer.example',
      clientId: 'cid',
      clientSecret: 'sec',
      enabled: true,
    })
    expect(mockAuth.createProviderConfig).toHaveBeenCalledWith({
      providerId: 'oidc.hospital-x1',
      displayName: 'Hospital',
      issuer: 'https://issuer.example',
      clientId: 'cid',
      clientSecret: 'sec',
      enabled: true,
      responseType: { code: true },
    })
  })

  it('updateOidcProviderConfig omits clientSecret when not provided', async () => {
    await provider.updateOidcProviderConfig({
      providerId: 'oidc.hospital-x1',
      displayName: 'Hospital',
      issuer: 'https://issuer.example',
      clientId: 'cid',
      enabled: false,
    })
    const [, patch] = mockAuth.updateProviderConfig.mock.calls[0]
    expect(patch).not.toHaveProperty('clientSecret')
    expect(patch.enabled).toBe(false)
  })

  it('deleteProviderConfig swallows configuration-not-found', async () => {
    mockAuth.deleteProviderConfig.mockRejectedValue(
      Object.assign(new Error('nf'), { code: 'auth/configuration-not-found' }),
    )
    await expect(provider.deleteProviderConfig('oidc.gone')).resolves.toBeUndefined()
  })

  it('deleteProviderConfig rethrows other errors', async () => {
    mockAuth.deleteProviderConfig.mockRejectedValue(Object.assign(new Error('boom'), { code: 'auth/internal-error' }))
    await expect(provider.deleteProviderConfig('oidc.x')).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Run to verify failure** — `cd apps/api && pnpm exec vitest run src/lib/auth/__tests__/firebase-auth.provider.spec.ts` → FAIL (methods missing).

- [ ] **Step 3: Implement** in `firebase-auth.provider.ts` (all `firebase-admin` usage stays in this file):

```ts
async createOidcProviderConfig(input: Required<OidcProviderConfigInput>): Promise<void> {
  await this.auth().createProviderConfig({
    providerId: input.providerId,
    displayName: input.displayName,
    issuer: input.issuer,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    enabled: input.enabled,
    responseType: { code: true },
  } as admin.auth.OIDCAuthProviderConfig)
}

async updateOidcProviderConfig(input: OidcProviderConfigInput): Promise<void> {
  const patch: Record<string, unknown> = {
    displayName: input.displayName,
    issuer: input.issuer,
    clientId: input.clientId,
    enabled: input.enabled,
    responseType: { code: true },
  }
  if (input.clientSecret) patch['clientSecret'] = input.clientSecret
  await this.auth().updateProviderConfig(input.providerId, patch)
}

async deleteProviderConfig(providerId: string): Promise<void> {
  try {
    await this.auth().deleteProviderConfig(providerId)
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/configuration-not-found') return
    throw err
  }
}
```

Add the three signatures + `OidcProviderConfigInput` to `auth-provider.interface.ts` with doc comments in the file's existing style, and export the type from `apps/api/src/lib/auth/index.ts`.

- [ ] **Step 4: Run tests** → PASS. Run the whole file's suite to confirm no regressions.
- [ ] **Step 5: Commit** — `git commit -m "feat(api): oidc provider config methods on iauthprovider"` (+ trailer).

---

### Task 4: `SsoConnectionRepository`

**Files:**
- Create: `apps/api/src/modules/identity/sso-connection.repository.ts`
- Test: `apps/api/src/modules/identity/__tests__/sso-connection.repository.spec.ts` (mocked PrismaService, same style as `identity.repository.spec.ts`)

**Interfaces:**
- Produces (consumed by Tasks 5 and 7):

```ts
export interface SsoConnectionRow {
  id: string; tenantId: string; type: string; providerId: string
  displayName: string; issuerUrl: string; clientId: string
  domains: string[]; allowPassword: boolean; status: string
  createdAt: Date; deletedAt: Date | null
  tenant?: { name: string | null }
}

listAll(): Promise<SsoConnectionRow[]>                     // deletedAt: null, include tenant name, newest first
findById(id: string): Promise<SsoConnectionRow | null>     // deletedAt: null
findActiveByDomain(domain: string): Promise<SsoConnectionRow | null> // status 'active', deletedAt null, domains has domain
findActiveClaimingDomains(domains: string[], excludeId?: string): Promise<SsoConnectionRow[]>
create(data: {tenantId, providerId, displayName, issuerUrl, clientId, domains, allowPassword}): Promise<SsoConnectionRow>
update(id: string, data: Partial<{displayName, issuerUrl, clientId, domains, allowPassword, status}>): Promise<SsoConnectionRow>
softDelete(id: string): Promise<void>                      // sets deletedAt
```

- [ ] **Step 1: Write failing tests.** Mirror `identity.repository.spec.ts`'s mocked-prisma harness. Concrete cases:

```ts
it('findActiveByDomain filters on active status, not-deleted, and domain membership', async () => {
  vi.mocked(prisma.ssoConnection.findFirst).mockResolvedValue(null)
  await makeRepo().findActiveByDomain('clinica.do')
  expect(prisma.ssoConnection.findFirst).toHaveBeenCalledWith({
    where: { status: 'active', deletedAt: null, domains: { has: 'clinica.do' } },
  })
})

it('findActiveClaimingDomains excludes the given id', async () => {
  vi.mocked(prisma.ssoConnection.findMany).mockResolvedValue([])
  await makeRepo().findActiveClaimingDomains(['a.do', 'b.do'], 'c1')
  expect(prisma.ssoConnection.findMany).toHaveBeenCalledWith({
    where: { status: 'active', deletedAt: null, domains: { hasSome: ['a.do', 'b.do'] }, id: { not: 'c1' } },
  })
})

it('listAll returns non-deleted connections with tenant name, newest first', async () => {
  vi.mocked(prisma.ssoConnection.findMany).mockResolvedValue([])
  await makeRepo().listAll()
  expect(prisma.ssoConnection.findMany).toHaveBeenCalledWith({
    where: { deletedAt: null },
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
})

it('softDelete stamps deletedAt', async () => {
  vi.mocked(prisma.ssoConnection.update).mockResolvedValue({} as never)
  await makeRepo().softDelete('c1')
  const [{ where, data }] = vi.mocked(prisma.ssoConnection.update).mock.calls[0]
  expect(where).toEqual({ id: 'c1' })
  expect(data.deletedAt).toBeInstanceOf(Date)
})
```

Plus straight-delegation tests for `findById` (`where: { id, deletedAt: null }`), `create`, and `update`.

- [ ] **Step 2: Run to verify failure** → FAIL (module not found).
- [ ] **Step 3: Implement** the repository as thin Prisma delegation exactly matching the asserted call shapes (constructor `@Inject(PrismaService)`, class doc comment noting the no-secret + service-enforced-uniqueness design).
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(api): sso connection repository"` (+ trailer).

---

### Task 5: `SsoConnectionService` (CRUD + test-connection)

**Files:**
- Create: `apps/api/src/modules/identity/sso-connection.service.ts`
- Test: `apps/api/src/modules/identity/__tests__/sso-connection.service.spec.ts`

**Interfaces:**
- Consumes: Task 4 repository, Task 3 provider methods, `AuditLogService`, shared DTOs from Task 1.
- Produces (consumed by Task 6 controller):

```ts
list(): Promise<SsoConnectionDto[]>
create(dto: CreateSsoConnectionDto, actorPlatformUserId: string): Promise<SsoConnectionDto>
update(id: string, dto: UpdateSsoConnectionDto, actorPlatformUserId: string): Promise<SsoConnectionDto>
setStatus(id: string, status: 'active' | 'disabled', actorPlatformUserId: string): Promise<SsoConnectionDto>
remove(id: string, actorPlatformUserId: string): Promise<void>
testConnection(id: string): Promise<SsoTestResultDto>
```

Behavior rules (each is a test):
1. `create`: reject with `ConflictException` + code `SSO_DOMAIN_ALREADY_CLAIMED` when `findActiveClaimingDomains(dto.domains)` is non-empty; generate `providerId = 'oidc.' + slugify(displayName).slice(0, 24) + '-' + 6-char base36 suffix from randomUUID()`; call `createOidcProviderConfig` (enabled: true) BEFORE `repository.create`; if the provider call throws, no row is created.
2. `update`: re-check domain uniqueness with `excludeId`; forward `clientSecret` to `updateOidcProviderConfig` only when present; provider update BEFORE row update.
3. `setStatus('disabled')`: `updateOidcProviderConfig(..., enabled: false)` then row `status: 'disabled'`; `'active'` re-checks domain uniqueness first (a disabled connection's domains may have been claimed meanwhile).
4. `remove`: `updateOidcProviderConfig(..., enabled: false)` then `softDelete` (config kept for potential restore; NOT deleted).
5. Every mutation records an audit event in the platform-users style: `actorType: 'system'`, `category: 'entity'`, `action: 'create' | 'update' | 'delete'`, `entityType: 'SsoConnection'`, `entityId`, `metadata: { platformUserId: actorPlatformUserId }`, `status: 'success'`. `setStatus` audits as `update` with `changes: { status: { before, after } }`.
6. DTO mapping never includes a secret (assert `'clientSecret' in result === false`).
7. `testConnection`: `fetch(issuerUrl.replace(/\/$/, '') + '/.well-known/openid-configuration')`; ok when HTTP 200, JSON `issuer` matches `issuerUrl` (trailing-slash-insensitive), and `authorization_endpoint` + `token_endpoint` present. `checked: ['discovery_document', 'issuer_match', 'endpoints_present']` on success; on failure `ok: false` with the first failing check and a `failure` message. Never throws — network errors become `ok: false, failure: err.message`. The client secret is explicitly NOT verified; do not claim it was.

- [ ] **Step 1: Write failing tests** — one `it` per rule above, mocked repo/provider/auditLog (clone the harness style of `identity.service.spec.ts`), plus `vi.stubGlobal('fetch', vi.fn())` for `testConnection`. Representative:

```ts
it('create rejects when a domain is already claimed by another active connection', async () => {
  mockRepo.findActiveClaimingDomains.mockResolvedValue([{ id: 'other' }])
  await expect(makeService().create(validDto, 'pu1')).rejects.toMatchObject({
    response: expect.objectContaining({ code: 'SSO_DOMAIN_ALREADY_CLAIMED' }),
  })
  expect(mockProvider.createOidcProviderConfig).not.toHaveBeenCalled()
})

it('create provisions the provider config before the row and passes the secret through', async () => {
  mockRepo.findActiveClaimingDomains.mockResolvedValue([])
  mockRepo.create.mockResolvedValue(rowFixture)
  await makeService().create(validDto, 'pu1')
  expect(mockProvider.createOidcProviderConfig).toHaveBeenCalledWith(
    expect.objectContaining({ clientSecret: validDto.clientSecret, enabled: true }),
  )
  const createdData = mockRepo.create.mock.calls[0][0]
  expect(JSON.stringify(createdData)).not.toContain(validDto.clientSecret)
})

it('testConnection fails closed on fetch error without throwing', async () => {
  mockRepo.findById.mockResolvedValue(rowFixture)
  vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))
  const result = await makeService().testConnection('c1')
  expect(result).toMatchObject({ ok: false, failure: expect.stringContaining('ECONNREFUSED') })
})
```

Follow the exact `ConflictException` + error-code response shape used elsewhere in the codebase — check how existing services throw coded errors (e.g. grep `SSO_DOMAIN` neighbors in `packages/shared/src/errors.ts` usage: `grep -rn "ALREADY" apps/api/src/modules --include="*.ts" | grep -v spec | head`) and mirror that construction.

- [ ] **Step 2: Run to verify failure** → FAIL.
- [ ] **Step 3: Implement the service** satisfying each rule; `slugify` = lowercase, non-alphanumeric → `-`, collapse repeats, trim `-`.
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(api): sso connection service with domain uniqueness and discovery test"` (+ trailer).

---

### Task 6: Staff controller + module wiring

**Files:**
- Create: `apps/api/src/modules/identity/staff-sso.controller.ts`
- Modify: `apps/api/src/modules/identity/identity.module.ts` (register controller + `SsoConnectionRepository` + `SsoConnectionService` providers), `apps/api/src/modules/identity/index.ts`
- Test: `apps/api/src/modules/identity/__tests__/staff-sso.controller.spec.ts`

**Interfaces:**
- Consumes: Task 5 service, Task 1 schemas, `@PlatformRoute()` + `@CurrentPlatformUser()`-equivalent. Check how staff controllers read the acting platform user: `grep -rn "PlatformUser\b" apps/api/src/modules/platform-users/*.controller.ts` and mirror it exactly.
- Produces: routes `GET/POST /v1/staff/identity/sso-connections`, `PATCH :id`, `PATCH :id/status`, `POST :id/test`, `DELETE :id`.

- [ ] **Step 1: Write failing controller tests** — direct-instantiation style like `staff-security.controller.spec.ts` / `identity.controller.spec.ts`: each route delegates with parsed dto + acting platform user id; body validation via `new ZodValidationPipe(CreateSsoConnectionSchema)` / `UpdateSsoConnectionSchema`; status body validated with a local `z.object({ status: SsoConnectionStatusSchema })`.
- [ ] **Step 2: Run to verify failure** → FAIL.
- [ ] **Step 3: Implement controller** (decorators mirroring `StaffSecurityController`: `@ApiTags('Staff')`, `@PlatformRoute()`, `@Controller('v1/staff/identity/sso-connections')`), wire providers/controller into `identity.module.ts`, export service from the barrel.
- [ ] **Step 4: Run the identity module suite** — `pnpm exec vitest run src/modules/identity` → all PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(api): staff sso connection endpoints"` (+ trailer).

---

### Task 7: Login-method routing (public endpoint)

**Files:**
- Create: `apps/api/src/modules/identity/login-routing.service.ts`, `apps/api/src/modules/identity/login-routing.controller.ts`
- Modify: `apps/api/src/modules/identity/identity.module.ts`
- Test: `apps/api/src/modules/identity/__tests__/login-routing.service.spec.ts`, `.../login-routing.controller.spec.ts`

**Interfaces:**
- Consumes: Task 4 `findActiveByDomain`, Task 1 `LoginMethodsRequestSchema` / `LoginMethodsResponseDto`.
- Produces: `POST /v1/auth/login-methods` (public), `LoginRoutingService.methodsForEmail(email: string): Promise<LoginMethodsResponseDto>`.

Behavior (each a test):
1. Unknown/non-SSO domain → exactly `{ methods: ['password', 'google'] }` — constant shape, and the service must never query users (only `findActiveByDomain`).
2. SSO domain, `allowPassword: false` → `{ methods: ['sso'], ssoProviderId, ssoDisplayName }`.
3. SSO domain, `allowPassword: true` → `{ methods: ['password', 'google', 'sso'], ssoProviderId, ssoDisplayName }`.
4. Domain extraction: substring after the last `@`, lowercased.
5. Disabled/soft-deleted connections never match (guaranteed by the repository query — service test just verifies delegation with the lowercased domain).

- [ ] **Step 1: Write failing service tests** covering 1–5 (mocked repository) and a controller test: `@Public()` metadata present (assert via `Reflect.getMetadata('isPublic', LoginRoutingController.prototype.loginMethods)` — mirror how `decorators.spec.ts` asserts metadata) and delegation of the parsed body.
- [ ] **Step 2: Run to verify failure** → FAIL.
- [ ] **Step 3: Implement.** Controller: `@Public()` `@Post('login-methods')` on `@Controller('v1/auth')` inside the identity module (path collision with `modules/auth`'s controller is fine — Nest merges distinct routes). `@HttpCode(HttpStatus.OK)`. Body via `new ZodValidationPipe(LoginMethodsRequestSchema)`.
- [ ] **Step 4: Run identity suite** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(api): public login-method routing endpoint"` (+ trailer).

---

### Task 8: API integration spec (real Postgres)

**Files:**
- Create: `apps/api/src/modules/identity/__tests__/sso-connection.int-spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7; harness from `src/test/db-test-utils.ts` (`hasTestDb`, `truncateAll`, `createTestTenant`, `waitForAuditLog`); fake `IAuthProvider` inline like `identity.service.int-spec.ts` does (provider-config methods as resolved vi.fns).

Cases (real DB, fake provider):
1. create → row exists with generated `oidc.` providerId, no secret anywhere in the row; audit row `action: 'create', entityType: 'SsoConnection'` via `waitForAuditLog`.
2. create with a domain already active on another tenant → rejects `SSO_DOMAIN_ALREADY_CLAIMED`, no row.
3. `methodsForEmail` end-to-end: active connection domain → sso response; after `setStatus('disabled')` → constant password+google response.
4. soft delete: row keeps existing with `deletedAt` set; `listAll` no longer returns it.

- [ ] **Step 1: Write the spec** (guarded by `describe.skipIf(!hasTestDb())`).
- [ ] **Step 2: Run it** — start a disposable DB if needed: `docker run -d --rm --name rezeta-int-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rezeta_test -p 5544:5432 postgres:16-alpine`, then `export URL='postgresql://postgres:postgres@localhost:5544/rezeta_test'; DATABASE_URL=$URL DIRECT_URL=$URL pnpm --filter @rezeta/db migrate:deploy; cd apps/api && TEST_DATABASE_URL=$URL pnpm exec vitest run --config vitest.integration.config.ts src/modules/identity/__tests__/sso-connection.int-spec.ts` → PASS. `docker stop rezeta-int-pg`.
- [ ] **Step 3: Commit** — `git commit -m "test(api): sso connection integration coverage"` (+ trailer).

---

### Task 9: Web auth client — Google + SSO popups

**Files:**
- Modify: `apps/web/src/lib/auth/auth-client.interface.ts`, `apps/web/src/lib/auth/firebase-auth-client.ts`, `apps/web/src/store/auth.store.ts`
- Test: `apps/web/src/lib/auth/__tests__/firebase-auth-client.test.ts` (extend)

**Interfaces:**
- Produces (consumed by Task 10):

```ts
// IAuthClient additions
/** Google popup sign-in. Rejects with code 'auth/multi-factor-auth-required' when TOTP is enrolled — call completeTotpSignIn next (resolver captured, same as signIn). */
signInWithGoogle(): Promise<void>
/** OIDC SSO popup sign-in for the given Identity Platform provider id ('oidc.…'). Same MFA contract as signInWithGoogle. */
signInWithSso(providerId: string): Promise<void>

// auth.store additions (mirror existing signIn wiring exactly):
signInWithGoogle: () => Promise<void>
signInWithSso: (providerId: string) => Promise<void>
```

- [ ] **Step 1: Write failing tests** (extend the vi.hoisted mock with `signInWithPopup`, `GoogleAuthProvider` (class stub), `OAuthProvider` (records constructor arg)):

```ts
it('signInWithGoogle signs in via popup with a GoogleAuthProvider', async () => {
  m.signInWithPopup.mockResolvedValue({ user: {} })
  await client.signInWithGoogle()
  expect(m.signInWithPopup).toHaveBeenCalledOnce()
})

it('signInWithGoogle captures the mfa resolver and rethrows on multi-factor-auth-required', async () => {
  const mfaError = Object.assign(new Error('mfa'), { code: 'auth/multi-factor-auth-required' })
  m.signInWithPopup.mockRejectedValue(mfaError)
  m.getMultiFactorResolver.mockReturnValue({ hints: [{ factorId: 'totp', uid: 'e1' }], resolveSignIn: vi.fn().mockResolvedValue(undefined) })
  m.assertionForSignIn.mockReturnValue('a1')
  await expect(client.signInWithGoogle()).rejects.toBe(mfaError)
  await client.completeTotpSignIn('123456')   // proves the resolver was captured
})

it('signInWithSso builds an OAuthProvider with the given provider id', async () => {
  m.signInWithPopup.mockResolvedValue({ user: {} })
  await client.signInWithSso('oidc.hospital-x1')
  expect(m.OAuthProvider).toHaveBeenCalledWith('oidc.hospital-x1')
})
```

- [ ] **Step 2: Run to verify failure** → FAIL.
- [ ] **Step 3: Implement.** In `firebase-auth-client.ts`, extract the existing MFA-capture `catch` from `signIn` into a private `captureMfaAndRethrow(err: unknown): never` and use it from `signIn`, `signInWithGoogle` (`signInWithPopup(this.auth, new GoogleAuthProvider())`), and `signInWithSso` (`signInWithPopup(this.auth, new OAuthProvider(providerId))`). Add the two store methods delegating to `authClient` exactly like `signIn` does.
- [ ] **Step 4: Run web auth tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): google and sso popup sign-in in the auth client"` (+ trailer).

---

### Task 10: Login page — Google button + SSO swap-in-place

**Files:**
- Create: `apps/web/src/hooks/identity/use-login-methods.ts`
- Modify: `apps/web/src/pages/Login/index.tsx`, `apps/web/src/pages/Login/strings.ts`
- Test: `apps/web/src/pages/Login/__tests__/index.test.tsx` (extend), `apps/web/src/hooks/identity/__tests__/use-login-methods.test.ts` (only if the hook holds logic; a bare fetch helper is covered through the page tests)

**Interfaces:**
- Consumes: Task 9 store methods, `POST /v1/auth/login-methods` (public — call with plain `fetch` against `import.meta.env['VITE_API_URL']`, NOT `apiClient`, which attaches auth headers; check how `apiClient` builds its base URL and reuse that constant).
- Produces: `fetchLoginMethods(email: string): Promise<LoginMethodsResponseDto>` in the hook file with a 3s `AbortSignal.timeout`; on ANY error resolve `{ methods: ['password', 'google'] }` (fail open).

Page behavior (each a test):
1. Google button ("Continuar con Google") renders below the password form under a divider ("o"); click → `signInWithGoogle` → navigate to `/dashboard` on success.
2. Google button → MFA error code → switches to the existing TOTP challenge state.
3. Email blur with an SSO-only domain response → password field disappears, primary button becomes `Continuar con {ssoDisplayName}`; click → `signInWithSso(ssoProviderId)` → navigate.
4. SSO domain with password allowed → password form stays AND a secondary SSO button renders.
5. Routing fetch rejects → password + Google form unchanged (fail open).
6. Changing the email back to a non-SSO domain restores the password form.

New strings (Spanish, in `Login/strings.ts`): `continueWithGoogle: 'Continuar con Google'`, `continueWithSso: (name: string) => \`Continuar con ${name}\``, `orDivider: 'o'`, `accountNotRegistered: 'Esta cuenta no está registrada. Contacta al administrador de tu institución.'`.

- [ ] **Step 1: Write failing page tests** — mock the hook module (`vi.mock('@/hooks/identity/use-login-methods')`) and the two new store/client methods in the existing mock blocks; drive email blur with `fireEvent.blur` (implementation must check on blur — no timers needed in tests).
- [ ] **Step 2: Run to verify failure** → FAIL.
- [ ] **Step 3: Implement.** State: `ssoRoute: LoginMethodsResponseDto | null`; check on email-field blur (skip while `mfaChallenge`); render per rules; both popup handlers share `handleSubmit`'s error mapping, plus: if the API later rejects the session because no User row exists (provision 401 surfaces through the existing auth store flow), show `accountNotRegistered` — wire this to whatever error the store's post-sign-in provisioning already produces (inspect `auth.store.ts`'s sign-in path and map that exact failure).
- [ ] **Step 4: Run Login tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): google sign-in and sso swap-in-place on the login screen"` (+ trailer).

---

### Task 11: Staff → Conexiones SSO page

**Files:**
- Create: `apps/web/src/pages/staff/SsoConnections.tsx`, `apps/web/src/hooks/identity/use-sso-connections.ts`
- Modify: `apps/web/src/pages/staff/strings.ts` (new `ssoStrings` export + `navSso` in `staffStrings`), `apps/web/src/components/layout/StaffLayout.tsx` (nav link), `apps/web/src/App.tsx` (route `staff/sso`)
- Test: `apps/web/src/pages/staff/__tests__/SsoConnections.test.tsx`

**Interfaces:**
- Consumes: staff endpoints from Task 6 via `apiClient`; existing UI components (`Modal`/create-panel pattern from `PlatformUsers.tsx` — read it first and mirror its structure, mutation-invalidation, and test style); institutions come from the existing staff institutions hook (find it with `grep -rn "staff/institutions" apps/web/src/hooks -l`).
- Produces: hooks `useSsoConnections()` (query), `useCreateSsoConnection()`, `useUpdateSsoConnection()`, `useSetSsoConnectionStatus()`, `useDeleteSsoConnection()`, `useTestSsoConnection()` (mutations, invalidating the list query key `['staff-sso-connections']`).

Page behavior (each a test, RTL style copied from `PlatformUsers` tests):
1. Renders the table (institution, display name, domains joined with `, `, status Badge, allow-password indicator) from the list query.
2. "Nueva conexión" opens the create modal; submit posts the form payload and closes on success.
3. Edit modal leaves the secret field empty with helper text "Dejar vacío para mantener el secreto actual" and omits `clientSecret` from the PATCH when untouched.
4. "Probar" calls the test mutation and shows a success Callout listing verified checks, or a danger Callout with the failure reason.
5. "Desactivar" goes through ConfirmDialog; confirm fires the status mutation.
6. Delete goes through ConfirmDialog (danger) and fires the delete mutation.

All strings Spanish in `ssoStrings` (page title "Conexiones SSO", buttons, field labels, confirm copy) — colocated, no hardcoded literals in the TSX.

- [ ] **Step 1: Write failing tests** for behaviors 1–6 (mock hooks module).
- [ ] **Step 2: Run to verify failure** → FAIL.
- [ ] **Step 3: Implement hooks + page + nav (`<StaffNavLink to="/staff/sso" label={staffStrings.navSso} />`) + route** (`{ path: 'staff/sso', element: <SsoConnections /> }`).
- [ ] **Step 4: Run the staff page tests + full web suite** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): staff sso connections page"` (+ trailer).

---

### Task 12: Changelog + full verification

**Files:**
- Modify: `CHANGELOG.md` (prepend entry)

- [ ] **Step 1: Prepend the changelog entry** (English; sections `### Added` for the feature set, naming: staff SSO endpoints + page, public login-methods endpoint, Google/SSO sign-in on the login screen, `SsoConnection` table, `SSO_DOMAIN_ALREADY_CLAIMED` error code).
- [ ] **Step 2: Full verification** — from repo root: `pnpm lint` (zero errors), `pnpm test` (zero failures), `pnpm test:coverage` (exit 0; move any `apps/web/.env` aside first — a local `VITE_API_URL` flips a logger branch and fails the web gate), and the integration suite against a disposable Postgres as in Task 8 Step 2.
- [ ] **Step 3: Commit** — `git commit -m "docs: changelog for sso connections and login routing slice"` (+ trailer).

---

## Self-review notes

- Spec coverage: §3 data model → Task 2; §4 staff API → Tasks 4–6; §4 public routing → Task 7; §4 IAuthProvider → Task 3; §5 login screen → Tasks 9–10; §5 staff screen → Task 11; §6 edge cases → distributed (un-invited handling Task 10.3, linking precondition = Global Constraints manual item, deactivation semantics Tasks 5/8, telemetry untouched); §7 testing → Tasks 1–11 test steps + Task 8 + Task 12.
- Deliberate scope note: the spec's "client signs out of the provider session" for un-invited users is implemented by whatever the existing provision-failure path already does plus the mapped message (Task 10 step 3 instructs inspecting `auth.store.ts` first) — do not invent a parallel sign-out path.
