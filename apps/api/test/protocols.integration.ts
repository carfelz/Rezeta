/**
 * Integration tests for the Protocols Slice (Slice 2+3).
 *
 * Prerequisites to run:
 *   1. Postgres running (docker compose up -d)
 *   2. DB seeded with system templates (pnpm db:seed)
 *   3. Firebase Auth emulator running:
 *      firebase emulators:start --only auth --project rezeta-dev
 *   4. FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 in env
 *
 * Run: pnpm --filter @rezeta/api test:integration
 *   or: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 vitest run test/protocols.integration.ts
 */

import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import * as admin from 'firebase-admin'
import { AppModule } from '../src/app.module.js'
import { PrismaService } from '../src/lib/prisma.service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMULATOR_HOST = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? 'localhost:9099'
const PROJECT_ID = process.env['FIREBASE_PROJECT_ID'] ?? 'rezeta-dev'

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
  const data = (await res.json()) as { localId: string; idToken: string }
  return { uid: data.localId, idToken: data.idToken }
}

async function deleteTestUser(uid: string) {
  await admin.auth().deleteUser(uid)
}

// Minimum valid content for a blank protocol (no template)
const BLANK_CONTENT = { version: '1.0', blocks: [] }

// Minimum valid content that satisfies pharmacological template required blocks:
// sec_dosing (required) contains blk_dose_table (required dosage_table)
const PHARMACOLOGICAL_CONTENT = {
  version: '1.0',
  blocks: [
    {
      id: 'sec_dosing',
      type: 'section',
      title: 'Dosing',
      blocks: [
        {
          id: 'blk_dose_table',
          type: 'dosage_table',
          columns: ['drug', 'dose', 'route', 'frequency', 'notes'] as const,
          rows: [{ id: 'row_01', drug: '', dose: '', route: '', frequency: '', notes: '' }],
        },
      ],
    },
  ],
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Protocols Integration', () => {
  let app: INestApplication
  let prisma: PrismaService
  let request: ReturnType<typeof supertest>
  let userA: { uid: string; idToken: string }
  let userB: { uid: string; idToken: string }
  let userATenantId: string
  let pharmacologicalTemplateId: string

  const TS = Date.now()
  const USER_A_EMAIL = `proto-a-${TS}@example.com`
  const USER_B_EMAIL = `proto-b-${TS}@example.com`
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
    request = supertest(app.getHttpServer())

    userA = await createTestUser(USER_A_EMAIL, TEST_PASSWORD)
    userB = await createTestUser(USER_B_EMAIL, TEST_PASSWORD)

    // Provision both users (creates tenant rows)
    await request.post('/v1/auth/provision').set('Authorization', `Bearer ${userA.idToken}`)
    await request.post('/v1/auth/provision').set('Authorization', `Bearer ${userB.idToken}`)

    const dbUserA = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: userA.uid } })
    userATenantId = dbUserA.tenantId

    // Resolve the pharmacological system template ID for use in tests
    const template = await prisma.protocolTemplate.findFirst({
      where: { templateKey: 'pharmacological-reference', locale: 'es' },
    })
    pharmacologicalTemplateId = template!.id
  })

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { firebaseUid: { in: [userA.uid, userB.uid] } },
    })
    const tenantIds = users.map((u) => u.tenantId)

    // Delete in dependency order
    await prisma.protocolVersion.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.protocol.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.user.deleteMany({ where: { firebaseUid: { in: [userA.uid, userB.uid] } } })
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })

    await Promise.all([deleteTestUser(userA.uid), deleteTestUser(userB.uid)])

    await app.close()
  })

  // ── GET /v1/protocols ───────────────────────────────────────────────────────

  describe('GET /v1/protocols', () => {
    it('returns 401 without auth', async () => {
      const res = await request.get('/v1/protocols')
      expect(res.status).toBe(401)
    })

    it('returns empty list when tenant has no protocols', async () => {
      const res = await request
        .get('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  // ── POST /v1/protocols ──────────────────────────────────────────────────────

  describe('POST /v1/protocols', () => {
    it('returns 401 without auth', async () => {
      const res = await request.post('/v1/protocols').send({})
      expect(res.status).toBe(401)
    })

    it('creates a blank protocol with no template', async () => {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'Mi primer protocolo' })
      expect(res.status).toBe(201)
      expect(res.body.data).toMatchObject({
        title: 'Mi primer protocolo',
        status: 'draft',
        templateId: null,
        templateName: null,
      })
      expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(res.body.data.currentVersion).not.toBeNull()
      expect(res.body.data.currentVersion.versionNumber).toBe(1)
    })

    it('creates a protocol from a system template, seeding required blocks', async () => {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ templateId: pharmacologicalTemplateId })
      expect(res.status).toBe(201)
      const protocol = res.body.data
      expect(protocol.templateId).toBe(pharmacologicalTemplateId)
      expect(protocol.templateName).not.toBeNull()

      // Version 1 content should contain the required section + dosage_table
      const blocks = protocol.currentVersion.content.blocks as Array<{ id: string; type: string }>
      const dosing = blocks.find((b) => b.id === 'sec_dosing')
      expect(dosing).toBeDefined()
      expect(dosing!.type).toBe('section')
    })

    it('defaults title when not provided (uses template name)', async () => {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ templateId: pharmacologicalTemplateId })
      expect(res.status).toBe(201)
      expect(res.body.data.title).toContain('nuevo')
    })

    it('returns 404 with PROTOCOL_TEMPLATE_NOT_FOUND for unknown templateId', async () => {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ templateId: '00000000-0000-0000-0000-000000000000' })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROTOCOL_TEMPLATE_NOT_FOUND')
    })

    it('returns 400 with VALIDATION_ERROR for a title that is too short', async () => {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'X' })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── GET /v1/protocols/:id ───────────────────────────────────────────────────

  describe('GET /v1/protocols/:id', () => {
    let protocolId: string

    beforeAll(async () => {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'Protocolo para lectura' })
      protocolId = res.body.data.id
    })

    it('returns 401 without auth', async () => {
      const res = await request.get(`/v1/protocols/${protocolId}`)
      expect(res.status).toBe(401)
    })

    it('returns the protocol for its owner', async () => {
      const res = await request
        .get(`/v1/protocols/${protocolId}`)
        .set('Authorization', `Bearer ${userA.idToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(protocolId)
      expect(res.body.data.currentVersion).not.toBeNull()
    })

    it('returns 404 (not 403) when userB reads userA protocol — cross-tenant isolation', async () => {
      const res = await request
        .get(`/v1/protocols/${protocolId}`)
        .set('Authorization', `Bearer ${userB.idToken}`)
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROTOCOL_NOT_FOUND')
    })

    it('returns 404 for non-existent protocol', async () => {
      const res = await request
        .get('/v1/protocols/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userA.idToken}`)
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROTOCOL_NOT_FOUND')
    })

    it('returns 400 for an invalid UUID path param', async () => {
      const res = await request
        .get('/v1/protocols/not-a-uuid')
        .set('Authorization', `Bearer ${userA.idToken}`)
      expect(res.status).toBe(400)
    })
  })

  // ── PATCH /v1/protocols/:id ─────────────────────────────────────────────────

  describe('PATCH /v1/protocols/:id', () => {
    let protocolId: string

    beforeAll(async () => {
      const res = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'Protocolo original' })
      protocolId = res.body.data.id
    })

    it('returns 401 without auth', async () => {
      const res = await request.patch(`/v1/protocols/${protocolId}`).send({ title: 'Nuevo' })
      expect(res.status).toBe(401)
    })

    it('renames the protocol', async () => {
      const res = await request
        .patch(`/v1/protocols/${protocolId}`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'Protocolo renombrado' })
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ id: protocolId, title: 'Protocolo renombrado' })
    })

    it('returns 400 for title too short', async () => {
      const res = await request
        .patch(`/v1/protocols/${protocolId}`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'X' })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when extra fields are sent (.strict() schema)', async () => {
      const res = await request
        .patch(`/v1/protocols/${protocolId}`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'Valid title', status: 'active' })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 (not 403) when userB renames userA protocol — cross-tenant isolation', async () => {
      const res = await request
        .patch(`/v1/protocols/${protocolId}`)
        .set('Authorization', `Bearer ${userB.idToken}`)
        .send({ title: 'Intento de userB' })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROTOCOL_NOT_FOUND')
    })

    it('returns 404 for non-existent protocol', async () => {
      const res = await request
        .patch('/v1/protocols/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'Nunca existió' })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROTOCOL_NOT_FOUND')
    })
  })

  // ── POST /v1/protocols/:id/versions ────────────────────────────────────────

  describe('POST /v1/protocols/:id/versions', () => {
    let blankProtocolId: string
    let templateProtocolId: string

    beforeAll(async () => {
      const r1 = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ title: 'Protocolo versiones' })
      blankProtocolId = r1.body.data.id

      const r2 = await request
        .post('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ templateId: pharmacologicalTemplateId })
      templateProtocolId = r2.body.data.id
    })

    it('returns 401 without auth', async () => {
      const res = await request
        .post(`/v1/protocols/${blankProtocolId}/versions`)
        .send({ content: BLANK_CONTENT })
      expect(res.status).toBe(401)
    })

    it('saves a new version and increments version number', async () => {
      const res = await request
        .post(`/v1/protocols/${blankProtocolId}/versions`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ content: BLANK_CONTENT, changeSummary: 'Primer guardado' })
      expect(res.status).toBe(201)
      expect(res.body.data.versionNumber).toBe(2)
      expect(res.body.data.changeSummary).toBe('Primer guardado')
      expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('increments further on successive saves', async () => {
      await request
        .post(`/v1/protocols/${blankProtocolId}/versions`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ content: BLANK_CONTENT })

      const res = await request
        .post(`/v1/protocols/${blankProtocolId}/versions`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ content: BLANK_CONTENT })

      expect(res.status).toBe(201)
      expect(res.body.data.versionNumber).toBe(4)
    })

    it('accepts valid content for a template protocol', async () => {
      const res = await request
        .post(`/v1/protocols/${templateProtocolId}/versions`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ content: PHARMACOLOGICAL_CONTENT })
      expect(res.status).toBe(201)
    })

    it('returns 400 PROTOCOL_REQUIRED_BLOCK_MISSING when required block is absent', async () => {
      const missingDosageContent = {
        version: '1.0',
        blocks: [
          {
            id: 'sec_dosing',
            type: 'section',
            title: 'Dosing',
            blocks: [], // dosage_table (blk_dose_table) is missing
          },
        ],
      }
      const res = await request
        .post(`/v1/protocols/${templateProtocolId}/versions`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ content: missingDosageContent })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('PROTOCOL_REQUIRED_BLOCK_MISSING')
    })

    it('returns 400 VALIDATION_ERROR for structurally invalid content', async () => {
      const res = await request
        .post(`/v1/protocols/${blankProtocolId}/versions`)
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ content: { version: '1.0', blocks: [{ type: 'unknown_type', id: 'b1' }] } })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 (not 403) when userB saves to userA protocol — cross-tenant isolation', async () => {
      const res = await request
        .post(`/v1/protocols/${blankProtocolId}/versions`)
        .set('Authorization', `Bearer ${userB.idToken}`)
        .send({ content: BLANK_CONTENT })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROTOCOL_NOT_FOUND')
    })

    it('returns 404 for non-existent protocol', async () => {
      const res = await request
        .post('/v1/protocols/00000000-0000-0000-0000-000000000000/versions')
        .set('Authorization', `Bearer ${userA.idToken}`)
        .send({ content: BLANK_CONTENT })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROTOCOL_NOT_FOUND')
    })
  })

  // ── GET /v1/protocols list reflects new items ───────────────────────────────

  describe('GET /v1/protocols list after creates', () => {
    it('lists only protocols belonging to the authenticated tenant', async () => {
      // Both users now have protocols from previous suites
      const resA = await request
        .get('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
      const resB = await request
        .get('/v1/protocols')
        .set('Authorization', `Bearer ${userB.idToken}`)

      expect(resA.status).toBe(200)
      expect(resB.status).toBe(200)

      const idsA = resA.body.data.map((p: { id: string }) => p.id)
      const idsB = resB.body.data.map((p: { id: string }) => p.id)

      // No overlap between tenants
      const intersection = idsA.filter((id: string) => idsB.includes(id))
      expect(intersection).toHaveLength(0)

      // userA has protocols; userB has none (they never created any)
      expect(idsA.length).toBeGreaterThan(0)
      expect(idsB.length).toBe(0)
    })

    it('each list item has the expected shape', async () => {
      const res = await request
        .get('/v1/protocols')
        .set('Authorization', `Bearer ${userA.idToken}`)
      const item = res.body.data[0]
      expect(item).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        title: expect.any(String),
        status: expect.any(String),
        isFavorite: expect.any(Boolean),
        updatedAt: expect.any(String),
      })
      expect(typeof item.currentVersionNumber).toBe('number')
    })
  })
})
