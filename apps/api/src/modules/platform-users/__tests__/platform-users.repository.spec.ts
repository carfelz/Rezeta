/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformUsersRepository } from '../platform-users.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const prisma = {
  platformUser: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaService

function makeRepo(): PlatformUsersRepository {
  return new PlatformUsersRepository(prisma)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlatformUsersRepository', () => {
  it('list returns all rows (including deactivated) ordered by createdAt', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    vi.mocked(prisma.platformUser.findMany).mockResolvedValue(rows as never)
    await expect(makeRepo().list()).resolves.toBe(rows)
    expect(prisma.platformUser.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
    })
  })

  it('findById looks up by primary key without a deletedAt filter', async () => {
    vi.mocked(prisma.platformUser.findUnique).mockResolvedValue(null)
    await expect(makeRepo().findById('id-1')).resolves.toBeNull()
    expect(prisma.platformUser.findUnique).toHaveBeenCalledWith({ where: { id: 'id-1' } })
  })

  it('setActive(false) soft-deletes; setActive(true) restores', async () => {
    vi.mocked(prisma.platformUser.update).mockResolvedValue({ id: 'id-1' } as never)
    const repo = makeRepo()

    await repo.setActive('id-1', false)
    expect(prisma.platformUser.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { isActive: false, deletedAt: expect.any(Date) },
    })

    await repo.setActive('id-1', true)
    expect(prisma.platformUser.update).toHaveBeenLastCalledWith({
      where: { id: 'id-1' },
      data: { isActive: true, deletedAt: null },
    })
  })

  it('markSignedIn stamps lastLoginAt', async () => {
    vi.mocked(prisma.platformUser.update).mockResolvedValue({ id: 'id-1' } as never)
    await makeRepo().markSignedIn('id-1')
    expect(prisma.platformUser.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { lastLoginAt: expect.any(Date) },
    })
  })
})
