import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ProtocolsService } from '../protocols.service.js'

const now = new Date('2026-01-01T00:00:00Z')
const minimalSchema = { version: '1.0', blocks: [] }
const minimalContent = { version: '1.0', template_version: '1.0', blocks: [] }

const protocolRow = (status = 'draft') => ({
  id: 'proto1',
  title: 'Test Protocol',
  status,
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
})

const versionRow = (num: number) => ({
  id: `ver${num}`,
  versionNumber: num,
  changeSummary: null,
  createdAt: now,
})

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

describe('ProtocolsService — saveVersion publish flow', () => {
  let service: ProtocolsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolsService(mockRepo as never, mockTypesRepo as never)
  })

  // ── publish: false keeps status as draft ───────────────────────────────────

  describe('saveVersion with publish:false', () => {
    it('calls repo.saveVersion with publish:false', async () => {
      mockRepo.findById.mockResolvedValue(protocolRow('draft'))
      mockRepo.saveVersion.mockResolvedValue(versionRow(2))

      await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        publish: false,
      })

      expect(mockRepo.saveVersion).toHaveBeenCalledWith(expect.objectContaining({ publish: false }))
    })

    it('returns version number 2 on second save', async () => {
      mockRepo.findById.mockResolvedValue(protocolRow('draft'))
      mockRepo.saveVersion.mockResolvedValue(versionRow(2))

      const result = await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        publish: false,
      })

      expect(result.versionNumber).toBe(2)
    })
  })

  // ── publish: true transitions status to active ─────────────────────────────

  describe('saveVersion with publish:true', () => {
    it('calls repo.saveVersion with publish:true', async () => {
      mockRepo.findById.mockResolvedValue(protocolRow('draft'))
      mockRepo.saveVersion.mockResolvedValue(versionRow(2))

      await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        publish: true,
      })

      expect(mockRepo.saveVersion).toHaveBeenCalledWith(expect.objectContaining({ publish: true }))
    })

    it('returns correct version number on publish', async () => {
      mockRepo.findById.mockResolvedValue(protocolRow('draft'))
      mockRepo.saveVersion.mockResolvedValue(versionRow(3))

      const result = await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
        publish: true,
      })

      expect(result.versionNumber).toBe(3)
    })
  })

  // ── omitting publish defaults to falsy ────────────────────────────────────

  describe('saveVersion without publish field', () => {
    it('passes undefined publish to repo when field omitted', async () => {
      mockRepo.findById.mockResolvedValue(protocolRow('draft'))
      mockRepo.saveVersion.mockResolvedValue(versionRow(2))

      await service.saveVersion('proto1', 't1', 'u1', {
        content: minimalContent,
      })

      const call = mockRepo.saveVersion.mock.calls[0][0] as { publish?: boolean }
      expect(call.publish).toBeFalsy()
    })
  })

  // ── 404 for unknown protocol ──────────────────────────────────────────────

  describe('saveVersion 404', () => {
    it('throws NotFoundException for unknown protocol', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(
        service.saveVersion('00000000-0000-0000-0000-000000000000', 't1', 'u1', {
          content: minimalContent,
          publish: false,
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ── GET versions list ─────────────────────────────────────────────────────

  describe('listVersions', () => {
    it('returns version history in descending order', async () => {
      mockRepo.findById.mockResolvedValue(protocolRow())
      mockRepo.listVersions.mockResolvedValue([versionRow(3), versionRow(2), versionRow(1)])

      const result = await service.listVersions('proto1', 't1')
      expect(result).toHaveLength(3)
      expect(result[0]!.versionNumber).toBe(3)
      expect(result[1]!.versionNumber).toBe(2)
      expect(result[2]!.versionNumber).toBe(1)
    })

    it('throws NotFoundException for unknown protocol', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.listVersions('bad-id', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── validateRequiredBlocks — nested placeholder coverage ───────────────────

  describe('saveVersion — required placeholder_block in section (nested check)', () => {
    it('throws BadRequestException when section is present but required placeholder child is absent', async () => {
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

      // Content has the section 'sec1' (so top-level required check passes),
      // with a child block other than 'blk_child' (covers collectAllIds recursion).
      // 'blk_child' is absent → inner placeholder_blocks loop throws.
      const contentWithSectionButMissingChild = {
        version: '1.0',
        template_version: '1.0',
        blocks: [
          {
            id: 'sec1',
            type: 'section' as const,
            title: 'Assessment',
            blocks: [{ id: 'blk_other', type: 'text' as const, content: 'Present' }],
          },
        ],
      }

      mockRepo.findById.mockResolvedValue({
        ...protocolRow(),
        type: { id: 'type1', name: 'Emergencia', template: { schema: schemaWithRequiredChild } },
      })
      mockRepo.saveVersion.mockResolvedValue(versionRow(2))

      await expect(
        service.saveVersion('proto1', 't1', 'u1', {
          content: contentWithSectionButMissingChild,
          publish: false,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('passes when section and all required child blocks are present in content', async () => {
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

      const contentWithAllRequired = {
        version: '1.0',
        template_version: '1.0',
        blocks: [
          {
            id: 'sec1',
            type: 'section' as const,
            title: 'Assessment',
            blocks: [{ id: 'blk_child', type: 'text' as const, content: 'Present' }],
          },
        ],
      }

      mockRepo.findById.mockResolvedValue({
        ...protocolRow(),
        type: { id: 'type1', name: 'Emergencia', template: { schema: schemaWithRequiredChild } },
      })
      mockRepo.saveVersion.mockResolvedValue(versionRow(2))

      const result = await service.saveVersion('proto1', 't1', 'u1', {
        content: contentWithAllRequired,
        publish: false,
      })
      expect(result.versionNumber).toBe(2)
    })
  })
})
