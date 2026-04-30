import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ProtocolsService } from '../protocols.service.js'

const now = new Date('2026-01-01T00:00:00Z')

const mockRepo = {
  create: vi.fn(),
  list: vi.fn(),
  setFavorite: vi.fn(),
  findById: vi.fn(),
  rename: vi.fn(),
  saveVersion: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
}

const mockTypesRepo = {
  findByIdWithTemplate: vi.fn(),
}

const minimalSchema = { version: '1.0', blocks: [] }
const minimalContent = { version: '1.0', template_version: '1.0', blocks: [] }

const protocolType = {
  id: 'type1',
  name: 'Emergencia',
  template: { schema: minimalSchema },
}

const protocolRow = {
  id: 'proto1',
  title: 'Anaphylaxis',
  status: 'draft',
  isFavorite: false,
  typeId: 'type1',
  createdAt: now,
  updatedAt: now,
  type: { id: 'type1', name: 'Emergencia', template: { schema: minimalSchema } },
  currentVersion: {
    id: 'ver1',
    versionNumber: 1,
    content: minimalContent,
    changeSummary: null,
    createdAt: now,
  },
}

describe('ProtocolsService', () => {
  let service: ProtocolsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolsService(mockRepo as never, mockTypesRepo as never)
    mockTypesRepo.findByIdWithTemplate.mockResolvedValue(protocolType)
    mockRepo.findById.mockResolvedValue(protocolRow)
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates protocol from type and returns formatted response', async () => {
      const version = { id: 'ver1', versionNumber: 1, content: minimalContent, changeSummary: null, createdAt: now }
      mockRepo.create.mockResolvedValue({ protocol: { ...protocolRow, type: protocolType }, version })
      const result = await service.create('t1', 'u1', { typeId: 'type1', title: 'Anaphylaxis' })
      expect(result.id).toBe('proto1')
      expect(result.typeName).toBe('Emergencia')
      expect(result.currentVersion?.versionNumber).toBe(1)
    })

    it('throws NotFoundException when type not found', async () => {
      mockTypesRepo.findByIdWithTemplate.mockResolvedValue(null)
      await expect(service.create('t1', 'u1', { typeId: 'bad', title: 'Test' })).rejects.toThrow(NotFoundException)
    })
  })

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns list of protocol items', async () => {
      const listRow = {
        id: 'proto1',
        title: 'Anaphylaxis',
        status: 'draft',
        isFavorite: false,
        updatedAt: now,
        type: { id: 'type1', name: 'Emergencia' },
        versions: [{ versionNumber: 2 }],
      }
      mockRepo.list.mockResolvedValue([listRow])
      const result = await service.list('t1')
      expect(result).toHaveLength(1)
      expect(result[0].typeName).toBe('Emergencia')
      expect(result[0].currentVersionNumber).toBe(2)
    })

    it('returns null currentVersionNumber when no versions', async () => {
      const listRow = {
        id: 'proto1',
        title: 'Test',
        status: 'draft',
        isFavorite: false,
        updatedAt: now,
        type: { id: 'type1', name: 'Test' },
        versions: [],
      }
      mockRepo.list.mockResolvedValue([listRow])
      const result = await service.list('t1')
      expect(result[0].currentVersionNumber).toBeNull()
    })

    it('passes query filters through to repo', async () => {
      mockRepo.list.mockResolvedValue([])
      await service.list('t1', { favoritesOnly: true, search: 'anaphylaxis', typeId: 'type1', status: 'active' })
      expect(mockRepo.list).toHaveBeenCalledWith('t1', expect.objectContaining({
        favoritesOnly: true,
        search: 'anaphylaxis',
        typeId: 'type1',
        status: 'active',
      }))
    })
  })

  // ── setFavorite ────────────────────────────────────────────────────────────

  describe('setFavorite', () => {
    it('toggles favorite successfully', async () => {
      mockRepo.setFavorite.mockResolvedValue(true)
      await expect(service.setFavorite('proto1', 't1', true)).resolves.toBeUndefined()
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockRepo.setFavorite.mockResolvedValue(false)
      await expect(service.setFavorite('bad', 't1', true)).rejects.toThrow(NotFoundException)
    })
  })

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns formatted protocol', async () => {
      const result = await service.getById('proto1', 't1')
      expect(result.id).toBe('proto1')
      expect(result.templateSchema).toBeDefined()
    })

    it('throws NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.getById('bad', 't1')).rejects.toThrow(NotFoundException)
    })

    it('returns null currentVersion when protocol has no version', async () => {
      mockRepo.findById.mockResolvedValue({ ...protocolRow, currentVersion: null })
      const result = await service.getById('proto1', 't1')
      expect(result.currentVersion).toBeNull()
    })
  })

  // ── rename ─────────────────────────────────────────────────────────────────

  describe('rename', () => {
    it('returns renamed protocol data', async () => {
      mockRepo.rename.mockResolvedValue({ id: 'proto1', title: 'New Title' })
      const result = await service.rename('proto1', 't1', { title: 'New Title' })
      expect(result.title).toBe('New Title')
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockRepo.rename.mockResolvedValue(null)
      await expect(service.rename('bad', 't1', { title: 'X' })).rejects.toThrow(NotFoundException)
    })
  })

  // ── saveVersion ────────────────────────────────────────────────────────────

  describe('saveVersion', () => {
    const version = { id: 'ver2', versionNumber: 2, changeSummary: 'Update', createdAt: now }

    it('saves version for valid content', async () => {
      mockRepo.saveVersion.mockResolvedValue(version)
      const result = await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        changeSummary: 'Update',
        publish: false,
      })
      expect(result.versionNumber).toBe(2)
      expect(result.createdAt).toBe(now.toISOString())
    })

    it('throws BadRequestException for invalid content', async () => {
      await expect(
        service.saveVersion('proto1', 't1', 'u1', {
          content: { invalid: true } as never,
          publish: false,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(
        service.saveVersion('bad', 't1', 'u1', { content: minimalContent, publish: false }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when saveVersion returns null', async () => {
      mockRepo.saveVersion.mockResolvedValue(null)
      await expect(
        service.saveVersion('proto1', 't1', 'u1', { content: minimalContent, publish: false }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when required block is missing', async () => {
      const schemaWithRequired = {
        version: '1.0',
        blocks: [{ id: 'blk_req', type: 'text', required: true }],
      }
      mockRepo.findById.mockResolvedValue({
        ...protocolRow,
        type: { ...protocolRow.type, template: { schema: schemaWithRequired } },
      })
      await expect(
        service.saveVersion('proto1', 't1', 'u1', { content: minimalContent, publish: false }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when required child block is missing from section', async () => {
      const schemaWithRequiredChild = {
        version: '1.0',
        blocks: [
          {
            id: 'sec1',
            type: 'section',
            required: true,
            placeholder_blocks: [{ id: 'blk_child', type: 'dosage_table', required: true }],
          },
        ],
      }
      mockRepo.findById.mockResolvedValue({
        ...protocolRow,
        type: { ...protocolRow.type, template: { schema: schemaWithRequiredChild } },
      })
      await expect(
        service.saveVersion('proto1', 't1', 'u1', { content: minimalContent, publish: false }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── listVersions ───────────────────────────────────────────────────────────

  describe('listVersions', () => {
    it('returns version list items', async () => {
      mockRepo.listVersions.mockResolvedValue([
        { id: 'ver1', versionNumber: 1, changeSummary: null, createdAt: now, isCurrent: true },
      ])
      const result = await service.listVersions('proto1', 't1')
      expect(result).toHaveLength(1)
      expect(result[0].isCurrent).toBe(true)
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.listVersions('bad', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── getVersion ─────────────────────────────────────────────────────────────

  describe('getVersion', () => {
    it('returns version detail', async () => {
      mockRepo.getVersion.mockResolvedValue({
        id: 'ver1',
        versionNumber: 1,
        content: minimalContent,
        changeSummary: 'Initial',
        createdAt: now,
      })
      const result = await service.getVersion('proto1', 'ver1', 't1')
      expect(result.versionNumber).toBe(1)
      expect(result.createdAt).toBe(now.toISOString())
    })

    it('throws NotFoundException when version not found', async () => {
      mockRepo.getVersion.mockResolvedValue(null)
      await expect(service.getVersion('proto1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── restoreVersion ─────────────────────────────────────────────────────────

  describe('restoreVersion', () => {
    it('creates new version from old version content', async () => {
      mockRepo.getVersion.mockResolvedValue({
        id: 'ver1',
        versionNumber: 1,
        content: minimalContent,
        changeSummary: 'Original',
        createdAt: now,
      })
      mockRepo.saveVersion.mockResolvedValue({
        id: 'ver3',
        versionNumber: 3,
        changeSummary: 'Restaurado desde v1',
        createdAt: now,
      })
      const result = await service.restoreVersion('proto1', 'ver1', 't1', 'u1')
      expect(result.versionNumber).toBe(3)
      expect(mockRepo.saveVersion).toHaveBeenCalledWith(
        expect.objectContaining({ changeSummary: 'Restaurado desde v1' }),
      )
    })

    it('throws NotFoundException when version not found', async () => {
      mockRepo.getVersion.mockResolvedValue(null)
      await expect(service.restoreVersion('proto1', 'bad', 't1', 'u1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when saveVersion returns null', async () => {
      mockRepo.getVersion.mockResolvedValue({
        id: 'ver1', versionNumber: 1, content: minimalContent, changeSummary: null, createdAt: now,
      })
      mockRepo.saveVersion.mockResolvedValue(null)
      await expect(service.restoreVersion('proto1', 'ver1', 't1', 'u1')).rejects.toThrow(NotFoundException)
    })
  })
})
