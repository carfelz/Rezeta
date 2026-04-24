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

// ─── Test identifiers ─────────────────────────────────────────────────────────

const TENANT_ID = 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5'
const USER_ID = 'f6f6f6f6-0707-1818-2929-3a3a3a3a3a3a'
const FIREBASE_UID = 'e2e-firebase-uid-protocols'

const MINIMAL_SCHEMA = { version: '1.0', blocks: [] }
const MINIMAL_CONTENT = { version: '1.0', template_version: '1.0', blocks: [] }

type ApiOk<T> = { data: T }
type SaveVersionBody = {
  id: string
  versionNumber: number
  changeSummary: string | null
  createdAt: string
}
type ProtocolBody = {
  id: string
  title: string
  status: string
  typeId: string
  currentVersion: { versionNumber: number } | null
}
type VersionListItem = {
  id: string
  versionNumber: number
  changeSummary: string | null
  createdAt: string
}

describe('ProtocolsController (e2e) — saveVersion publish flow', () => {
  let app: INestApplication
  let prisma: PrismaService
  let typeId: string

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
        name: 'E2E Tenant Protocols',
        users: {
          create: {
            id: USER_ID,
            firebaseUid: FIREBASE_UID,
            email: 'e2e-protocols@test.rezeta.app',
            fullName: 'E2E Protocols Tester',
          },
        },
      },
    })

    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Test Template',
        schema: MINIMAL_SCHEMA,
        isSeeded: false,
        createdBy: USER_ID,
      },
    })

    const type = await prisma.protocolType.create({
      data: { tenantId: TENANT_ID, name: 'Test Type', templateId: template.id },
    })
    typeId = type.id
  })

  afterEach(async () => {
    await prisma.protocolVersion.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.protocol.deleteMany({ where: { tenantId: TENANT_ID } })
  })

  afterAll(async () => {
    await prisma.protocolVersion.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.protocol.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.protocolType.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.protocolTemplate.deleteMany({ where: { tenantId: TENANT_ID } })
    await prisma.user.deleteMany({ where: { firebaseUid: FIREBASE_UID } })
    await prisma.tenant.deleteMany({ where: { id: TENANT_ID } })
    await app.close()
    delete process.env['STUB_AUTH']
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function createProtocol(title: string): Promise<string> {
    const res = await request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocols')
      .set('Authorization', 'Bearer test-token')
      .send({ typeId, title })
      .expect(201)
    return (res.body as ApiOk<ProtocolBody>).data.id
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('POST /v1/protocols/:id/versions — 401 without token', async () => {
    const protocolId = await createProtocol('Auth test protocol')
    return request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .send({ content: MINIMAL_CONTENT, publish: false })
      .expect(401)
  })

  // ── publish: false (or omitted) keeps status as draft ────────────────────────

  it('POST /v1/protocols/:id/versions with publish:false keeps status as draft', async () => {
    const protocolId = await createProtocol('Draft protocol')

    const res = await request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT, publish: false })
      .expect(201)

    const body = (res.body as ApiOk<SaveVersionBody>).data
    expect(body.versionNumber).toBe(2)

    const protocolRes = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocols/${protocolId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    expect((protocolRes.body as ApiOk<ProtocolBody>).data.status).toBe('draft')
  })

  it('POST /v1/protocols/:id/versions without publish field defaults to draft', async () => {
    const protocolId = await createProtocol('No-publish-field protocol')

    await request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT })
      .expect(201)

    const protocolRes = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocols/${protocolId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    expect((protocolRes.body as ApiOk<ProtocolBody>).data.status).toBe('draft')
  })

  // ── publish: true transitions status to active ───────────────────────────────

  it('POST /v1/protocols/:id/versions with publish:true transitions status to active', async () => {
    const protocolId = await createProtocol('Active protocol')

    const res = await request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT, publish: true })
      .expect(201)

    const body = (res.body as ApiOk<SaveVersionBody>).data
    expect(body.versionNumber).toBe(2)

    const protocolRes = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocols/${protocolId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    expect((protocolRes.body as ApiOk<ProtocolBody>).data.status).toBe('active')
  })

  it('POST /v1/protocols/:id/versions with publish:true bumps version and sets active in one call', async () => {
    const protocolId = await createProtocol('Publish in one shot')

    // Save a draft first
    await request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT, changeSummary: 'Initial draft', publish: false })
      .expect(201)

    // Then publish
    const publishRes = await request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT, changeSummary: 'Publishing', publish: true })
      .expect(201)

    expect((publishRes.body as ApiOk<SaveVersionBody>).data.versionNumber).toBe(3)

    const protocolRes = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocols/${protocolId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const protocol = (protocolRes.body as ApiOk<ProtocolBody>).data
    expect(protocol.status).toBe('active')
    expect(protocol.currentVersion?.versionNumber).toBe(3)
  })

  it('POST /v1/protocols/:id/versions — 400 for invalid content', async () => {
    const protocolId = await createProtocol('Invalid content protocol')

    return request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: { version: '1.0' }, publish: false })
      .expect(400)
  })

  it('POST /v1/protocols/:id/versions — 404 for unknown protocol', () => {
    return request
      .default(app.getHttpServer() as Server)
      .post('/v1/protocols/00000000-0000-0000-0000-000000000000/versions')
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT, publish: false })
      .expect(404)
  })

  // ── GET versions list ────────────────────────────────────────────────────────

  it('GET /v1/protocols/:id/versions returns version history', async () => {
    const protocolId = await createProtocol('Versioned protocol')

    await request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT, changeSummary: 'First edit', publish: false })
      .expect(201)

    await request
      .default(app.getHttpServer() as Server)
      .post(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .send({ content: MINIMAL_CONTENT, changeSummary: 'Second edit', publish: true })
      .expect(201)

    const res = await request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocols/${protocolId}/versions`)
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const versions = (res.body as ApiOk<VersionListItem[]>).data
    expect(versions.length).toBe(3)
    expect(versions[0].versionNumber).toBe(3)
    expect(versions[1].versionNumber).toBe(2)
    expect(versions[2].versionNumber).toBe(1)
  })

  it('GET /v1/protocols/:id/versions — 401 without token', async () => {
    const protocolId = await createProtocol('Auth versions test')
    return request
      .default(app.getHttpServer() as Server)
      .get(`/v1/protocols/${protocolId}/versions`)
      .expect(401)
  })
})
