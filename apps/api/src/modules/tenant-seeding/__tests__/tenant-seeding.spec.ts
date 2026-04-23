import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { AppModule } from '../../../app.module.js'
import { PrismaService } from '../../../lib/prisma.service.js'
import { TenantSeedingService } from '../tenant-seeding.service.js'
import { FirebaseService } from '../../../lib/firebase.service.js'

// ─── Test tenant UUIDs (deterministic, non-colliding) ────────────────────────

const TENANT_A_ID = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
const TENANT_B_ID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'

describe('TenantSeedingService', () => {
  let app: INestApplication
  let prisma: PrismaService
  let seeder: TenantSeedingService

  beforeAll(async () => {
    process.env['STUB_AUTH'] = 'false'
    FirebaseService.prototype.onModuleInit = (): void => {}

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    prisma = app.get<PrismaService>(PrismaService)
    seeder = app.get<TenantSeedingService>(TenantSeedingService)
    await app.init()

    // Create two bare tenants for isolation testing
    await prisma.tenant.createMany({
      data: [
        { id: TENANT_A_ID, name: 'Test Tenant A', type: 'solo', plan: 'free' },
        { id: TENANT_B_ID, name: 'Test Tenant B', type: 'solo', plan: 'free' },
      ],
    })
  })

  afterEach(async () => {
    // Clean seeded rows after each test so tenants start fresh
    await prisma.protocolType.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } })
    await prisma.protocolTemplate.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } })
    await prisma.tenant.updateMany({
      where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
      data: { seededAt: null },
    })
  })

  afterAll(async () => {
    await prisma.protocolType.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } })
    await prisma.protocolTemplate.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } })
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } } })
    await app.close()
    delete process.env['STUB_AUTH']
  })

  // ─── seedDefault ───────────────────────────────────────────────────────────

  it('seedDefault: creates exactly 5 templates and 5 types', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'es')

    const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_A_ID } })
    const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_A_ID } })

    expect(templates).toHaveLength(5)
    expect(types).toHaveLength(5)
  })

  it('seedDefault: all rows carry isSeeded=true', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'es')

    const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_A_ID } })
    const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_A_ID } })

    expect(templates.every((t) => t.isSeeded)).toBe(true)
    expect(types.every((t) => t.isSeeded)).toBe(true)
  })

  it('seedDefault: each type references a template in the same tenant', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'es')

    const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_A_ID } })
    const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_A_ID } })
    const templateIds = new Set(templates.map((t) => t.id))

    for (const type of types) {
      expect(templateIds.has(type.templateId)).toBe(true)
    }
  })

  it('seedDefault: sets tenant.seededAt', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'es')

    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_A_ID } })
    expect(tenant?.seededAt).not.toBeNull()
  })

  it('seedDefault: Spanish locale produces Spanish template names', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'es')

    const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_A_ID } })
    const names = templates.map((t) => t.name)

    expect(names).toContain('Intervención de emergencia')
    expect(names).toContain('Procedimiento clínico')
    expect(names).toContain('Referencia farmacológica')
    expect(names).toContain('Algoritmo diagnóstico')
    expect(names).toContain('Sesión de fisioterapia')
  })

  it('seedDefault: English locale produces English template names', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'en')

    const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_A_ID } })
    const names = templates.map((t) => t.name)

    expect(names).toContain('Emergency Intervention')
    expect(names).toContain('Clinical Procedure')
  })

  it('seedDefault: second call throws TENANT_ALREADY_SEEDED', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'es')

    await expect(seeder.seedDefault(TENANT_A_ID, 'es')).rejects.toMatchObject({
      response: { code: 'TENANT_ALREADY_SEEDED' },
    })
  })

  it('seedDefault: cross-tenant isolation — tenant B unaffected', async () => {
    await seeder.seedDefault(TENANT_A_ID, 'es')

    const bTemplates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_B_ID } })
    const bTenant = await prisma.tenant.findUnique({ where: { id: TENANT_B_ID } })

    expect(bTemplates).toHaveLength(0)
    expect(bTenant?.seededAt).toBeNull()
  })

  // ─── seedCustom ────────────────────────────────────────────────────────────

  it('seedCustom: creates exactly the supplied templates and types', async () => {
    await seeder.seedCustom(
      TENANT_A_ID,
      [
        { clientId: 'c1', name: 'Custom Template 1', schema: { version: '1.0', blocks: [] } },
        { clientId: 'c2', name: 'Custom Template 2', schema: { version: '1.0', blocks: [] } },
      ],
      [
        { name: 'Type Alpha', templateClientId: 'c1' },
        { name: 'Type Beta', templateClientId: 'c2' },
        { name: 'Type Gamma', templateClientId: 'c1' },
      ],
    )

    const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_A_ID } })
    const types = await prisma.protocolType.findMany({ where: { tenantId: TENANT_A_ID } })

    expect(templates).toHaveLength(2)
    expect(types).toHaveLength(3)
  })

  it('seedCustom: types correctly reference their templates', async () => {
    await seeder.seedCustom(
      TENANT_A_ID,
      [{ clientId: 'tmpl-1', name: 'My Template', schema: { version: '1.0', blocks: [] } }],
      [{ name: 'My Type', templateClientId: 'tmpl-1' }],
    )

    const template = await prisma.protocolTemplate.findFirst({ where: { tenantId: TENANT_A_ID } })
    const type = await prisma.protocolType.findFirst({ where: { tenantId: TENANT_A_ID } })

    expect(type?.templateId).toBe(template?.id)
  })

  it('seedCustom: sets seededAt and marks rows isSeeded', async () => {
    await seeder.seedCustom(
      TENANT_A_ID,
      [{ clientId: 'x', name: 'T', schema: { version: '1.0', blocks: [] } }],
      [{ name: 'Ty', templateClientId: 'x' }],
    )

    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_A_ID } })
    const template = await prisma.protocolTemplate.findFirst({ where: { tenantId: TENANT_A_ID } })
    const type = await prisma.protocolType.findFirst({ where: { tenantId: TENANT_A_ID } })

    expect(tenant?.seededAt).not.toBeNull()
    expect(template?.isSeeded).toBe(true)
    expect(type?.isSeeded).toBe(true)
  })

  it('seedCustom: second call throws TENANT_ALREADY_SEEDED', async () => {
    await seeder.seedCustom(
      TENANT_A_ID,
      [{ clientId: 'x', name: 'T', schema: { version: '1.0', blocks: [] } }],
      [{ name: 'Ty', templateClientId: 'x' }],
    )

    await expect(
      seeder.seedCustom(
        TENANT_A_ID,
        [{ clientId: 'y', name: 'T2', schema: { version: '1.0', blocks: [] } }],
        [{ name: 'Ty2', templateClientId: 'y' }],
      ),
    ).rejects.toMatchObject({ response: { code: 'TENANT_ALREADY_SEEDED' } })
  })

  it('seedCustom: unknown templateClientId throws before committing', async () => {
    await expect(
      seeder.seedCustom(
        TENANT_A_ID,
        [{ clientId: 'real', name: 'T', schema: { version: '1.0', blocks: [] } }],
        [{ name: 'Broken Type', templateClientId: 'nonexistent' }],
      ),
    ).rejects.toThrow()

    // Transaction rolled back — tenant still unseeded, no rows created
    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_A_ID } })
    const templates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_A_ID } })
    expect(tenant?.seededAt).toBeNull()
    expect(templates).toHaveLength(0)
  })

  it('seedCustom: cross-tenant isolation — tenant B unaffected', async () => {
    await seeder.seedCustom(
      TENANT_A_ID,
      [{ clientId: 'x', name: 'T', schema: { version: '1.0', blocks: [] } }],
      [{ name: 'Ty', templateClientId: 'x' }],
    )

    const bTemplates = await prisma.protocolTemplate.findMany({ where: { tenantId: TENANT_B_ID } })
    const bTenant = await prisma.tenant.findUnique({ where: { id: TENANT_B_ID } })

    expect(bTemplates).toHaveLength(0)
    expect(bTenant?.seededAt).toBeNull()
  })
})
