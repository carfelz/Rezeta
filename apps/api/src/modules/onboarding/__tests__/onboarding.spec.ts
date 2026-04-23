import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { Server } from 'http'
import * as request from 'supertest'
import type * as admin from 'firebase-admin'
import { AppModule } from '../../../app.module.js'
import { FirebaseService } from '../../../lib/firebase.service.js'
import { PrismaService } from '../../../lib/prisma.service.js'

// ─── Test tenant + user ───────────────────────────────────────────────────────

const TENANT_ID = 'ee000000-1111-2222-3333-444444444444'
const USER_ID = 'ee555555-6666-7777-8888-999999999999'
const FIREBASE_UID = 'e2e-firebase-uid-onboarding'

const MINIMAL_SCHEMA = {
  version: '1.0',
  blocks: [
    {
      id: 'sec_01',
      type: 'section',
      title: 'Indications',
      required: true,
      blocks: [],
    },
  ],
}

const VALID_CUSTOM_BODY = {
  templates: [
    { clientId: 'tpl-1', name: 'My Template', suggestedSpecialty: 'general', schema: MINIMAL_SCHEMA },
  ],
  types: [
    { name: 'My Type', templateClientId: 'tpl-1' },
  ],
}

describe('OnboardingController (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env['STUB_AUTH'] = 'false'

    FirebaseService.prototype.verifyIdToken = () =>
      Promise.resolve({ uid: FIREBASE_UID } as unknown as admin.auth.DecodedIdToken)
    FirebaseService.prototype.onModuleInit = (): void => {}

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    prisma = app.get<PrismaService>(PrismaService)
    await app.init()

    await prisma.tenant.create({
      data: {
        id: TENANT_ID,
        name: 'E2E Onboarding Tenant',
        users: {
          create: {
            id: USER_ID,
            firebaseUid: FIREBASE_UID,
            email: 'e2e-onboarding@test.rezeta.app',
            fullName: 'E2E Onboarding Doctor',
          },
        },
      },
    })
  })

  afterEach(async () => {
    // Reset tenant to unseeded state after each test
    await prisma.protocolType.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.protocolTemplate.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.tenant.update({
      where: { id: TENANT_ID },
      data: { seededAt: null },
    })
  })

  afterAll(async () => {
    await prisma.protocolType.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.protocolTemplate.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.tenant.deleteMany({ where: { id: TENANT_ID } })
    await app.close()
    delete process.env['STUB_AUTH']
  })

  // ─── POST /v1/onboarding/default ──────────────────────────────────────────

  describe('POST /v1/onboarding/default', () => {
    it('401 without Authorization header', async () => {
      await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/default')
        .expect(401)
    })

    it('seeds 5 templates + 5 types and returns updated AuthUser', async () => {
      const res = await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/default')
        .set('Authorization', 'Bearer fake-token')
        .expect(200)

      const user = res.body.data as Record<string, unknown>
      expect(user.tenantSeededAt).toBeTruthy()
      expect(typeof user.tenantSeededAt).toBe('string')
      expect(user.tenantId).toBe(TENANT_ID)

      // Verify rows in DB
      const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_ID } })
      const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_ID } })
      expect(templates).toHaveLength(5)
      expect(types).toHaveLength(5)
      expect(templates.every((t) => t.isSeeded)).toBe(true)
      expect(types.every((t) => t.isSeeded)).toBe(true)

      // Verify tenant seededAt was written
      const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } })
      expect(tenant?.seededAt).toBeTruthy()
    })

    it('409 if tenant is already seeded', async () => {
      // Seed once
      await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/default')
        .set('Authorization', 'Bearer fake-token')
        .expect(200)

      // Second attempt should conflict
      const res = await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/default')
        .set('Authorization', 'Bearer fake-token')
        .expect(409)

      expect(res.body.error?.code).toBe('TENANT_ALREADY_SEEDED')
    })
  })

  // ─── POST /v1/onboarding/custom ──────────────────────────────────────────

  describe('POST /v1/onboarding/custom', () => {
    it('401 without Authorization header', async () => {
      await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .send(VALID_CUSTOM_BODY)
        .expect(401)
    })

    it('seeds custom templates + types and returns updated AuthUser', async () => {
      const res = await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .set('Authorization', 'Bearer fake-token')
        .set('Content-Type', 'application/json')
        .send(VALID_CUSTOM_BODY)
        .expect(200)

      const user = res.body.data as Record<string, unknown>
      expect(user.tenantSeededAt).toBeTruthy()

      const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_ID } })
      const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_ID } })
      expect(templates).toHaveLength(1)
      expect(types).toHaveLength(1)
      expect(templates[0]!.name).toBe('My Template')
      expect(types[0]!.name).toBe('My Type')
    })

    it('400 if templates array is empty', async () => {
      await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .set('Authorization', 'Bearer fake-token')
        .set('Content-Type', 'application/json')
        .send({ templates: [], types: [{ name: 'T', templateClientId: 'x' }] })
        .expect(400)
    })

    it('400 if types array is empty', async () => {
      await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .set('Authorization', 'Bearer fake-token')
        .set('Content-Type', 'application/json')
        .send({ templates: [{ clientId: 'x', name: 'T', schema: MINIMAL_SCHEMA }], types: [] })
        .expect(400)
    })

    it('400 if type references unknown templateClientId', async () => {
      const res = await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .set('Authorization', 'Bearer fake-token')
        .set('Content-Type', 'application/json')
        .send({
          templates: [{ clientId: 'tpl-1', name: 'T', schema: MINIMAL_SCHEMA }],
          types: [{ name: 'Type A', templateClientId: 'unknown-client-id' }],
        })
        .expect(400)

      expect(res.body.error?.code).toBe('UNKNOWN_TEMPLATE_CLIENT_ID')
    })

    it('409 if tenant is already seeded', async () => {
      // Seed first
      await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .set('Authorization', 'Bearer fake-token')
        .set('Content-Type', 'application/json')
        .send(VALID_CUSTOM_BODY)
        .expect(200)

      // Second attempt should conflict
      const res = await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .set('Authorization', 'Bearer fake-token')
        .set('Content-Type', 'application/json')
        .send(VALID_CUSTOM_BODY)
        .expect(409)

      expect(res.body.error?.code).toBe('TENANT_ALREADY_SEEDED')
    })

    it('multiple templates + types are all created', async () => {
      const body = {
        templates: [
          { clientId: 'tpl-a', name: 'Template A', schema: MINIMAL_SCHEMA },
          { clientId: 'tpl-b', name: 'Template B', schema: MINIMAL_SCHEMA },
          { clientId: 'tpl-c', name: 'Template C', schema: MINIMAL_SCHEMA },
        ],
        types: [
          { name: 'Type A', templateClientId: 'tpl-a' },
          { name: 'Type B', templateClientId: 'tpl-b' },
        ],
      }

      await request.default(app.getHttpServer() as Server)
        .post('/v1/onboarding/custom')
        .set('Authorization', 'Bearer fake-token')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(200)

      const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_ID } })
      const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_ID } })
      expect(templates).toHaveLength(3)
      expect(types).toHaveLength(2)
    })
  })
})
