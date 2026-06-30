import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import { getStarterFixtures } from '../../lib/starter-fixtures/index.js'
import { ErrorCode } from '@rezeta/shared'

export interface SeedCustomTemplateInput {
  /** Client-generated ID used only to cross-reference types in this payload */
  clientId: string
  name: string
  schema: object
}

export interface SeedCustomTypeInput {
  name: string
  /** Must match the `clientId` of one of the submitted templates */
  templateClientId: string
}

/** The 2 default protocol categories seeded for every new tenant, by locale. */
const SEEDED_CATEGORIES: Record<'es' | 'en', { name: string; color: string }[]> = {
  es: [
    { name: 'Emergencias', color: '#EF4444' },
    { name: 'Diagnóstico', color: '#3B82F6' },
  ],
  en: [
    { name: 'Emergencies', color: '#EF4444' },
    { name: 'Diagnosis', color: '#3B82F6' },
  ],
}

@Injectable()
export class TenantSeedingService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * Seeds a tenant with 2 starter templates and 2 default protocol categories.
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

      // Seed protocol categories first so templates can link to them.
      const categories = await Promise.all(
        SEEDED_CATEGORIES[locale].map((c) =>
          tx.protocolCategory.create({
            data: { tenantId, name: c.name, color: c.color, isSeeded: true },
          }),
        ),
      )
      const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

      await Promise.all(
        fixtures.map((f) => {
          const categoryId = categoryIdByName.get(f.categoryName)
          if (!categoryId) {
            throw new Error(
              `Seed fixture "${f.name}" references unknown category "${f.categoryName}"`,
            )
          }
          return tx.protocolTemplate.create({
            data: {
              tenantId,
              name: f.name,
              categoryId,
              schema: f.schema,
              isSeeded: true,
            },
          })
        }),
      )

      await tx.tenant.update({
        where: { id: tenantId },
        data: { seededAt: new Date() },
      })
    })
  }

  /**
   * Seeds a tenant with user-provided templates and types (personalizar path).
   * `types[n].templateClientId` must match the `clientId` of one of the supplied templates.
   * Throws ConflictException if the tenant has already been seeded.
   */
  async seedCustom(
    tenantId: string,
    templates: SeedCustomTemplateInput[],
    types: SeedCustomTypeInput[],
  ): Promise<void> {
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

      // Create a default category so every custom template has a valid categoryId.
      const defaultCategory = await tx.protocolCategory.create({
        data: { tenantId, name: 'Diagnóstico', color: '#3B82F6', isSeeded: true },
      })

      // Insert templates and build clientId → server UUID map
      const clientIdToServerId = new Map<string, string>()
      for (const t of templates) {
        const created = await tx.protocolTemplate.create({
          data: {
            tenantId,
            name: t.name,
            categoryId: defaultCategory.id,
            schema: t.schema,
            isSeeded: true,
          },
        })
        clientIdToServerId.set(t.clientId, created.id)
      }

      // Custom type definitions are no longer persisted: protocols are tagged
      // with optional categories, not types. The personalizar UI will move to
      // category selection in the frontend redesign.
      void types // accepted for API compatibility, intentionally unused

      await tx.tenant.update({
        where: { id: tenantId },
        data: { seededAt: new Date() },
      })
    })
  }
}
