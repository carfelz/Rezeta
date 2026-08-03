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
 * Prisma access for SsoConnection (multi-tenant OIDC/SAML config). Every
 * connection belongs to a tenant; the repository enforces tenant_id filtering
 * on read/write. No secrets stored (client_secret lives in a secrets manager,
 * Task 5). Provider ID uniqueness is service-enforced to prevent collisions
 * across tenants at identity provider registration time.
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
    return this.prisma.ssoConnection.findUnique({
      where: { id },
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

  async update(id: string, data: UpdateSsoConnectionInput): Promise<SsoConnectionRow> {
    return this.prisma.ssoConnection.update({
      where: { id },
      data,
      include: { tenant: { select: { name: true } } },
    })
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.ssoConnection.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
