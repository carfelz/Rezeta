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

export interface SeedCustomTypeInput {
  name: string
  /** Must match the `clientId` of one of the submitted templates */
  templateClientId: string
}

/** The 5 default protocol categories seeded for every new tenant, by locale. */
const SEEDED_CATEGORIES: Record<'es' | 'en', { name: string; color: string }[]> = {
  es: [
    { name: 'Emergencias', color: '#EF4444' },
    { name: 'Diagnóstico', color: '#3B82F6' },
    { name: 'Medicación', color: '#22C55E' },
    { name: 'Procedimiento', color: '#F59E0B' },
    { name: 'Rehabilitación', color: '#A855F7' },
  ],
  en: [
    { name: 'Emergencies', color: '#EF4444' },
    { name: 'Diagnosis', color: '#3B82F6' },
    { name: 'Medication', color: '#22C55E' },
    { name: 'Procedure', color: '#F59E0B' },
    { name: 'Rehabilitation', color: '#A855F7' },
  ],
}

@Injectable()
export class TenantSeedingService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * Seeds a tenant with the 5 starter templates and 5 default protocol categories.
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
      const createdTemplates = await Promise.all(
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

      void createdTemplates // template rows are not referenced further

      // Seed the 5 default protocol categories (tags applied to protocols)
      await tx.protocolCategory.createMany({
        skipDuplicates: true,
        data: SEEDED_CATEGORIES[locale].map((c) => ({
          tenantId,
          name: c.name,
          color: c.color,
          isSeeded: true,
        })),
      })

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

      // Insert templates and build clientId → server UUID map
      const clientIdToServerId = new Map<string, string>()
      for (const t of templates) {
        const created = await tx.protocolTemplate.create({
          data: {
            tenantId,
            name: t.name,
            suggestedSpecialty: t.suggestedSpecialty ?? null,
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
