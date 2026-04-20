import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import type { User } from '@rezeta/db'
import { ErrorCode } from '@rezeta/shared'
import { UsersRepository } from './users.repository.js'

@Injectable()
export class UsersService {
  constructor(@Inject(UsersRepository) private repository: UsersRepository) {}

  async getByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.repository.findByFirebaseUid(firebaseUid)
  }

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
}
