import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationRecordsRepository } from '../consultation-records.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const now = new Date('2026-07-06T10:42:00Z')

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec1',
    tenantId: 't1',
    consultationId: 'c1',
    patientId: 'p1',
    versionNumber: 1,
    kind: 'evolution',
    status: 'draft',
    sections: [
      { key: 'motivo_consulta', title: 'Motivo de consulta', content: 'Control.', source: 'generated', required: true },
    ],
    generatedAt: now,
    signedAt: null,
    signedBy: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

const mockPrisma = {
  consultationRecord: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}

const repo = new ConsultationRecordsRepository(mockPrisma as unknown as PrismaService)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConsultationRecordsRepository', () => {
  it('findLatest filters by tenant, excludes soft-deleted, orders by version desc', async () => {
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(makeRow())
    const result = await repo.findLatest('c1', 't1')
    expect(mockPrisma.consultationRecord.findFirst).toHaveBeenCalledWith({
      where: { consultationId: 'c1', tenantId: 't1', deletedAt: null },
      orderBy: { versionNumber: 'desc' },
    })
    expect(result?.generatedAt).toBe(now.toISOString())
  })

  it('findLatest returns null when no record exists', async () => {
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(null)
    expect(await repo.findLatest('c1', 't1')).toBeNull()
  })

  it('create persists the draft', async () => {
    mockPrisma.consultationRecord.create.mockResolvedValue(makeRow())
    const dto = await repo.create({
      tenantId: 't1',
      consultationId: 'c1',
      patientId: 'p1',
      versionNumber: 1,
      kind: 'evolution',
      sections: [],
      generatedAt: now,
    })
    expect(mockPrisma.consultationRecord.create).toHaveBeenCalled()
    expect(dto.status).toBe('draft')
  })

  it('replaceSections only touches drafts and re-reads the row', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(makeRow())
    const result = await repo.replaceSections('rec1', 't1', [])
    expect(mockPrisma.consultationRecord.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec1', tenantId: 't1', status: 'draft', deletedAt: null },
      data: { sections: [] },
    })
    expect(result).not.toBeNull()
  })

  it('replaceSections returns null when the record is not a draft', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 0 })
    expect(await repo.replaceSections('rec1', 't1', [])).toBeNull()
    expect(mockPrisma.consultationRecord.findFirst).not.toHaveBeenCalled()
  })

  it('sign stamps signedAt/signedBy on drafts only', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(
      makeRow({ status: 'signed', signedAt: now, signedBy: 'u1' }),
    )
    const result = await repo.sign('rec1', 't1', 'u1')
    const call = mockPrisma.consultationRecord.updateMany.mock.calls[0]![0]
    expect(call.where).toEqual({ id: 'rec1', tenantId: 't1', status: 'draft', deletedAt: null })
    expect(call.data.status).toBe('signed')
    expect(call.data.signedBy).toBe('u1')
    expect(result?.status).toBe('signed')
  })

  it('sign returns null when already signed', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 0 })
    expect(await repo.sign('rec1', 't1', 'u1')).toBeNull()
  })

  it('listVersions returns all non-deleted versions for the tenant, newest first', async () => {
    mockPrisma.consultationRecord.findMany.mockResolvedValue([
      makeRow({ id: 'rec2', versionNumber: 2 }),
      makeRow({ id: 'rec1', versionNumber: 1 }),
    ])
    const result = await repo.listVersions('c1', 't1')
    expect(mockPrisma.consultationRecord.findMany).toHaveBeenCalledWith({
      where: { consultationId: 'c1', tenantId: 't1', deletedAt: null },
      orderBy: { versionNumber: 'desc' },
    })
    expect(result).toEqual([
      {
        id: 'rec2',
        versionNumber: 2,
        kind: 'evolution',
        status: 'draft',
        generatedAt: now.toISOString(),
        signedAt: null,
      },
      {
        id: 'rec1',
        versionNumber: 1,
        kind: 'evolution',
        status: 'draft',
        generatedAt: now.toISOString(),
        signedAt: null,
      },
    ])
  })

  it('listVersions returns an empty array when no record exists', async () => {
    mockPrisma.consultationRecord.findMany.mockResolvedValue([])
    expect(await repo.listVersions('c1', 't1')).toEqual([])
  })

  it('findByVersion returns the exact version scoped to tenant', async () => {
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(makeRow({ versionNumber: 2 }))
    const result = await repo.findByVersion('c1', 't1', 2)
    expect(mockPrisma.consultationRecord.findFirst).toHaveBeenCalledWith({
      where: { consultationId: 'c1', tenantId: 't1', versionNumber: 2, deletedAt: null },
    })
    expect(result?.versionNumber).toBe(2)
  })

  it('findByVersion returns null when that version does not exist', async () => {
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(null)
    expect(await repo.findByVersion('c1', 't1', 99)).toBeNull()
  })
})
