/**
 * Integration tests for the Auth Slice.
 *
 * Prerequisites to run:
 *   1. Postgres running (docker compose up -d)
 *   2. Firebase credentials in root .env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *      FIREBASE_PRIVATE_KEY, FIREBASE_WEB_API_KEY)
 *
 * Run: pnpm --filter @rezeta/api test:integration
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

const PROJECT_ID = process.env['FIREBASE_PROJECT_ID'] ?? ''
const WEB_API_KEY = process.env['FIREBASE_WEB_API_KEY'] ?? ''

type SignInResponse = { idToken: string }

async function createTestUser(
  email: string,
  password: string,
): Promise<{ uid: string; idToken: string }> {
  const user = await admin.auth().createUser({ email, password })
  const customToken = await admin.auth().createCustomToken(user.uid)

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const data = (await res.json()) as SignInResponse
  return { uid: user.uid, idToken: data.idToken }
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

    userA = await createTestUser(USER_A_EMAIL, TEST_PASSWORD)
    userB = await createTestUser(USER_B_EMAIL, TEST_PASSWORD)
  })

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: [userA.uid, userB.uid] } },
    })
    const tenantIds = users.map((u) => u.tenantId)

    await prisma.patient.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.user.deleteMany({ where: { firebaseUid: { in: [userA.uid, userB.uid] } } })
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })

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
    const res = await request.get('/v1/auth/me').set('Authorization', `Bearer ${userB.idToken}`)
    const body = res.body as ApiErr
    expect(res.status).toBe(401)
    expect(body.error.code).toBe('USER_NOT_PROVISIONED')
  })

  // ── Test 7 ─────────────────────────────────────────────────────────────────
  it('cross-tenant isolation: userB cannot see userA patients', async () => {
    await request.post('/v1/auth/provision').set('Authorization', `Bearer ${userB.idToken}`)

    const userADb = await prisma.user.findUnique({ where: { firebaseUid: userA.uid } })
    await prisma.patient.create({
      data: {
        tenantId: userADb!.tenantId,
        ownerUserId: userADb!.id,
        firstName: 'Ana',
        lastName: 'Pérez',
      },
    })

    const res = await request.get('/v1/patients').set('Authorization', `Bearer ${userB.idToken}`)
    const body = res.body as ApiOk<unknown[]>
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })
})
