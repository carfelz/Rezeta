import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import type { Server } from 'http'
import * as request from 'supertest'
import type * as admin from 'firebase-admin'
import { AppModule } from '../../../app.module.js'
import { FirebaseService } from '../../../lib/firebase.service.js'
import { PrismaService } from '../../../lib/prisma.service.js'

describe('ProtocolTemplatesController (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  // Create a predictable DB state
  const mockTenantId = '11111111-2222-3333-4444-555555555555'
  const mockUserId = '66666666-7777-8888-9999-000000000000'
  const mockFirebaseUid = 'e2e-firebase-uid'

  beforeAll(async () => {
    // Aggressively patch the FirebaseService to bypass nested DI module instantiation issues
    FirebaseService.prototype.verifyIdToken = () =>
      Promise.resolve({ uid: mockFirebaseUid } as unknown as admin.auth.DecodedIdToken)
    FirebaseService.prototype.onModuleInit = (): void => {}

    // Scaffold module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    prisma = app.get<PrismaService>(PrismaService)
    await app.init()

    // Setup DB context for the mock user
    await prisma.tenant.create({
      data: {
        id: mockTenantId,
        name: 'E2E Tenant',
        users: {
          create: {
            id: mockUserId,
            firebaseUid: mockFirebaseUid,
            email: 'e2e@test.rezeta.app',
            fullName: 'E2E Tester',
          },
        },
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { firebaseUid: mockFirebaseUid } })
    await prisma.tenant.deleteMany({ where: { id: mockTenantId } })
    await app.close()
  })

  it('/v1/protocol-templates (GET) - fails without token', () => {
    return request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-templates')
      .expect(401)
  })

  it('/v1/protocol-templates (GET) - retrieves system templates + filters tenant', async () => {
    const res = await request
      .default(app.getHttpServer() as Server)
      .get('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')

    console.log(res.body)
    expect(res.status).toBe(200)

    type TemplateItem = { isSystem: boolean; tenantId: string | null }
    const body = res.body as { data: TemplateItem[] }
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBeGreaterThanOrEqual(5) // At least the 5 seeded system templates
    // Validate shape matches a typical system template
    const systemTemplate = body.data.find((t) => t.isSystem)
    expect(systemTemplate).toBeDefined()
    expect(systemTemplate?.tenantId).toBeNull()
  })
})
