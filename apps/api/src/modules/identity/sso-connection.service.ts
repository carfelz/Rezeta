import { randomUUID } from 'node:crypto'
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CreateSsoConnectionDto, SsoConnectionDto, SsoTestResultDto, UpdateSsoConnectionDto } from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { AUTH_PROVIDER, type IAuthProvider } from '../../lib/auth/index.js'
import { SsoConnectionRepository, type SsoConnectionRow } from './sso-connection.repository.js'

const DISCOVERY_PATH = '/.well-known/openid-configuration'

interface DiscoveryDocument {
  issuer?: string
  authorization_endpoint?: string
  token_endpoint?: string
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** 6-char lowercase base36 suffix derived from a fresh randomUUID(). */
function randomBase36Suffix(): string {
  const hex = randomUUID().replace(/-/g, '').slice(0, 12)
  return parseInt(hex, 16).toString(36).padStart(6, '0').slice(-6)
}

function generateProviderId(displayName: string): string {
  const slug = slugify(displayName).slice(0, 24)
  return `oidc.${slug}-${randomBase36Suffix()}`
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

/**
 * SSO connection CRUD + discovery-document test for the identity module's
 * control plane. Every mutation provisions/updates the OIDC provider config
 * BEFORE touching the SsoConnection row so a failed provider call never
 * leaves an orphaned row, and audits in the platform-users style: actor is
 * always a PlatformUser (actorType 'system', metadata.platformUserId).
 * Client secrets are never persisted on the row or returned in a DTO — they
 * pass straight through to the auth provider.
 */
@Injectable()
export class SsoConnectionService {
  constructor(
    @Inject(SsoConnectionRepository) private repository: SsoConnectionRepository,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async list(): Promise<SsoConnectionDto[]> {
    const rows = await this.repository.listAll()
    return rows.map((row) => this.toDto(row))
  }

  async create(dto: CreateSsoConnectionDto, actorPlatformUserId: string): Promise<SsoConnectionDto> {
    await this.assertDomainsAvailable(dto.domains)

    const providerId = generateProviderId(dto.displayName)
    await this.authProvider.createOidcProviderConfig({
      providerId,
      displayName: dto.displayName,
      issuer: dto.issuerUrl,
      clientId: dto.clientId,
      clientSecret: dto.clientSecret,
      enabled: true,
    })

    const row = await this.repository.create({
      tenantId: dto.tenantId,
      providerId,
      displayName: dto.displayName,
      issuerUrl: dto.issuerUrl,
      clientId: dto.clientId,
      domains: dto.domains,
      allowPassword: dto.allowPassword,
    })

    void this.auditLog.record({
      actorType: 'system',
      category: 'entity',
      action: 'create',
      entityType: 'SsoConnection',
      entityId: row.id,
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })

    return this.toDto(row)
  }

  async update(
    id: string,
    dto: UpdateSsoConnectionDto,
    actorPlatformUserId: string,
  ): Promise<SsoConnectionDto> {
    const existing = await this.requireConnection(id)

    if (dto.domains) {
      await this.assertDomainsAvailable(dto.domains, id)
    }

    await this.authProvider.updateOidcProviderConfig({
      providerId: existing.providerId,
      displayName: dto.displayName ?? existing.displayName,
      issuer: dto.issuerUrl ?? existing.issuerUrl,
      clientId: dto.clientId ?? existing.clientId,
      ...(dto.clientSecret !== undefined ? { clientSecret: dto.clientSecret } : {}),
      enabled: existing.status === 'active',
    })

    const row = await this.repository.update(id, existing.tenantId, {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      ...(dto.issuerUrl !== undefined ? { issuerUrl: dto.issuerUrl } : {}),
      ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
      ...(dto.domains !== undefined ? { domains: dto.domains } : {}),
      ...(dto.allowPassword !== undefined ? { allowPassword: dto.allowPassword } : {}),
    })

    void this.auditLog.record({
      actorType: 'system',
      category: 'entity',
      action: 'update',
      entityType: 'SsoConnection',
      entityId: id,
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })

    return this.toDto(row)
  }

  async setStatus(
    id: string,
    status: 'active' | 'disabled',
    actorPlatformUserId: string,
  ): Promise<SsoConnectionDto> {
    const existing = await this.requireConnection(id)

    // A disabled connection's domains may have been claimed by another
    // connection in the meantime, so re-activating re-checks uniqueness.
    if (status === 'active') {
      await this.assertDomainsAvailable(existing.domains, id)
    }

    await this.authProvider.updateOidcProviderConfig({
      providerId: existing.providerId,
      displayName: existing.displayName,
      issuer: existing.issuerUrl,
      clientId: existing.clientId,
      enabled: status === 'active',
    })

    const row = await this.repository.update(id, existing.tenantId, { status })

    void this.auditLog.record({
      actorType: 'system',
      category: 'entity',
      action: 'update',
      entityType: 'SsoConnection',
      entityId: id,
      changes: { status: { before: existing.status, after: status } },
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })

    return this.toDto(row)
  }

  async remove(id: string, actorPlatformUserId: string): Promise<void> {
    const existing = await this.requireConnection(id)

    // Disable, don't delete, the provider config — it is kept in case the
    // connection is restored later.
    await this.authProvider.updateOidcProviderConfig({
      providerId: existing.providerId,
      displayName: existing.displayName,
      issuer: existing.issuerUrl,
      clientId: existing.clientId,
      enabled: false,
    })

    await this.repository.softDelete(id, existing.tenantId)

    void this.auditLog.record({
      actorType: 'system',
      category: 'entity',
      action: 'delete',
      entityType: 'SsoConnection',
      entityId: id,
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })
  }

  async testConnection(id: string): Promise<SsoTestResultDto> {
    const existing = await this.requireConnection(id)
    const checked: string[] = []

    try {
      const url = `${stripTrailingSlash(existing.issuerUrl)}${DISCOVERY_PATH}`
      const res = await fetch(url)
      if (res.status !== 200) {
        return { ok: false, checked, failure: `Discovery request returned HTTP ${res.status}` }
      }
      checked.push('discovery_document')

      const body = (await res.json()) as DiscoveryDocument
      if (!body.issuer || stripTrailingSlash(body.issuer) !== stripTrailingSlash(existing.issuerUrl)) {
        return {
          ok: false,
          checked,
          failure: 'Discovery document issuer does not match the configured issuer URL',
        }
      }
      checked.push('issuer_match')

      if (!body.authorization_endpoint || !body.token_endpoint) {
        return {
          ok: false,
          checked,
          failure: 'Discovery document is missing authorization_endpoint or token_endpoint',
        }
      }
      checked.push('endpoints_present')

      return { ok: true, checked }
    } catch (err) {
      return { ok: false, checked, failure: (err as Error).message }
    }
  }

  private async requireConnection(id: string): Promise<SsoConnectionRow> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'SSO connection not found' })
    }
    return existing
  }

  private async assertDomainsAvailable(domains: string[], excludeId?: string): Promise<void> {
    const conflicts = await this.repository.findActiveClaimingDomains(domains, excludeId)
    if (conflicts.length > 0) {
      throw new ConflictException({
        code: ErrorCode.SSO_DOMAIN_ALREADY_CLAIMED,
        message: 'One or more domains are already claimed by another active SSO connection',
      })
    }
  }

  private toDto(row: SsoConnectionRow): SsoConnectionDto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenant?.name ?? null,
      type: row.type as SsoConnectionDto['type'],
      providerId: row.providerId,
      displayName: row.displayName,
      issuerUrl: row.issuerUrl,
      clientId: row.clientId,
      domains: row.domains,
      allowPassword: row.allowPassword,
      status: row.status as SsoConnectionDto['status'],
      createdAt: row.createdAt.toISOString(),
    }
  }
}
