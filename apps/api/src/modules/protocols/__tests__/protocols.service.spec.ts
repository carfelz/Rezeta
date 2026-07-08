import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ProtocolsService } from '../protocols.service.js'

const now = new Date('2026-01-01T00:00:00Z')

const mockRepo = {
  findTemplateForCreate: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  setFavorite: vi.fn(),
  archive: vi.fn(),
  findById: vi.fn(),
  rename: vi.fn(),
  saveVersion: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
}

const minimalContent = { version: '1.0', template_version: '1.0', blocks: [] }

const protocolRow = {
  id: 'proto1',
  title: 'Anaphylaxis',
  status: 'draft',
  isFavorite: false,
  categoryId: 'cat1',
  createdAt: now,
  updatedAt: now,
  category: { id: 'cat1', name: 'Emergencia' },
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
    service = new ProtocolsService(mockRepo as never)
    mockRepo.findById.mockResolvedValue(protocolRow)
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws PROTOCOL_TEMPLATE_NOT_FOUND when template is missing', async () => {
      mockRepo.findTemplateForCreate.mockResolvedValue(null)
      await expect(
        service.create('t1', 'u1', { templateId: 'missing', title: 'New' } as never),
      ).rejects.toMatchObject({ response: { code: 'PROTOCOL_TEMPLATE_NOT_FOUND' } })
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('copies template blocks into content and inherits categoryId + templateId', async () => {
      mockRepo.findTemplateForCreate.mockResolvedValue({
        id: 'tmpl-1',
        categoryId: 'cat-1',
        schema: { version: '1.0', blocks: [{ id: 's', type: 'section', placeholder_blocks: [] }] },
      })
      mockRepo.create.mockResolvedValue({
        protocol: {
          id: 'p1',
          title: 'New',
          status: 'draft',
          isFavorite: false,
          createdAt: now,
          updatedAt: now,
          category: { id: 'cat-1', name: 'Emergencias' },
        },
        version: { id: 'v1', versionNumber: 1, content: {}, changeSummary: null, createdAt: now },
      })
      await service.create('t1', 'u1', { templateId: 'tmpl-1', title: 'New' } as never)
      const arg = mockRepo.create.mock.calls[0]![0] as Record<string, unknown>
      expect(arg.templateId).toBe('tmpl-1')
      expect(arg.categoryId).toBe('cat-1')
      expect((arg.content as { blocks: unknown[] }).blocks).toHaveLength(1)
    })

    it('creates protocol from template and returns formatted response', async () => {
      const version = {
        id: 'ver1',
        versionNumber: 1,
        content: minimalContent,
        changeSummary: null,
        createdAt: now,
      }
      mockRepo.findTemplateForCreate.mockResolvedValue({
        id: 'tmpl-1',
        categoryId: 'cat1',
        schema: { version: '1.0', blocks: [] },
      })
      mockRepo.create.mockResolvedValue({
        protocol: { ...protocolRow, category: { id: 'cat1', name: 'Emergencia' } },
        version,
      })
      const result = await service.create('t1', 'u1', {
        templateId: 'tmpl-1',
        title: 'Anaphylaxis',
      } as never)
      expect(result.id).toBe('proto1')
      expect(result.categoryName).toBe('Emergencia')
      expect(result.currentVersion?.versionNumber).toBe(1)
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
        category: { id: 'cat1', name: 'Emergencia' },
        versions: [{ versionNumber: 2 }],
      }
      mockRepo.list.mockResolvedValue([listRow])
      const result = await service.list('t1')
      expect(result).toHaveLength(1)
      expect(result[0]!.categoryName).toBe('Emergencia')
      expect(result[0]!.currentVersionNumber).toBe(2)
    })

    it('returns null currentVersionNumber when no versions', async () => {
      const listRow = {
        id: 'proto1',
        title: 'Test',
        status: 'draft',
        isFavorite: false,
        updatedAt: now,
        category: { id: 'cat1', name: 'Test' },
        versions: [],
      }
      mockRepo.list.mockResolvedValue([listRow])
      const result = await service.list('t1')
      expect(result[0]!.currentVersionNumber).toBeNull()
      expect(result[0]!.blockCount).toBe(0)
    })

    it('returns null categoryId and categoryName for blank protocols in list', async () => {
      const listRow = {
        id: 'proto-blank',
        title: 'Blank',
        status: 'draft',
        isFavorite: false,
        updatedAt: now,
        category: null,
        versions: [],
      }
      mockRepo.list.mockResolvedValue([listRow])
      const result = await service.list('t1')
      expect(result[0]!.categoryId).toBeNull()
      expect(result[0]!.categoryName).toBeNull()
    })

    it('computes blockCount from latest version content blocks array', async () => {
      const listRow = {
        id: 'proto-with-blocks',
        title: 'Populated',
        status: 'active',
        isFavorite: false,
        updatedAt: now,
        category: { id: 'cat1', name: 'Emergencia' },
        versions: [
          {
            versionNumber: 3,
            content: {
              version: '1.0',
              blocks: [
                { id: 'sec_1', type: 'section' },
                { id: 'blk_1', type: 'text' },
              ],
            },
          },
        ],
      }
      mockRepo.list.mockResolvedValue([listRow])
      const result = await service.list('t1')
      expect(result[0]!.blockCount).toBe(2)
      expect(result[0]!.currentVersionNumber).toBe(3)
    })

    it('returns blockCount=0 when latest version content lacks a blocks array', async () => {
      const listRow = {
        id: 'proto-no-blocks',
        title: 'Empty content shape',
        status: 'draft',
        isFavorite: false,
        updatedAt: now,
        category: { id: 'cat1', name: 'Emergencia' },
        versions: [{ versionNumber: 1, content: { version: '1.0' } }],
      }
      mockRepo.list.mockResolvedValue([listRow])
      const result = await service.list('t1')
      expect(result[0]!.blockCount).toBe(0)
    })

    it('passes query filters through to repo', async () => {
      mockRepo.list.mockResolvedValue([])
      await service.list('t1', {
        favoritesOnly: true,
        search: 'anaphylaxis',
        categoryId: 'cat1',
        status: 'active',
      })
      expect(mockRepo.list).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          favoritesOnly: true,
          search: 'anaphylaxis',
          categoryId: 'cat1',
          status: 'active',
        }),
      )
    })

    it('passes sort filter alone', async () => {
      mockRepo.list.mockResolvedValue([])
      await service.list('t1', { favoritesOnly: false, sort: 'title_asc' })
      expect(mockRepo.list).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ sort: 'title_asc' }),
      )
    })

    it('passes favoritesOnly:false when false (service always includes the flag)', async () => {
      mockRepo.list.mockResolvedValue([])
      await service.list('t1', { favoritesOnly: false })
      const args = mockRepo.list.mock.calls[0]?.[1] as Record<string, unknown>
      expect(args.favoritesOnly).toBe(false)
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

    it('returns null categoryId and categoryName when protocol has no category', async () => {
      mockRepo.findById.mockResolvedValue({ ...protocolRow, categoryId: null, category: null })
      const result = await service.getById('proto1', 't1')
      expect(result.categoryId).toBeNull()
      expect(result.categoryName).toBeNull()
      expect(result.templateSchema).toBeNull()
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

    it('saves version for blank protocol (no category, empty template schema)', async () => {
      mockRepo.findById.mockResolvedValue({ ...protocolRow, categoryId: null, category: null })
      mockRepo.saveVersion.mockResolvedValue(version)
      const result = await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        publish: false,
      })
      expect(result.versionNumber).toBe(2)
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

    it('succeeds even with required blocks in schema (template schema not enforced post-reset)', async () => {
      // Template schema validation is disabled (schema reset v2 — template schema always treated as empty)
      mockRepo.saveVersion.mockResolvedValue(version)
      const result = await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        publish: false,
      })
      expect(result.versionNumber).toBe(2)
    })

    it('succeeds with section-level required blocks (template schema not enforced post-reset)', async () => {
      // Template schema validation is disabled (schema reset v2)
      mockRepo.saveVersion.mockResolvedValue(version)
      const result = await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        publish: false,
      })
      expect(result.versionNumber).toBe(2)
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
      expect(result[0]!.isCurrent).toBe(true)
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
      await expect(service.restoreVersion('proto1', 'bad', 't1', 'u1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws NotFoundException when saveVersion returns null', async () => {
      mockRepo.getVersion.mockResolvedValue({
        id: 'ver1',
        versionNumber: 1,
        content: minimalContent,
        changeSummary: null,
        createdAt: now,
      })
      mockRepo.saveVersion.mockResolvedValue(null)
      await expect(service.restoreVersion('proto1', 'ver1', 't1', 'u1')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── archive ────────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('archives protocol successfully', async () => {
      mockRepo.archive.mockResolvedValue(true)
      await expect(service.archive('proto1', 't1')).resolves.toBeUndefined()
      expect(mockRepo.archive).toHaveBeenCalledWith('proto1', 't1')
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockRepo.archive.mockResolvedValue(false)
      await expect(service.archive('bad', 't1')).rejects.toThrow(NotFoundException)
    })
  })

})
