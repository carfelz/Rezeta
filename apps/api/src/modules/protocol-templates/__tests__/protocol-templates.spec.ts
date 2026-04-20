import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../../../app.module.js'
import { FirebaseService } from '../../../lib/firebase.service.js'
import { PrismaService } from '../../../lib/prisma.service.js'
import { FirebaseAuthGuard } from '../../../common/guards/firebase-auth.guard.js'
import { APP_GUARD } from '@nestjs/core'

describe('ProtocolTemplatesController (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  // Create a predictable DB state
  const mockTenantId = '11111111-2222-3333-4444-555555555555'
  const mockUserId = '66666666-7777-8888-9999-000000000000'
  const mockFirebaseUid = 'e2e-firebase-uid'

  beforeAll(async () => {
    // Aggressively patch the FirebaseService to bypass nested DI module instantiation issues
    FirebaseService.prototype.verifyIdToken = async () => ({ uid: mockFirebaseUid } as any)
    FirebaseService.prototype.onModuleInit = () => {}

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
          }
        }
      }
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { firebaseUid: mockFirebaseUid } })
    await prisma.tenant.deleteMany({ where: { id: mockTenantId } })
    await app.close()
  })

  it('/v1/protocol-templates (GET) - fails without token', () => {
    return request.default(app.getHttpServer())
      .get('/v1/protocol-templates')
      .expect(401)
  })

  it('/v1/protocol-templates (GET) - retrieves system templates + filters tenant', async () => {
    const res = await request.default(app.getHttpServer())
      .get('/v1/protocol-templates')
      .set('Authorization', 'Bearer valid-token')

    console.log(res.body)
    expect(res.status).toBe(200)

    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.data.length).toBeGreaterThanOrEqual(5) // At least the 5 seeded system templates
    // Validate shape matches a typical system template
    const systemTemplate = res.body.data.find((t: any) => t.isSystem === true)
    expect(systemTemplate).toBeDefined()
    expect(systemTemplate.tenantId).toBeNull()
  })
})
