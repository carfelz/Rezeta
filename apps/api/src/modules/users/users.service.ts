import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import type { User } from '@rezeta/db'
import {
  ErrorCode,
  UserPreferencesSchema,
  type UpdateUserPreferencesDto,
  type UserPreferences,
} from '@rezeta/shared'
import { UsersRepository } from './users.repository.js'

@Injectable()
export class UsersService {
  constructor(@Inject(UsersRepository) private repository: UsersRepository) {}

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
}

function parsePreferences(raw: unknown): UserPreferences {
  const parsed = UserPreferencesSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : {}
}
