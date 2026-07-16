import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'
import { getStarterFixtures } from '../../lib/starter-fixtures/index.js'
import { ErrorCode } from '@rezeta/shared'
import { PermissionsService } from '../permissions/permissions.service.js'

type TransactionClient = Prisma.TransactionClient

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

/**
 * Serializes concurrent seeding of the same tenant.
 *
 * Postgres runs at READ COMMITTED, so a plain `findUnique` on the tenant takes no
 * lock and cannot observe a concurrent transaction's uncommitted `seededAt` write.
 * Without this, two simultaneous onboarding requests both read `seededAt === null`,
 * both proceed, and the loser collides with the (tenant_id, name) unique index.
 * `FOR UPDATE` makes the second transaction block until the first commits, after
 * which it re-reads the row and sees `seededAt` set.
 */
async function lockTenantRow(tx: TransactionClient, tenantId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`
}

/** Backstop for the row lock: a unique violation during seeding means a rival request won. */
function isUniqueViolation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

function alreadySeeded(): ConflictException {
  return new ConflictException({
    code: ErrorCode.TENANT_ALREADY_SEEDED,
    message: 'Tenant has already been seeded',
  })
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
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PermissionsService) private permissions: PermissionsService,
  ) {}

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
      throw alreadySeeded()
    }

    const fixtures = getStarterFixtures(locale)

    try {
      await this.prisma.$transaction(async (tx) => {
        await lockTenantRow(tx, tenantId)

        // Re-check under the lock: a rival request may have seeded and committed.
        const locked = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { seededAt: true },
        })
        if (locked?.seededAt !== null) {
          throw alreadySeeded()
        }

        await this.permissions.seedDefaults(tx, tenantId)

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
    } catch (err: unknown) {
      if (isUniqueViolation(err)) throw alreadySeeded()
      throw err
    }
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
      throw alreadySeeded()
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await lockTenantRow(tx, tenantId)

        const locked = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { seededAt: true },
        })
        if (locked?.seededAt !== null) {
          throw alreadySeeded()
        }

        await this.permissions.seedDefaults(tx, tenantId)

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
    } catch (err: unknown) {
      if (isUniqueViolation(err)) throw alreadySeeded()
      throw err
    }
  }
}
