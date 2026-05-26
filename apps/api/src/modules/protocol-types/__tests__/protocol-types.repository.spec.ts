import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolTypesRepository } from '../protocol-types.repository.js'

// ProtocolType has been replaced by ProtocolCategory (schema reset v2).
// The repository is now a stub retained for NestJS module compatibility.
// These tests verify the stub contract (no Prisma calls, predictable returns).

const TENANT_ID = 'tenant-1'
const TYPE_ID = 'type-1'
const TEMPLATE_ID = 'tmpl-1'

const mockPrisma = {
  protocolTemplate: {
    count: vi.fn(),
  },
}

describe('ProtocolTypesRepository (stub — schema reset v2)', () => {
  let repo: ProtocolTypesRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ProtocolTypesRepository(mockPrisma as never)
  })

  // ── findAll (stub) ─────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns empty array (stub)', async () => {
      const result = await repo.findAll(TENANT_ID)
      expect(result).toEqual([])
    })

    it('accepts tenantId without error', async () => {
      await expect(repo.findAll(TENANT_ID)).resolves.not.toThrow()
    })
  })

  // ── findById (stub) ────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns null (stub)', async () => {
      const result = await repo.findById(TYPE_ID, TENANT_ID)
      expect(result).toBeNull()
    })
  })

  // ── findByIdWithTemplate (stub) ────────────────────────────────────────────

  describe('findByIdWithTemplate', () => {
    it('returns null (stub)', async () => {
      const result = await repo.findByIdWithTemplate(TYPE_ID, TENANT_ID)
      expect(result).toBeNull()
    })
  })

  // ── existsByName (stub) ────────────────────────────────────────────────────

  describe('existsByName', () => {
    it('returns false (stub)', async () => {
      const result = await repo.existsByName('Emergencia', TENANT_ID)
      expect(result).toBe(false)
    })

    it('returns false even with excludeId (stub)', async () => {
      const result = await repo.existsByName('Emergencia', TENANT_ID, TYPE_ID)
      expect(result).toBe(false)
    })
  })

  // ── templateBelongsToTenant (live — queries protocolTemplate) ─────────────

  describe('templateBelongsToTenant', () => {
    it('returns false when count is 0', async () => {
      mockPrisma.protocolTemplate.count.mockResolvedValue(0)
      const result = await repo.templateBelongsToTenant(TEMPLATE_ID, TENANT_ID)
      expect(result).toBe(false)
    })

    it('returns true when count > 0', async () => {
      mockPrisma.protocolTemplate.count.mockResolvedValue(1)
      const result = await repo.templateBelongsToTenant(TEMPLATE_ID, TENANT_ID)
      expect(result).toBe(true)
    })

    it('queries protocolTemplate with id, tenantId, deletedAt null', async () => {
      mockPrisma.protocolTemplate.count.mockResolvedValue(0)
      await repo.templateBelongsToTenant(TEMPLATE_ID, TENANT_ID)
      expect(mockPrisma.protocolTemplate.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: TEMPLATE_ID,
            tenantId: TENANT_ID,
            deletedAt: null,
          }),
        }),
      )
    })
  })

  // ── create (stub — rejects) ────────────────────────────────────────────────

  describe('create', () => {
    it('rejects with ProtocolType replacement error (stub)', async () => {
      await expect(repo.create(TENANT_ID, 'Emergencia', TEMPLATE_ID)).rejects.toThrow(
        'ProtocolType has been replaced by ProtocolCategory',
      )
    })
  })

  // ── update (stub — rejects) ────────────────────────────────────────────────

  describe('update', () => {
    it('rejects with ProtocolType replacement error (stub)', async () => {
      await expect(repo.update(TYPE_ID, TENANT_ID, 'Urgencias')).rejects.toThrow(
        'ProtocolType has been replaced by ProtocolCategory',
      )
    })
  })

  // ── softDelete (stub — resolves) ───────────────────────────────────────────

  describe('softDelete', () => {
    it('resolves to undefined (stub)', async () => {
      const result = await repo.softDelete(TYPE_ID, TENANT_ID)
      expect(result).toBeUndefined()
    })
  })
})
