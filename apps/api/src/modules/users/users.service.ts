import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common'
import type { User } from '@rezeta/db'
import {
  ErrorCode,
  UserPreferencesSchema,
  canManageRole,
  type UpdateProfileDto,
  type UpdateUserPreferencesDto,
  type UserPreferences,
  type UserRole,
  type CreateUserDto,
  type ChangeRoleDto,
  type SetActiveDto,
  type ManagedUserDto,
} from '@rezeta/shared'
import { AUTH_PROVIDER, type IAuthProvider } from '../../lib/auth/index.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { UsersRepository } from './users.repository.js'
import { InvitationMailerService } from './invitation-mailer.service.js'

@Injectable()
export class UsersService {
  constructor(
    @Inject(UsersRepository) private repository: UsersRepository,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(InvitationMailerService) private mailer: InvitationMailerService,
  ) {}

  async getById(id: string, tenantId: string): Promise<User> {
    const user = await this.repository.findById(id, tenantId)
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.USER_NOT_FOUND,
        message: `User ${id} not found`,
      })
    }
    return user
  }

  async updateProfile(id: string, tenantId: string, dto: UpdateProfileDto): Promise<void> {
    await this.getById(id, tenantId)
    await this.repository.updateProfile(id, tenantId, {
      fullName: dto.fullName,
      specialty: dto.specialty,
      licenseNumber: dto.licenseNumber,
    })
  }

  async getPreferences(id: string, tenantId: string): Promise<UserPreferences> {
    const user = await this.getById(id, tenantId)
    return parsePreferences(user.preferences)
  }

  /**
   * Partial-merge update: incoming keys overwrite existing ones, untouched keys
   * remain. Pass `null` for a key (not currently supported in schema) to delete.
   */
  async updatePreferences(
    id: string,
    tenantId: string,
    patch: UpdateUserPreferencesDto,
  ): Promise<UserPreferences> {
    const user = await this.getById(id, tenantId)
    const current = parsePreferences(user.preferences)
    const merged: UserPreferences = { ...current, ...patch }
    await this.repository.updatePreferences(id, tenantId, merged)
    return merged
  }

  async listUsers(tenantId: string): Promise<ManagedUserDto[]> {
    const users = await this.repository.listByTenant(tenantId)
    return users.map(toManagedUser)
  }

  /**
   * `actorUserId` is `string | null` because this method also serves the
   * platform-staff bootstrap of a brand-new institution's initial super_admin
   * (see StaffService.createInstitution): the actor there is a PlatformUser,
   * not an institution user, so there is no institution actorUserId to record.
   * `options.bypassRankCheck` skips the `canManageRole` rank check for that
   * same bootstrap case — there is no existing super_admin to rank against.
   */
  async createUser(
    tenantId: string,
    actorRole: UserRole,
    actorUserId: string | null,
    dto: CreateUserDto,
    options?: { bypassRankCheck?: boolean },
  ): Promise<ManagedUserDto> {
    if (!options?.bypassRankCheck) {
      this.assertCanManage(actorRole, dto.role)
    }

    const { externalUid } = await this.authProvider.createUser(dto.email)
    const created = await this.repository.createProvisionedUser({
      tenantId,
      externalUid,
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role,
    })

    const link = await this.authProvider.generatePasswordResetLink(dto.email)
    await this.mailer.sendSetPasswordEmail(dto.email, link)

    void this.auditLog.record({
      tenantId,
      ...(actorUserId ? { actorUserId } : {}),
      actorType: actorUserId ? 'user' : 'system',
      category: 'auth',
      action: 'user_invited',
      entityType: 'User',
      entityId: created.id,
      metadata: { role: dto.role },
      status: 'success',
    })

    return toManagedUser(created)
  }

  async changeRole(
    tenantId: string,
    actorRole: UserRole,
    actorUserId: string,
    targetUserId: string,
    dto: ChangeRoleDto,
  ): Promise<ManagedUserDto> {
    const target = await this.requireUser(targetUserId, tenantId)
    // Actor must outrank both the current role and the new role.
    this.assertCanManage(actorRole, target.role as UserRole)
    this.assertCanManage(actorRole, dto.role)

    await this.repository.updateRole(targetUserId, tenantId, dto.role)
    void this.auditLog.record({
      tenantId,
      actorUserId,
      actorType: 'user',
      category: 'auth',
      action: 'role_changed',
      entityType: 'User',
      entityId: targetUserId,
      changes: { role: { before: target.role, after: dto.role } },
      status: 'success',
    })
    const updated = await this.requireUser(targetUserId, tenantId)
    return toManagedUser(updated)
  }

  async setActive(
    tenantId: string,
    actorRole: UserRole,
    actorUserId: string,
    targetUserId: string,
    dto: SetActiveDto,
  ): Promise<ManagedUserDto> {
    const target = await this.requireUser(targetUserId, tenantId)
    this.assertCanManage(actorRole, target.role as UserRole)

    await this.repository.setActive(targetUserId, tenantId, dto.isActive)
    if (!dto.isActive) {
      void this.auditLog.record({
        tenantId,
        actorUserId,
        actorType: 'user',
        category: 'auth',
        action: 'user_deactivated',
        entityType: 'User',
        entityId: targetUserId,
        status: 'success',
      })
    }
    return toManagedUser({ ...target, isActive: dto.isActive })
  }

  private assertCanManage(actorRole: UserRole, targetRole: UserRole): void {
    if (!canManageRole(actorRole, targetRole)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You may only manage users below your role.',
      })
    }
  }

  private async requireUser(id: string, tenantId: string): Promise<User> {
    const user = await this.repository.findById(id, tenantId)
    if (!user) {
      throw new NotFoundException({ code: ErrorCode.USER_NOT_FOUND, message: `User ${id} not found` })
    }
    return user
  }
}

function parsePreferences(raw: unknown): UserPreferences {
  const parsed = UserPreferencesSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : {}
}

function toManagedUser(user: {
  id: string
  email: string
  fullName: string | null
  role: string
  isActive: boolean
  createdAt: Date
  lastLoginAt: Date | null
}): ManagedUserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as ManagedUserDto['role'],
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    // 'invited' until the user's first sign-in stamps lastLoginAt (see Task 2A).
    status: user.lastLoginAt ? 'active' : 'invited',
  }
}
