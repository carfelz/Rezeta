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

const TENANT_ID = '11111111-2222-3333-4444-555555555555'
const USER_ID = '66666666-7777-8888-9999-000000000000'
const FIREBASE_UID = 'e2e-firebase-uid-templates'

const OTHER_TENANT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// Minimal valid template schema
const MINIMAL_SCHEMA = { version: '1.0', blocks: [] }

describe('ProtocolTemplatesController (e2e)', () => {
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

    // Create test tenant + user + an isolated other tenant (for cross-tenant tests)
    await prisma.tenant.create({
      data: {
        id: TENANT_ID,
        name: 'E2E Tenant',
        users: {
          create: {
            id: USER_ID,
            firebaseUid: FIREBASE_UID,
            email: 'e2e@test.rezeta.app',
            fullName: 'E2E Tester',
          },
        },
      },
    })
    await prisma.tenant.create({
      data: { id: OTHER_TENANT_ID, name: 'Other E2E Tenant' },
    })
    // Seed an "other tenant" template that must never appear in this tenant's responses
    await prisma.protocolTemplate.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        name: 'Other Tenant Template',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })
  })

  afterEach(async () => {
    // Remove only templates created during tests (non-fixture), including any types
    const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_ID } })
    if (types.length > 0) {
      await prisma.protocolType.deleteMany({ where: { tenantId: TENANT_ID } })
    }
    await prisma.protocolTemplate.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.tenant.update({ where: { id: TENANT_ID }, data: { seededAt: null } })
  })

  afterAll(async () => {
    await prisma.protocolTemplate.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    })
    await prisma.user.deleteMany({ where: { firebaseUid: FIREBASE_UID } })
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_ID, OTHER_TENANT_ID] } } })
    await app.close()
    delete process.env['STUB_AUTH']
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('GET /v1/protocol-templates — 401 without token', () => {
    return request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-templates')
      .expect(401)
  })

  // ── GET list ────────────────────────────────────────────────────────────────

  it('GET /v1/protocol-templates — returns empty list', async () => {
    const res = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    const { data } = res.body as { data: unknown[] }
    expect(data).toBeInstanceOf(Array)
    expect(data).toHaveLength(0)
  })

  it('GET /v1/protocol-templates — returns only this tenant\'s templates', async () => {
    await prisma.protocolTemplate.createMany({
      data: [
        {
          tenantId: TENANT_ID,
          name: 'Template A',
          schema: MINIMAL_SCHEMA,
          isSeeded: true,
          createdBy: USER_ID,
        },
        {
          tenantId: TENANT_ID,
          name: 'Template B',
          schema: MINIMAL_SCHEMA,
          isSeeded: false,
          createdBy: USER_ID,
        },
      ],
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    type TemplateItem = { tenantId: string; isLocked: boolean; blockingTypeIds: string[] }
    const { data } = res.body as { data: TemplateItem[] }
    expect(data).toHaveLength(2)
    expect(data.every((t) => t.tenantId === TENANT_ID)).toBe(true)
    expect(data.every((t) => t.isLocked === false)).toBe(true)
    expect(data.every((t) => Array.isArray(t.blockingTypeIds))).toBe(true)
  })

  // ── GET single ──────────────────────────────────────────────────────────────

  it('GET /v1/protocol-templates/:id — returns template with lock info', async () => {
    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Fetch Me',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocol-templates/${template.id}`)
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    type TemplateItem = { id: string; name: string; isLocked: boolean }
    const { data } = res.body as { data: TemplateItem }
    expect(data.id).toBe(template.id)
    expect(data.name).toBe('Fetch Me')
    expect(data.isLocked).toBe(false)
  })

  it('GET /v1/protocol-templates/:id — 404 for cross-tenant template', async () => {
    const other = await prisma.protocolTemplate.findFirst({
      where: { tenantId: OTHER_TENANT_ID },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocol-templates/${other!.id}`)
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(404)
  })

  // ── POST ────────────────────────────────────────────────────────────────────

  it('POST /v1/protocol-templates — creates a template', async () => {
    const res = await request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'New Template', schema: MINIMAL_SCHEMA })

    expect(res.status).toBe(201)
    type TemplateItem = { id: string; name: string; tenantId: string; isLocked: boolean }
    const { data } = res.body as { data: TemplateItem }
    expect(data.name).toBe('New Template')
    expect(data.tenantId).toBe(TENANT_ID)
    expect(data.isLocked).toBe(false)

    // Verify it was persisted
    const row = await prisma.protocolTemplate.findUnique({ where: { id: data.id } })
    expect(row).not.toBeNull()
    expect(row!.tenantId).toBe(TENANT_ID)
  })

  it('POST /v1/protocol-templates — 400 on invalid schema', async () => {
    const res = await request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Bad', schema: { version: '1.0', blocks: 'not-an-array' } })

    expect(res.status).toBe(400)
  })

  // ── PATCH ───────────────────────────────────────────────────────────────────

  it('PATCH /v1/protocol-templates/:id — renames template', async () => {
    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Old Name',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .patch(`/v1/protocol-templates/${template.id}`)
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    type TemplateItem = { name: string }
    const { data } = res.body as { data: TemplateItem }
    expect(data.name).toBe('New Name')
  })

  it('PATCH /v1/protocol-templates/:id — 409 TEMPLATE_LOCKED when type references it', async () => {
    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Locked Template',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })
    await prisma.protocolType.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Locking Type',
        templateId: template.id,
        isSeeded: false,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .patch(`/v1/protocol-templates/${template.id}`)
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'New Name' })

    expect(res.status).toBe(409)
    type ErrorBody = { error: { code: string; blockingTypeIds: string[] } }
    const body = res.body as ErrorBody
    expect(body.error.code).toBe('TEMPLATE_LOCKED')
    expect(body.error.blockingTypeIds).toBeInstanceOf(Array)
    expect(body.error.blockingTypeIds.length).toBeGreaterThan(0)
  })

  it('PATCH /v1/protocol-templates/:id — 404 for cross-tenant template', async () => {
    const other = await prisma.protocolTemplate.findFirst({
      where: { tenantId: OTHER_TENANT_ID },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .patch(`/v1/protocol-templates/${other!.id}`)
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Stolen' })

    expect(res.status).toBe(404)
  })

  // ── DELETE ──────────────────────────────────────────────────────────────────

  it('DELETE /v1/protocol-templates/:id — soft-deletes template', async () => {
    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Delete Me',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .delete(`/v1/protocol-templates/${template.id}`)
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(204)

    // Should not appear in list
    const row = await prisma.protocolTemplate.findUnique({ where: { id: template.id } })
    expect(row?.deletedAt).not.toBeNull()

    const listRes = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')
    const { data } = listRes.body as { data: { id: string }[] }
    expect(data.find((t) => t.id === template.id)).toBeUndefined()
  })

  it('DELETE /v1/protocol-templates/:id — 409 TEMPLATE_LOCKED when type references it', async () => {
    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Locked Delete',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })
    await prisma.protocolType.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Locking Type 2',
        templateId: template.id,
        isSeeded: false,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .delete(`/v1/protocol-templates/${template.id}`)
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(409)
    type ErrorBody = { error: { code: string } }
    const body = res.body as ErrorBody
    expect(body.error.code).toBe('TEMPLATE_LOCKED')
  })

  it('DELETE /v1/protocol-templates/:id — 404 for cross-tenant template', async () => {
    const other = await prisma.protocolTemplate.findFirst({
      where: { tenantId: OTHER_TENANT_ID },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .delete(`/v1/protocol-templates/${other!.id}`)
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(404)
  })

  // ── isLocked flag in list response ──────────────────────────────────────────

  it('GET /v1/protocol-templates — isLocked=true when a type references template', async () => {
    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Will Be Locked',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })
    await prisma.protocolType.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Locking Type 3',
        templateId: template.id,
        isSeeded: false,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    type TemplateItem = { id: string; isLocked: boolean; blockingTypeIds: string[] }
    const { data } = res.body as { data: TemplateItem[] }
    const locked = data.find((t) => t.id === template.id)
    expect(locked).toBeDefined()
    expect(locked!.isLocked).toBe(true)
    expect(locked!.blockingTypeIds).toHaveLength(1)
  })
})
