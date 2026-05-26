import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import { getStarterFixtures } from '../../lib/starter-fixtures/index.js'
import { ErrorCode } from '@rezeta/shared'

export interface SeedCustomTemplateInput {
  /** Client-generated ID used only to cross-reference types in this payload */
  clientId: string
  name: string
  suggestedSpecialty?: string
  schema: object
}

const DEFAULT_CATEGORY_SEEDS = [
  { name: 'Emergencias', color: '#EF4444', isSeeded: true },
  { name: 'Diagnóstico', color: '#3B82F6', isSeeded: true },
  { name: 'Medicación', color: '#22C55E', isSeeded: true },
  { name: 'Procedimiento', color: '#F59E0B', isSeeded: true },
  { name: 'Rehabilitación', color: '#A855F7', isSeeded: true },
] as const

@Injectable()
export class TenantSeedingService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * Seeds a tenant with the 5 starter templates and 5 default types.
   * Throws ConflictException if the tenant has already been seeded.
   */
  async seedDefault(tenantId: string, locale: 'es' | 'en' = 'es'): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      throw new NotFoundException({
        code: ErrorCode.TENANT_NOT_FOUND,
        message: `Tenant ${tenantId} not found`,
      })
    }

    if (tenant.seededAt !== null) {
      throw new ConflictException({
        code: ErrorCode.TENANT_ALREADY_SEEDED,
        message: 'Tenant has already been seeded',
      })
    }

    const fixtures = getStarterFixtures(locale)

    await this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to guard against concurrent requests
      const locked = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { seededAt: true },
      })
      if (locked?.seededAt !== null) {
        throw new ConflictException({
          code: ErrorCode.TENANT_ALREADY_SEEDED,
          message: 'Tenant has already been seeded',
        })
      }

      // Insert 5 templates
      await Promise.all(
        fixtures.map((f) =>
          tx.protocolTemplate.create({
            data: {
              tenantId,
              name: f.name,
              suggestedSpecialty: f.suggestedSpecialty,
              schema: f.schema,
              isSeeded: true,
            },
          }),
        ),
      )

      // Seed 5 default protocol categories
      await tx.protocolCategory.createMany({
        skipDuplicates: true,
        data: DEFAULT_CATEGORY_SEEDS.map((c) => ({ ...c, tenantId })),
      })

      await tx.tenant.update({
        where: { id: tenantId },
        data: { seededAt: new Date() },
      })
    })
  }

  /**
   * Seeds a tenant with user-provided templates (personalizar path).
   * Throws ConflictException if the tenant has already been seeded.
   */
  async seedCustom(tenantId: string, templates: SeedCustomTemplateInput[]): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      throw new NotFoundException({
        code: ErrorCode.TENANT_NOT_FOUND,
        message: `Tenant ${tenantId} not found`,
      })
    }

    if (tenant.seededAt !== null) {
      throw new ConflictException({
        code: ErrorCode.TENANT_ALREADY_SEEDED,
        message: 'Tenant has already been seeded',
      })
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { seededAt: true },
      })
      if (locked?.seededAt !== null) {
        throw new ConflictException({
          code: ErrorCode.TENANT_ALREADY_SEEDED,
          message: 'Tenant has already been seeded',
        })
      }

      // Insert templates
      for (const t of templates) {
        await tx.protocolTemplate.create({
          data: {
            tenantId,
            name: t.name,
            suggestedSpecialty: t.suggestedSpecialty ?? null,
            schema: t.schema,
            isSeeded: true,
          },
        })
      }

      // Seed 5 default protocol categories (custom path still gets the defaults)
      await tx.protocolCategory.createMany({
        skipDuplicates: true,
        data: DEFAULT_CATEGORY_SEEDS.map((c) => ({ ...c, tenantId })),
      })

      await tx.tenant.update({
        where: { id: tenantId },
        data: { seededAt: new Date() },
      })
    })
  }
}
