/**
 * Integration tests for the Auth Slice.
 *
 * Prerequisites to run:
 *   1. Postgres running (docker compose up -d)
 *   2. Firebase Auth emulator running:
 *      firebase emulators:start --only auth --project rezeta-dev
 *   3. FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 in env
 *
 * Run: pnpm --filter @rezeta/api test:integration
 *   or: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 vitest run test/auth.integration.ts
 */

import 'reflect-metadata'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { Server } from 'http'
import supertest from 'supertest'
import * as admin from 'firebase-admin'
import { AppModule } from '../src/app.module.js'
import { PrismaService } from '../src/lib/prisma.service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMULATOR_HOST = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? 'localhost:9099'
const PROJECT_ID = process.env['FIREBASE_PROJECT_ID'] ?? 'rezeta-dev'

type SignUpResponse = { localId: string; idToken: string }

/**
 * Create a real Firebase user in the emulator and return an ID token.
 */
async function createTestUser(
  email: string,
  password: string,
): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const data = (await res.json()) as SignUpResponse
  return { uid: data.localId, idToken: data.idToken }
}

async function deleteTestUser(uid: string): Promise<void> {
  await admin.auth().deleteUser(uid)
}

// ─── Response shape helpers ───────────────────────────────────────────────────

type ApiErr = { error: { code: string } }
type ApiOk<T> = { data: T }

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Auth Integration', () => {
  let app: INestApplication
  let prisma: PrismaService
  let request: ReturnType<typeof supertest>
  let userA: { uid: string; idToken: string }
  let userB: { uid: string; idToken: string }

  const USER_A_EMAIL = `test-a-${Date.now()}@example.com`
  const USER_B_EMAIL = `test-b-${Date.now()}@example.com`
  const TEST_PASSWORD = 'TestPass123!'

  beforeAll(async () => {
    // Ensure Admin SDK is connected to emulator
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: PROJECT_ID })
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = module.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    request = supertest(app.getHttpServer() as Server)

    // Create two Firebase users in emulator
    userA = await createTestUser(USER_A_EMAIL, TEST_PASSWORD)
    userB = await createTestUser(USER_B_EMAIL, TEST_PASSWORD)
  })

  afterAll(async () => {
    // Resolve tenantIds so we can delete patients first (FK constraint)
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: [userA.uid, userB.uid] } },
    })
    const tenantIds = users.map((u) => u.tenantId)

    // Delete child records before users (ON DELETE RESTRICT)
    await prisma.patient.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.user.deleteMany({ where: { firebaseUid: { in: [userA.uid, userB.uid] } } })

    // Delete Firebase users from emulator
    await Promise.all([deleteTestUser(userA.uid), deleteTestUser(userB.uid)])

    await app.close()
  })

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  it('returns 401 for unauthenticated request to protected endpoint', async () => {
    const res = await request.get('/v1/patients')
    const body = res.body as ApiErr
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  it('returns 401 for request with invalid token', async () => {
    const res = await request.get('/v1/patients').set('Authorization', 'Bearer not-a-valid-token')
    const body = res.body as ApiErr
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('TOKEN_INVALID')
  })

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  it('POST /v1/auth/provision creates tenant + user on first call', async () => {
    const res = await request
      .post('/v1/auth/provision')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const body = res.body as ApiOk<{
      email: string
      role: string
      fullName: string | null
      tenantId: string
    }>
    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({
      email: USER_A_EMAIL,
      role: 'owner',
      fullName: null,
    })
    expect(body.data.tenantId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )

    // Verify DB records
    const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userA.uid } })
    expect(dbUser).not.toBeNull()
    const dbTenant = await prisma.tenant.findUnique({ where: { id: dbUser!.tenantId } })
    expect(dbTenant).not.toBeNull()
    expect(dbTenant!.type).toBe('solo')
  })

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  it('POST /v1/auth/provision is idempotent — second call returns same user', async () => {
    const res1 = await request
      .post('/v1/auth/provision')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const res2 = await request
      .post('/v1/auth/provision')
      .set('Authorization', `Bearer ${userA.idToken}`)

    const body1 = res1.body as ApiOk<{ id: string; tenantId: string }>
    const body2 = res2.body as ApiOk<{ id: string; tenantId: string }>
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(body1.data.id).toBe(body2.data.id)
    expect(body1.data.tenantId).toBe(body2.data.tenantId)

    // Verify exactly ONE tenant and ONE user for this Firebase uid
    const users = await prisma.user.findMany({ where: { firebaseUid: userA.uid } })
    expect(users).toHaveLength(1)
  })

  // ── Test 5 ─────────────────────────────────────────────────────────────────
  it('GET /v1/auth/me returns the correct authenticated user', async () => {
    const res = await request.get('/v1/auth/me').set('Authorization', `Bearer ${userA.idToken}`)
    const body = res.body as ApiOk<{ email: string; role: string }>
    expect(res.status).toBe(200)
    expect(body.data.email).toBe(USER_A_EMAIL)
    expect(body.data.role).toBe('owner')
  })

  // ── Test 6 ─────────────────────────────────────────────────────────────────
  it('GET /v1/auth/me returns 401 for a valid token with no provisioned user', async () => {
    // userB exists in Firebase but has NOT been provisioned yet
    const res = await request.get('/v1/auth/me').set('Authorization', `Bearer ${userB.idToken}`)
    const body = res.body as ApiErr
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('USER_NOT_PROVISIONED')
  })

  // ── Test 7 ─────────────────────────────────────────────────────────────────
  it('cross-tenant isolation: userB cannot see userA patients', async () => {
    // Provision userB into a separate tenant
    await request.post('/v1/auth/provision').set('Authorization', `Bearer ${userB.idToken}`)

    // Create a patient under userA's account (direct DB insert for speed)
    const userADb = await prisma.user.findUnique({ where: { firebaseUid: userA.uid } })
    await prisma.patient.create({
      data: {
        tenantId: userADb!.tenantId,
        ownerUserId: userADb!.id,
        firstName: 'Ana',
        lastName: 'Pérez',
      },
    })

    // userB requests patients — should get empty list (their own tenant has none)
    const res = await request.get('/v1/patients').set('Authorization', `Bearer ${userB.idToken}`)
    const body = res.body as ApiOk<unknown[]>
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })
})
