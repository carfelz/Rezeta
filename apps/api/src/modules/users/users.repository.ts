import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import type { User } from '@rezeta/db'

@Injectable()
export class UsersRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { firebaseUid, deletedAt: null },
    })
  }

  async findById(id: string, tenantId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
  }
}
