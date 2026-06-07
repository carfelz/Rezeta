import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolCategoriesRepository } from '../protocol-categories.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const mockPrisma = {
  protocolCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

const makeRepo = () =>
  new ProtocolCategoriesRepository(mockPrisma as unknown as PrismaService)

describe('ProtocolCategoriesRepository', () => {
  let repo: ProtocolCategoriesRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = makeRepo()
  })

  it('findAll filters by tenant and excludes soft-deleted, ordered by name', async () => {
    mockPrisma.protocolCategory.findMany.mockResolvedValue([])
    await repo.findAll('t1')
    expect(mockPrisma.protocolCategory.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', deletedAt: null },
      orderBy: { name: 'asc' },
    })
  })

  it('findById scopes by id, tenant and not-deleted', async () => {
    mockPrisma.protocolCategory.findFirst.mockResolvedValue(null)
    await repo.findById('t1', 'c1')
    expect(mockPrisma.protocolCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', tenantId: 't1', deletedAt: null },
    })
  })

  it('create persists name with the provided color', async () => {
    mockPrisma.protocolCategory.create.mockResolvedValue({ id: 'c1' })
    await repo.create('t1', { name: 'Emergencias', color: '#EF4444' })
    expect(mockPrisma.protocolCategory.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', name: 'Emergencias', color: '#EF4444' },
    })
  })

  it('create falls back to the default color when none given', async () => {
    mockPrisma.protocolCategory.create.mockResolvedValue({ id: 'c1' })
    await repo.create('t1', { name: 'Emergencias' })
    expect(mockPrisma.protocolCategory.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', name: 'Emergencias', color: '#6B7280' },
    })
  })

  it('update only sets provided fields', async () => {
    mockPrisma.protocolCategory.update.mockResolvedValue({ id: 'c1' })
    await repo.update('c1', { name: 'Renamed' })
    expect(mockPrisma.protocolCategory.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'Renamed' },
    })
  })

  it('update can set color only', async () => {
    mockPrisma.protocolCategory.update.mockResolvedValue({ id: 'c1' })
    await repo.update('c1', { color: '#000000' })
    expect(mockPrisma.protocolCategory.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { color: '#000000' },
    })
  })

  it('softDelete stamps deletedAt', async () => {
    mockPrisma.protocolCategory.update.mockResolvedValue({ id: 'c1' })
    await repo.softDelete('c1')
    const arg = mockPrisma.protocolCategory.update.mock.calls[0][0] as {
      where: { id: string }
      data: { deletedAt: Date }
    }
    expect(arg.where).toEqual({ id: 'c1' })
    expect(arg.data.deletedAt).toBeInstanceOf(Date)
  })
})
