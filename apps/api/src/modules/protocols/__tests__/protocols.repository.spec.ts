import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolsRepository } from '../protocols.repository.js'

const now = new Date('2026-01-01T00:00:00Z')
const minimalContent = { version: '1.0', template_version: '1.0', blocks: [] }
const minimalSchema = { version: '1.0', blocks: [] }

const mockTx = {
  protocol: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  protocolVersion: { create: vi.fn(), findFirst: vi.fn() },
}

const mockPrisma = {
  protocol: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  protocolVersion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

function makeProtocolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proto1',
    tenantId: 't1',
    title: 'Anaphylaxis',
    status: 'draft',
    isFavorite: false,
    typeId: 'type1',
    currentVersionId: 'ver1',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    type: { id: 'type1', name: 'Emergencia', template: { schema: minimalSchema } },
    ...overrides,
  }
}

function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ver1',
    protocolId: 'proto1',
    tenantId: 't1',
    versionNumber: 1,
    content: minimalContent,
    changeSummary: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

describe('ProtocolsRepository', () => {
  let repo: ProtocolsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ProtocolsRepository(mockPrisma as never)
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates protocol in transaction and returns protocol + version', async () => {
      const protocol = makeProtocolRow()
      const version = makeVersionRow()
      mockTx.protocol.create.mockResolvedValue({ id: 'proto1' })
      mockTx.protocolVersion.create.mockResolvedValue(version)
      mockTx.protocol.update.mockResolvedValue(protocol)

      const result = await repo.create({
        tenantId: 't1',
        title: 'Anaphylaxis',
        createdBy: 'u1',
        typeId: 'type1',
        content: minimalContent,
      })

      expect(result.protocol.id).toBe('proto1')
      expect(result.version.versionNumber).toBe(1)
      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'draft' }) }),
      )
      expect(mockTx.protocol.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentVersionId: version.id }),
        }),
      )
    })

    it('passes tags to create when provided', async () => {
      const protocol = makeProtocolRow()
      const version = makeVersionRow()
      mockTx.protocol.create.mockResolvedValue({ id: 'proto1' })
      mockTx.protocolVersion.create.mockResolvedValue(version)
      mockTx.protocol.update.mockResolvedValue(protocol)

      await repo.create({
        tenantId: 't1',
        title: 'Test',
        createdBy: 'u1',
        typeId: 'type1',
        content: minimalContent,
        tags: ['cardiology'],
      })

      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: ['cardiology'] }),
        }),
      )
    })

    it('defaults tags to empty array when not provided', async () => {
      const protocol = makeProtocolRow()
      mockTx.protocol.create.mockResolvedValue({ id: 'proto1' })
      mockTx.protocolVersion.create.mockResolvedValue(makeVersionRow())
      mockTx.protocol.update.mockResolvedValue(protocol)

      await repo.create({
        tenantId: 't1',
        title: 'Test',
        createdBy: 'u1',
        typeId: 'type1',
        content: minimalContent,
      })

      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: [] }),
        }),
      )
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns protocol with currentVersion when found', async () => {
      const protocol = makeProtocolRow()
      const version = makeVersionRow()
      mockPrisma.protocol.findFirst.mockResolvedValue(protocol)
      mockPrisma.protocolVersion.findFirst.mockResolvedValue(version)

      const result = await repo.findById('proto1', 't1')

      expect(result?.id).toBe('proto1')
      expect(result?.currentVersion?.versionNumber).toBe(1)
    })

    it('returns null when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      expect(await repo.findById('bad', 't1')).toBeNull()
    })

    it('returns null currentVersion when currentVersionId is null', async () => {
      const protocol = makeProtocolRow({ currentVersionId: null })
      mockPrisma.protocol.findFirst.mockResolvedValue(protocol)

      const result = await repo.findById('proto1', 't1')

      expect(result?.currentVersion).toBeNull()
      expect(mockPrisma.protocolVersion.findFirst).not.toHaveBeenCalled()
    })

    it('returns null currentVersion when version query returns null', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockPrisma.protocolVersion.findFirst.mockResolvedValue(null)

      const result = await repo.findById('proto1', 't1')

      expect(result?.currentVersion).toBeNull()
    })
  })

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns list with no filters', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([makeProtocolRow()])
      const result = await repo.list('t1')
      expect(result).toHaveLength(1)
    })

    it('applies default sort (updatedAt desc)', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1')
      const orderBy = mockPrisma.protocol.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ updatedAt: 'desc' })
    })

    it('applies updatedAt_asc sort', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', { sort: 'updatedAt_asc' })
      const orderBy = mockPrisma.protocol.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ updatedAt: 'asc' })
    })

    it('applies title_asc sort', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', { sort: 'title_asc' })
      const orderBy = mockPrisma.protocol.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ title: 'asc' })
    })

    it('applies title_desc sort', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', { sort: 'title_desc' })
      const orderBy = mockPrisma.protocol.findMany.mock.calls[0][0].orderBy
      expect(orderBy).toEqual({ title: 'desc' })
    })

    it('applies typeId filter when provided', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', { typeId: 'type1' })
      const where = mockPrisma.protocol.findMany.mock.calls[0][0].where
      expect(where.typeId).toBe('type1')
    })

    it('applies status filter when provided', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', { status: 'active' })
      const where = mockPrisma.protocol.findMany.mock.calls[0][0].where
      expect(where.status).toBe('active')
    })

    it('applies favoritesOnly filter when true', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', { favoritesOnly: true })
      const where = mockPrisma.protocol.findMany.mock.calls[0][0].where
      expect(where.isFavorite).toBe(true)
    })

    it('applies search filter when provided', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', { search: 'anaphylaxis' })
      const where = mockPrisma.protocol.findMany.mock.calls[0][0].where
      expect(where.title).toEqual({ contains: 'anaphylaxis', mode: 'insensitive' })
    })

    it('omits optional filters when not provided', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([])
      await repo.list('t1', {})
      const where = mockPrisma.protocol.findMany.mock.calls[0][0].where
      expect(where.typeId).toBeUndefined()
      expect(where.status).toBeUndefined()
      expect(where.isFavorite).toBeUndefined()
      expect(where.title).toBeUndefined()
    })
  })

  // ── setFavorite ────────────────────────────────────────────────────────────

  describe('setFavorite', () => {
    it('returns true and updates when protocol exists', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockPrisma.protocol.update.mockResolvedValue({})
      expect(await repo.setFavorite('proto1', 't1', true)).toBe(true)
      expect(mockPrisma.protocol.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isFavorite: true } }),
      )
    })

    it('returns false when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      expect(await repo.setFavorite('bad', 't1', true)).toBe(false)
      expect(mockPrisma.protocol.update).not.toHaveBeenCalled()
    })
  })

  // ── rename ─────────────────────────────────────────────────────────────────

  describe('rename', () => {
    it('returns updated protocol when found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockPrisma.protocol.update.mockResolvedValue(makeProtocolRow({ title: 'New Title' }))
      const result = await repo.rename('proto1', 't1', 'New Title')
      expect(result?.title).toBe('New Title')
    })

    it('returns null when not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      expect(await repo.rename('bad', 't1', 'X')).toBeNull()
    })
  })

  // ── listVersions ───────────────────────────────────────────────────────────

  describe('listVersions', () => {
    it('returns version list with isCurrent flag', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue({ currentVersionId: 'ver1' })
      mockPrisma.protocolVersion.findMany.mockResolvedValue([
        { id: 'ver1', versionNumber: 2, changeSummary: 'Update', createdAt: now },
        { id: 'ver0', versionNumber: 1, changeSummary: 'Initial', createdAt: now },
      ])
      const result = await repo.listVersions('proto1', 't1')
      expect(result).toHaveLength(2)
      expect(result[0].isCurrent).toBe(true)
      expect(result[1].isCurrent).toBe(false)
    })

    it('returns empty array when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      expect(await repo.listVersions('bad', 't1')).toEqual([])
    })
  })

  // ── getVersion ─────────────────────────────────────────────────────────────

  describe('getVersion', () => {
    it('returns version when found', async () => {
      const version = makeVersionRow()
      mockPrisma.protocolVersion.findFirst.mockResolvedValue(version)
      const result = await repo.getVersion('proto1', 'ver1', 't1')
      expect(result?.id).toBe('ver1')
    })

    it('returns null when not found', async () => {
      mockPrisma.protocolVersion.findFirst.mockResolvedValue(null)
      expect(await repo.getVersion('proto1', 'bad', 't1')).toBeNull()
    })
  })

  // ── saveVersion ────────────────────────────────────────────────────────────

  describe('saveVersion', () => {
    it('creates version with next version number', async () => {
      mockTx.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockTx.protocolVersion.findFirst.mockResolvedValue(makeVersionRow({ versionNumber: 2 }))
      const newVersion = makeVersionRow({ id: 'ver3', versionNumber: 3 })
      mockTx.protocolVersion.create.mockResolvedValue(newVersion)
      mockTx.protocol.update.mockResolvedValue({})

      const result = await repo.saveVersion({
        protocolId: 'proto1',
        tenantId: 't1',
        createdBy: 'u1',
        content: minimalContent,
        changeSummary: 'Update',
        publish: false,
      })

      expect(result?.versionNumber).toBe(3)
      expect(mockTx.protocolVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 3 }) }),
      )
    })

    it('starts at version 1 when no previous versions exist', async () => {
      mockTx.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockTx.protocolVersion.findFirst.mockResolvedValue(null)
      const newVersion = makeVersionRow({ id: 'ver1', versionNumber: 1 })
      mockTx.protocolVersion.create.mockResolvedValue(newVersion)
      mockTx.protocol.update.mockResolvedValue({})

      const result = await repo.saveVersion({
        protocolId: 'proto1',
        tenantId: 't1',
        createdBy: 'u1',
        content: minimalContent,
        publish: false,
      })

      expect(result?.versionNumber).toBe(1)
    })

    it('sets status to active when publish is true', async () => {
      mockTx.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockTx.protocolVersion.findFirst.mockResolvedValue(null)
      mockTx.protocolVersion.create.mockResolvedValue(makeVersionRow())
      mockTx.protocol.update.mockResolvedValue({})

      await repo.saveVersion({
        protocolId: 'proto1',
        tenantId: 't1',
        createdBy: 'u1',
        content: minimalContent,
        publish: true,
      })

      expect(mockTx.protocol.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'active' }),
        }),
      )
    })

    it('does not set status when publish is false', async () => {
      mockTx.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockTx.protocolVersion.findFirst.mockResolvedValue(null)
      mockTx.protocolVersion.create.mockResolvedValue(makeVersionRow())
      mockTx.protocol.update.mockResolvedValue({})

      await repo.saveVersion({
        protocolId: 'proto1',
        tenantId: 't1',
        createdBy: 'u1',
        content: minimalContent,
        publish: false,
      })

      const updateData = mockTx.protocol.update.mock.calls[0][0].data
      expect(updateData.status).toBeUndefined()
    })

    it('returns null when protocol not found', async () => {
      mockTx.protocol.findFirst.mockResolvedValue(null)
      const result = await repo.saveVersion({
        protocolId: 'bad',
        tenantId: 't1',
        createdBy: 'u1',
        content: minimalContent,
        publish: false,
      })
      expect(result).toBeNull()
    })

    it('passes null changeSummary when not provided', async () => {
      mockTx.protocol.findFirst.mockResolvedValue(makeProtocolRow())
      mockTx.protocolVersion.findFirst.mockResolvedValue(null)
      mockTx.protocolVersion.create.mockResolvedValue(makeVersionRow())
      mockTx.protocol.update.mockResolvedValue({})

      await repo.saveVersion({
        protocolId: 'proto1',
        tenantId: 't1',
        createdBy: 'u1',
        content: minimalContent,
        publish: false,
      })

      expect(mockTx.protocolVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ changeSummary: null }),
        }),
      )
    })
  })
})
