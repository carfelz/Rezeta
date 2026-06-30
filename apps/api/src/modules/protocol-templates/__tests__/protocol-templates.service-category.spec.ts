import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import { ProtocolTemplatesService } from '../protocol-templates.service.js'

const repo = {
  findAllWithLockInfo: vi.fn(),
  findById: vi.fn(),
  findCategory: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}

const baseTemplate = {
  id: '33333333-3333-3333-3333-333333333333',
  tenantId: '44444444-4444-4444-4444-444444444444',
  name: 'T',
  description: null,
  suggestedSpecialty: null,
  categoryId: '22222222-2222-2222-2222-222222222222',
  category: { id: '22222222-2222-2222-2222-222222222222', name: 'Emergencias', color: '#EF4444' },
  schema: { version: '1.0', blocks: [] },
  isSeeded: false,
  createdAt: new Date('2026-06-29T00:00:00Z'),
  updatedAt: new Date('2026-06-29T00:00:00Z'),
}

describe('ProtocolTemplatesService category', () => {
  let service: ProtocolTemplatesService
  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolTemplatesService(repo as never)
  })

  it('throws when categoryId does not exist in tenant', async () => {
    repo.findCategory.mockResolvedValue(null)
    await expect(
      service.create('44444444-4444-4444-4444-444444444444', {
        name: 'T', categoryId: 'bad', schema: { version: '1.0', blocks: [] },
      } as never, 'user'),
    ).rejects.toMatchObject({ response: { code: ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND } })
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('maps category into the DTO', async () => {
    repo.findCategory.mockResolvedValue(baseTemplate.category)
    repo.create.mockResolvedValue(baseTemplate)
    const dto = await service.create('44444444-4444-4444-4444-444444444444', {
      name: 'T', categoryId: baseTemplate.categoryId, schema: { version: '1.0', blocks: [] },
    } as never, 'user')
    expect(dto.categoryId).toBe(baseTemplate.categoryId)
    expect(dto.category).toEqual(baseTemplate.category)
  })

  it('throws NotFoundException (not BadRequestException) for missing category', async () => {
    repo.findCategory.mockResolvedValue(null)
    await expect(
      service.create('44444444-4444-4444-4444-444444444444', {
        name: 'T', categoryId: 'bad', schema: { version: '1.0', blocks: [] },
      } as never, 'user'),
    ).rejects.toThrow(NotFoundException)
  })

  it('validates categoryId in update when provided', async () => {
    repo.findById.mockResolvedValue(baseTemplate)
    repo.findCategory.mockResolvedValue(null)
    await expect(
      service.update(
        baseTemplate.id,
        baseTemplate.tenantId,
        { categoryId: 'nonexistent' },
      ),
    ).rejects.toMatchObject({ response: { code: ErrorCode.PROTOCOL_CATEGORY_NOT_FOUND } })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('skips category validation in update when categoryId is not provided', async () => {
    repo.findById.mockResolvedValue(baseTemplate)
    repo.update.mockResolvedValue({ ...baseTemplate, name: 'Updated' })
    const dto = await service.update(baseTemplate.id, baseTemplate.tenantId, { name: 'Updated' })
    expect(repo.findCategory).not.toHaveBeenCalled()
    expect(dto.name).toBe('Updated')
  })
})
