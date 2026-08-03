import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'

export interface SsoConnectionRow {
  id: string
  tenantId: string
  type: string
  providerId: string
  displayName: string
  issuerUrl: string
  clientId: string
  domains: string[]
  allowPassword: boolean
  status: string
  createdAt: Date
  deletedAt: Date | null
  tenant?: { name: string | null }
}

export interface CreateSsoConnectionInput {
  tenantId: string
  providerId: string
  displayName: string
  issuerUrl: string
  clientId: string
  domains: string[]
  allowPassword: boolean
}

export type UpdateSsoConnectionInput = Partial<{
  displayName: string
  issuerUrl: string
  clientId: string
  domains: string[]
  allowPassword: boolean
  status: string
}>

/**
 * Prisma access for SsoConnection (multi-tenant OIDC/SAML config). No secret
 * column: the client secret is a write-only pass-through to the Identity
 * Platform provider config, never persisted here. Reads (`listAll`,
 * `findById`, domain lookups) are intentionally cross-tenant for the staff
 * console; writes (`update`, `softDelete`) require the caller's `tenantId`.
 * Provider ID uniqueness is DB-enforced via the `@unique` `providerId` column.
 */
@Injectable()
export class SsoConnectionRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async listAll(): Promise<SsoConnectionRow[]> {
    return this.prisma.ssoConnection.findMany({
      where: { deletedAt: null },
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string): Promise<SsoConnectionRow | null> {
    return this.prisma.ssoConnection.findFirst({
      where: { id, deletedAt: null },
    })
  }

  async findActiveByDomain(domain: string): Promise<SsoConnectionRow | null> {
    return this.prisma.ssoConnection.findFirst({
      where: { status: 'active', deletedAt: null, domains: { has: domain } },
    })
  }

  async findActiveClaimingDomains(
    domains: string[],
    excludeId?: string,
  ): Promise<SsoConnectionRow[]> {
    return this.prisma.ssoConnection.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        domains: { hasSome: domains },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
  }

  async create(data: CreateSsoConnectionInput): Promise<SsoConnectionRow> {
    return this.prisma.ssoConnection.create({
      data,
      include: { tenant: { select: { name: true } } },
    })
  }

  async update(id: string, tenantId: string, data: UpdateSsoConnectionInput): Promise<SsoConnectionRow> {
    return this.prisma.ssoConnection.update({
      where: { id, tenantId },
      data,
      include: { tenant: { select: { name: true } } },
    })
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.ssoConnection.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }
}
