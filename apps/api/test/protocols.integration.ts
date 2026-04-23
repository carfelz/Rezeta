/**
 * Integration tests for Slice 2+3 — Create & View Protocols.
 *
 * Prerequisites:
 *   1. Postgres running (docker compose up -d)
 *   2. Firebase Auth emulator running:
 *      firebase emulators:start --only auth --project rezeta-dev
 *   3. FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 in env
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

const EMULATOR_HOST = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? 'localhost:9099'
const PROJECT_ID = process.env['FIREBASE_PROJECT_ID'] ?? 'rezeta-dev'

type SignUpResponse = { localId: string; idToken: string }

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

type ApiErr = { error: { code: string; message?: string } }
type ApiOk<T> = { data: T }

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Protocols Integration (Slice 2+3)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let request: ReturnType<typeof supertest>

  // User A — fully seeded tenant (will create protocols)
  let userA: { uid: string; idToken: string }
  // User B — fully seeded tenant (for cross-tenant isolation)
  let userB: { uid: string; idToken: string }

  const USER_A_EMAIL = `proto-a-${Date.now()}@example.com`
  const USER_B_EMAIL = `proto-b-${Date.now()}@example.com`
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

    // Provision both users (creates tenant rows)
    await request.post('/v1/auth/provision').set('Authorization', `Bearer ${userA.idToken}`)
    await request.post('/v1/auth/provision').set('Authorization', `Bearer ${userB.idToken}`)

    // Seed both tenants with default starter templates + types
    await request.post('/v1/onboarding/default').set('Authorization', `Bearer ${userA.idToken}`)
    await request.post('/v1/onboarding/default').set('Authorization', `Bearer ${userB.idToken}`)
  })

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: [userA.uid, userB.uid] } },
    })
    const tenantIds = users.map((u) => u.tenantId)

    await prisma.protocolVersion.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.protocol.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.protocolType.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.protocolTemplate.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.user.deleteMany({ where: { firebaseUid: { in: [userA.uid, userB.uid] } } })
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })

    await Promise.all([deleteTestUser(userA.uid), deleteTestUser(userB.uid)])
    await app.close()
  })

  // ── List — empty initial state ─────────────────────────────────────────────

  it('GET /v1/protocols returns empty list before any protocols are created', async () => {
    const res = await request.get('/v1/protocols').set('Authorization', `Bearer ${userA.idToken}`)
    const body = res.body as ApiOk<unknown[]>
    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
  })

  // ── Create ─────────────────────────────────────────────────────────────────

  it('POST /v1/protocols creates a protocol from a seeded type', async () => {
    // Get userA's types to pick one
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string; name: string }[]>
    expect(typesRes.status).toBe(200)
    expect(typesBody.data.length).toBeGreaterThan(0)

    const type = typesBody.data[0]!
    const res = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId: type.id, title: 'Manejo de anafilaxia' })

    const body = res.body as ApiOk<{
      id: string
      title: string
      typeId: string
      typeName: string
      status: string
      currentVersion: { versionNumber: number; content: { blocks: unknown[] } } | null
    }>
    expect(res.status).toBe(201)
    expect(body.data.title).toBe('Manejo de anafilaxia')
    expect(body.data.typeId).toBe(type.id)
    expect(body.data.status).toBe('draft')
    expect(body.data.currentVersion).not.toBeNull()
    expect(body.data.currentVersion!.versionNumber).toBe(1)
    // Initial content is seeded from the template's placeholder_blocks
    expect(Array.isArray(body.data.currentVersion!.content.blocks)).toBe(true)
  })

  it('POST /v1/protocols creates from all 5 seeded types without error', async () => {
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string; name: string }[]>
    const types = typesBody.data

    for (const type of types) {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ typeId: type.id, title: `Protocolo de prueba — ${type.name}` })
      expect(res.status).toBe(201)
    }
  })

  it('POST /v1/protocols rejects missing title', async () => {
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string }[]>
    const typeId = typesBody.data[0]!.id

    const res = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId })
    expect(res.status).toBe(400)
  })

  it('POST /v1/protocols rejects title shorter than 2 chars', async () => {
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string }[]>
    const typeId = typesBody.data[0]!.id

    const res = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId, title: 'X' })
    expect(res.status).toBe(400)
  })

  it('POST /v1/protocols rejects an unknown typeId', async () => {
    const res = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId: '00000000-0000-0000-0000-000000000000', title: 'Test' })
    const body = res.body as ApiErr
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('PROTOCOL_TYPE_NOT_FOUND')
  })

  // ── Get ────────────────────────────────────────────────────────────────────

  it('GET /v1/protocols/:id returns the created protocol with template schema', async () => {
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string }[]>
    const typeId = typesBody.data[0]!.id

    const createRes = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId, title: 'Protocolo de lectura' })
    const created = (createRes.body as ApiOk<{ id: string }>).data

    const res = await request
      .get(`/v1/protocols/${created.id}`)
      .set('Authorization', `Bearer ${userA.idToken}`)

    const body = res.body as ApiOk<{
      id: string
      templateSchema: unknown
      currentVersion: { content: { blocks: unknown[] } } | null
    }>
    expect(res.status).toBe(200)
    expect(body.data.id).toBe(created.id)
    expect(body.data.templateSchema).not.toBeNull()
    expect(body.data.currentVersion).not.toBeNull()
  })

  it('GET /v1/protocols/:id returns 404 for a non-existent id', async () => {
    const res = await request
      .get('/v1/protocols/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const body = res.body as ApiErr
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('PROTOCOL_NOT_FOUND')
  })

  // ── List (after creates) ───────────────────────────────────────────────────

  it("GET /v1/protocols returns only the current tenant's protocols", async () => {
    const res = await request.get('/v1/protocols').set('Authorization', `Bearer ${userA.idToken}`)
    const body = res.body as ApiOk<
      { id: string; typeName: string; currentVersionNumber: number | null }[]
    >
    expect(res.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
    // Every item should have a typeName and version
    for (const item of body.data) {
      expect(item.typeName).toBeTruthy()
      expect(item.currentVersionNumber).toBe(1)
    }
  })

  // ── Rename ─────────────────────────────────────────────────────────────────

  it('PATCH /v1/protocols/:id renames the protocol title', async () => {
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string }[]>
    const typeId = typesBody.data[0]!.id

    const createRes = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId, title: 'Título original' })
    const { id } = (createRes.body as ApiOk<{ id: string }>).data

    const res = await request
      .patch(`/v1/protocols/${id}`)
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ title: 'Título actualizado' })

    const body = res.body as ApiOk<{ id: string; title: string }>
    expect(res.status).toBe(200)
    expect(body.data.title).toBe('Título actualizado')
  })

  // ── Save Version ───────────────────────────────────────────────────────────

  it('POST /v1/protocols/:id/versions creates a new version', async () => {
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string }[]>
    const typeId = typesBody.data[0]!.id

    const createRes = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId, title: 'Protocolo con versiones' })
    const protocol = (
      createRes.body as ApiOk<{
        id: string
        currentVersion: { content: unknown }
      }>
    ).data

    // Save a new version (same content for simplicity)
    const versionRes = await request
      .post(`/v1/protocols/${protocol.id}/versions`)
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({
        content: protocol.currentVersion.content,
        changeSummary: 'Primera edición real',
      })

    const versionBody = versionRes.body as ApiOk<{
      id: string
      versionNumber: number
      changeSummary: string | null
    }>
    expect(versionRes.status).toBe(201)
    expect(versionBody.data.versionNumber).toBe(2)
    expect(versionBody.data.changeSummary).toBe('Primera edición real')
  })

  // ── Cross-tenant isolation ─────────────────────────────────────────────────

  it("GET /v1/protocols/:id returns 404 for another tenant's protocol", async () => {
    // Create a protocol under userA
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string }[]>
    const typeId = typesBody.data[0]!.id

    const createRes = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userA.idToken}`)
      .send({ typeId, title: 'Protocolo privado de A' })
    const { id } = (createRes.body as ApiOk<{ id: string }>).data

    // userB tries to read it — should get 404 (not 403, don't confirm existence)
    const res = await request
      .get(`/v1/protocols/${id}`)
      .set('Authorization', `Bearer ${userB.idToken}`)
    const body = res.body as ApiErr
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('PROTOCOL_NOT_FOUND')
  })

  it('POST /v1/protocols rejects typeId from another tenant', async () => {
    // Get userA's typeId
    const typesRes = await request
      .get('/v1/protocol-types')
      .set('Authorization', `Bearer ${userA.idToken}`)
    const typesBody = typesRes.body as ApiOk<{ id: string }[]>
    const userATypeId = typesBody.data[0]!.id

    // userB tries to create a protocol using userA's typeId
    const res = await request
      .post('/v1/protocols')
      .set('Authorization', `Bearer ${userB.idToken}`)
      .send({ typeId: userATypeId, title: 'Intento de cross-tenant' })
    const body = res.body as ApiErr
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('PROTOCOL_TYPE_NOT_FOUND')
  })

  it('GET /v1/protocols list is isolated per tenant', async () => {
    // userB list should not contain userA's protocols
    const resA = await request.get('/v1/protocols').set('Authorization', `Bearer ${userA.idToken}`)
    const resB = await request.get('/v1/protocols').set('Authorization', `Bearer ${userB.idToken}`)

    const bodyA = (resA.body as ApiOk<{ id: string }[]>).data
    const bodyB = (resB.body as ApiOk<{ id: string }[]>).data

    const idsA = new Set(bodyA.map((p) => p.id))
    const idsB = new Set(bodyB.map((p) => p.id))

    // No overlap
    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false)
    }
  })
})
