import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { TestingModule } from '@nestjs/testing'

type ApiOk<T> = { data: T }
type ApiErr = { error: { code: string } }
type TypeItem = {
  id: string
  name: string
  templateId: string
  isLocked: boolean
  protocolCount: number
  isSeeded: boolean
  templateName: string
}
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { Server } from 'http'
import * as request from 'supertest'
import type * as admin from 'firebase-admin'
import { AppModule } from '../../../app.module.js'
import { FirebaseService } from '../../../lib/firebase.service.js'
import { PrismaService } from '../../../lib/prisma.service.js'

// ─── Test tenant + user ───────────────────────────────────────────────────────

const TENANT_ID = '22222222-3333-4444-5555-666666666666'
const USER_ID = '77777777-8888-9999-aaaa-bbbbbbbbbbbb'
const FIREBASE_UID = 'e2e-firebase-uid-types'

const OTHER_TENANT_ID = 'cccccccc-dddd-eeee-ffff-000000000000'

const MINIMAL_SCHEMA = { version: '1.0', blocks: [] }

describe('ProtocolTypesController (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let templateId: string
  let otherTenantTemplateId: string

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
        name: 'E2E Tenant Types',
        users: {
          create: {
            id: USER_ID,
            firebaseUid: FIREBASE_UID,
            email: 'e2e-types@test.rezeta.app',
            fullName: 'E2E Types Tester',
          },
        },
      },
    })

    await prisma.tenant.create({ data: { id: OTHER_TENANT_ID, name: 'Other Types Tenant' } })

    // Create a fixture template owned by the test tenant
    const tmpl = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Fixture Template',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })
    templateId = tmpl.id

    // Create a template owned by the other tenant
    const otherTmpl = await prisma.protocolTemplate.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        name: 'Other Tenant Template',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })
    otherTenantTemplateId = otherTmpl.id
  })

  afterEach(async () => {
    await prisma.protocol.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.protocolType.deleteMany({ where: { tenantId: TENANT_ID } })
  })

  afterAll(async () => {
    await prisma.protocol.deleteMany({ where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } } })
    await prisma.protocolType.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    })
    await prisma.protocolTemplate.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    })
    await prisma.user.deleteMany({ where: { firebaseUid: FIREBASE_UID } })
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_ID, OTHER_TENANT_ID] } } })
    await app.close()
    delete process.env['STUB_AUTH']
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('GET /v1/protocol-types — 401 without token', () => {
    return request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-types')
      .expect(401)
  })

  // ── List ────────────────────────────────────────────────────────────────────

  it('GET /v1/protocol-types — returns empty array when no types', async () => {
    const res = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-types')
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    expect((res.body as ApiOk<unknown[]>).data).toEqual([])
  })

  it('GET /v1/protocol-types — returns only tenant types (cross-tenant isolation)', async () => {
    // Create a type in the other tenant
    await prisma.protocolType.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        name: 'Other Tenant Type',
        templateId: otherTenantTemplateId,
      },
    })
    // Create a type in our tenant
    await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Our Type', templateId },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-types')
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const listBody = (res.body as ApiOk<TypeItem[]>).data
    expect(listBody).toHaveLength(1)
    expect(listBody[0]!.name).toBe('Our Type')
    expect(listBody[0]!.templateId).toBe(templateId)

    // Cleanup other tenant type
    await prisma.protocolType.deleteMany({ where: { tenantId: OTHER_TENANT_ID } })
  })

  // ── GET single ──────────────────────────────────────────────────────────────

  it('GET /v1/protocol-types/:id — returns the type', async () => {
    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Get Me', templateId },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocol-types/${type.id}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const getBody = (res.body as ApiOk<TypeItem>).data
    expect(getBody.id).toBe(type.id)
    expect(getBody.name).toBe('Get Me')
    expect(getBody.templateName).toBe('Fixture Template')
    expect(getBody.isLocked).toBe(false)
    expect(getBody.protocolCount).toBe(0)
  })

  it('GET /v1/protocol-types/:id — 404 for cross-tenant type', async () => {
    const otherType = await prisma.protocolType.create({
      data: { tenantId: OTHER_TENANT_ID, name: 'Other Type', templateId: otherTenantTemplateId },
    })

    await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocol-types/${otherType.id}`)
      .set('Authorization', 'Bearer test-token')
      .expect(404)

    await prisma.protocolType.delete({ where: { id: otherType.id } })
  })

  // ── POST ────────────────────────────────────────────────────────────────────

  it('POST /v1/protocol-types — creates a type', async () => {
    const res = await request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocol-types')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'New Type', templateId })
      .expect(201)

    const createBody = (res.body as ApiOk<TypeItem>).data
    expect(createBody.name).toBe('New Type')
    expect(createBody.templateId).toBe(templateId)
    expect(createBody.isLocked).toBe(false)
    expect(createBody.protocolCount).toBe(0)
    expect(createBody.isSeeded).toBe(false)
  })

  it('POST /v1/protocol-types — 400 for cross-tenant templateId', async () => {
    await request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocol-types')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Bad Type', templateId: otherTenantTemplateId })
      .expect(400)
  })

  it('POST /v1/protocol-types — 409 for duplicate name within tenant', async () => {
    await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Duplicate', templateId },
    })

    await request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocol-types')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Duplicate', templateId })
      .expect(409)
  })

  it('POST /v1/protocol-types — 400 for missing required fields', async () => {
    await request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocol-types')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'No Template' })
      .expect(400)
  })

  // ── PATCH ───────────────────────────────────────────────────────────────────

  it('PATCH /v1/protocol-types/:id — renames the type', async () => {
    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Old Name', templateId },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .patch(`/v1/protocol-types/${type.id}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'New Name' })
      .expect(200)

    const renameBody = (res.body as ApiOk<TypeItem>).data
    expect(renameBody.name).toBe('New Name')
    expect(renameBody.templateId).toBe(templateId)
  })

  it('PATCH /v1/protocol-types/:id — 409 if name already taken', async () => {
    await prisma.protocolType.create({ data: { tenantId: TENANT_ID, name: 'Taken', templateId } })
    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Unique', templateId },
    })

    await request
      .default(app.getHttpServer() as Server)
      .patch(`/v1/protocol-types/${type.id}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Taken' })
      .expect(409)
  })

  it('PATCH /v1/protocol-types/:id — 400 if templateId included (immutable)', async () => {
    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Immutable Test', templateId },
    })

    await request
      .default(app.getHttpServer() as Server)
      .patch(`/v1/protocol-types/${type.id}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'New Name', templateId })
      .expect(400)
  })

  it('PATCH /v1/protocol-types/:id — 404 for cross-tenant type', async () => {
    const otherType = await prisma.protocolType.create({
      data: { tenantId: OTHER_TENANT_ID, name: 'Other Rename', templateId: otherTenantTemplateId },
    })

    await request
      .default(app.getHttpServer() as Server)
      .patch(`/v1/protocol-types/${otherType.id}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Hacked' })
      .expect(404)

    await prisma.protocolType.delete({ where: { id: otherType.id } })
  })

  // ── DELETE ──────────────────────────────────────────────────────────────────

  it('DELETE /v1/protocol-types/:id — soft-deletes the type', async () => {
    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'To Delete', templateId },
    })

    await request
      .default(app.getHttpServer() as Server)
      .delete(`/v1/protocol-types/${type.id}`)
      .set('Authorization', 'Bearer test-token')
      .expect(204)

    const deleted = await prisma.protocolType.findUnique({ where: { id: type.id } })
    expect(deleted?.deletedAt).not.toBeNull()
  })

  it('DELETE /v1/protocol-types/:id — 409 when protocols reference the type (TYPE_LOCKED)', async () => {
    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Locked Type', templateId },
    })

    // Create a protocol referencing the type
    const protocol = await prisma.protocol.create({
      data: {
        tenantId: TENANT_ID,
        typeId: type.id,
        title: 'Some Protocol',
        status: 'draft',
        createdBy: USER_ID,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .delete(`/v1/protocol-types/${type.id}`)
      .set('Authorization', 'Bearer test-token')
      .expect(409)

    expect((res.body as ApiErr).error.code).toBe('TYPE_LOCKED')

    // Cleanup
    await prisma.protocol.delete({ where: { id: protocol.id } })
  })

  it('DELETE /v1/protocol-types/:id — 404 for cross-tenant type', async () => {
    const otherType = await prisma.protocolType.create({
      data: { tenantId: OTHER_TENANT_ID, name: 'Other Delete', templateId: otherTenantTemplateId },
    })

    await request
      .default(app.getHttpServer() as Server)
      .delete(`/v1/protocol-types/${otherType.id}`)
      .set('Authorization', 'Bearer test-token')
      .expect(404)

    await prisma.protocolType.delete({ where: { id: otherType.id } })
  })

  // ── Lock state ──────────────────────────────────────────────────────────────

  it('GET /v1/protocol-types — isLocked and protocolCount reflect protocols', async () => {
    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Lock Check', templateId },
    })

    await prisma.protocol.create({
      data: {
        tenantId: TENANT_ID,
        typeId: type.id,
        title: 'P1',
        status: 'draft',
        createdBy: USER_ID,
      },
    })
    await prisma.protocol.create({
      data: {
        tenantId: TENANT_ID,
        typeId: type.id,
        title: 'P2',
        status: 'draft',
        createdBy: USER_ID,
      },
    })

    const res = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-types')
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const lockBody = (res.body as ApiOk<TypeItem[]>).data
    const found = lockBody.find((t) => t.id === type.id)
    expect(found!.isLocked).toBe(true)
    expect(found!.protocolCount).toBe(2)
  })
})
