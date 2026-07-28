import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { CreatePlatformUserDto, PlatformUserApiDto, SetActiveDto } from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import type { PlatformUser } from '@rezeta/db'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { AUTH_PROVIDER, type IAuthProvider } from '../../lib/auth/index.js'
import { InvitationMailerService } from '../users/invitation-mailer.service.js'
import { PlatformUsersRepository } from './platform-users.repository.js'

/**
 * Control-plane staff roster (`/v1/staff/identity/users`). The actor is always
 * a PlatformUser, so audits use actorType 'system' with the acting staff id in
 * metadata.platformUserId (same convention as StaffService.createInstitution).
 * Audits are tenantless — AuditLog.tenantId is nullable and platform users
 * have no tenant.
 */
@Injectable()
export class PlatformUsersService {
  private readonly logger = new Logger(PlatformUsersService.name)

  constructor(
    @Inject(PlatformUsersRepository) private repository: PlatformUsersRepository,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(InvitationMailerService) private mailer: InvitationMailerService,
  ) {}

  async listUsers(): Promise<PlatformUserApiDto[]> {
    const rows = await this.repository.list()
    return rows.map((r) => this.toApiDto(r))
  }

  async createUser(
    actorPlatformUserId: string,
    dto: CreatePlatformUserDto,
  ): Promise<PlatformUserApiDto> {
    const { externalUid } = await this.authProvider.createUser(dto.email)

    let created: PlatformUser
    try {
      created = await this.repository.create({
        externalUid,
        email: dto.email,
        fullName: dto.fullName,
      })
    } catch (err) {
      // Compensate: don't leave an orphaned identity in the auth provider.
      try {
        await this.authProvider.deleteUser(externalUid)
      } catch (cleanupErr) {
        this.logger.warn(
          `Failed to clean up auth identity ${externalUid} after DB error: ${(cleanupErr as Error).message}`,
        )
      }
      if (this.isUniqueViolation(err)) {
        throw new ConflictException({
          code: ErrorCode.USER_ALREADY_EXISTS,
          message: 'A platform user with this email already exists',
        })
      }
      throw err
    }

    // Non-fatal: recovery path is POST /v1/staff/identity/users/:id/resend-invite.
    try {
      const link = await this.authProvider.generatePasswordResetLink(dto.email)
      await this.mailer.sendSetPasswordEmail(dto.email, link)
    } catch (err) {
      this.logger.warn(
        `Set-password link step failed for ${dto.email}: ${(err as Error).message}`,
      )
    }

    void this.auditLog.record({
      actorType: 'system',
      category: 'auth',
      action: 'user_invited',
      entityType: 'PlatformUser',
      entityId: created.id,
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })

    return this.toApiDto(created)
  }

  async setActive(
    actorPlatformUserId: string,
    targetId: string,
    dto: SetActiveDto,
  ): Promise<PlatformUserApiDto> {
    if (targetId === actorPlatformUserId && !dto.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You cannot deactivate your own account',
      })
    }
    const target = await this.requireUser(targetId)
    const updated = await this.repository.setActive(target.id, dto.isActive)

    void this.auditLog.record({
      actorType: 'system',
      category: 'auth',
      action: dto.isActive ? 'user_reactivated' : 'user_deactivated',
      entityType: 'PlatformUser',
      entityId: target.id,
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })

    return this.toApiDto(updated)
  }

  async resendInvite(
    actorPlatformUserId: string,
    targetId: string,
  ): Promise<PlatformUserApiDto> {
    const target = await this.requireUser(targetId)
    const link = await this.authProvider.generatePasswordResetLink(target.email)
    await this.mailer.sendSetPasswordEmail(target.email, link)

    void this.auditLog.record({
      actorType: 'system',
      category: 'auth',
      action: 'user_invited',
      entityType: 'PlatformUser',
      entityId: target.id,
      metadata: { platformUserId: actorPlatformUserId, resend: true },
      status: 'success',
    })

    return this.toApiDto(target)
  }

  private async requireUser(id: string): Promise<PlatformUser> {
    const user = await this.repository.findById(id)
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'Platform user not found',
      })
    }
    return user
  }

  private isUniqueViolation(err: unknown): err is { code: string } {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    )
  }

  private toApiDto(row: PlatformUser): PlatformUserApiDto {
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      status: row.lastLoginAt ? 'active' : 'invited',
    }
  }
}
