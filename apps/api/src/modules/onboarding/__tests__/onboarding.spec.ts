import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException } from '@nestjs/common'
import { OnboardingService } from '../onboarding.service.js'

// Supplement onboarding.service.spec.ts with gap coverage:
// - TENANT_ALREADY_SEEDED conflict propagation
// - Multiple templates + types seeding call counts
// - Return shape (tenantSeededAt truthy after seeding)

const mockSeeder = {
  seedDefault: vi.fn(),
  seedCustom: vi.fn(),
}

const mockAuthService = {
  toAuthUser: vi.fn(),
}

const mockAuthRepository = {
  findByFirebaseUid: vi.fn(),
}

const dbUser = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner',
  specialty: null,
  licenseNumber: null,
  tenant: { seededAt: new Date('2026-01-01') },
}

const authUser = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner' as const,
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: '2026-01-01T00:00:00.000Z',
}

describe('OnboardingService — conflict and multi-template coverage', () => {
  let service: OnboardingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new OnboardingService(
      mockSeeder as never,
      mockAuthService as never,
      mockAuthRepository as never,
    )
    mockAuthRepository.findByFirebaseUid.mockResolvedValue(dbUser)
    mockAuthService.toAuthUser.mockReturnValue(authUser)
    mockSeeder.seedDefault.mockResolvedValue(undefined)
    mockSeeder.seedCustom.mockResolvedValue(undefined)
  })

  // ── seedDefault ──────────────────────────────────────────────────────────────

  describe('seedDefault', () => {
    it('returns AuthUser with truthy tenantSeededAt', async () => {
      const result = await service.seedDefault('u1', 'fb1')
      expect(result.tenantSeededAt).toBeTruthy()
      expect(typeof result.tenantSeededAt).toBe('string')
      expect(result.tenantId).toBe('t1')
    })

    it('propagates TENANT_ALREADY_SEEDED ConflictException from seeder', async () => {
      mockSeeder.seedDefault.mockRejectedValue(
        new ConflictException({ code: 'TENANT_ALREADY_SEEDED' }),
      )
      await expect(service.seedDefault('u1', 'fb1')).rejects.toThrow(ConflictException)
      await expect(service.seedDefault('u1', 'fb1')).rejects.toMatchObject({
        response: { code: 'TENANT_ALREADY_SEEDED' },
      })
    })
  })

  // ── seedCustom ────────────────────────────────────────────────────────────

  describe('seedCustom', () => {
    it('returns AuthUser with truthy tenantSeededAt', async () => {
      const result = await service.seedCustom('fb1', {
        templates: [
          { clientId: 'c1', name: 'My Template', schema: { version: '1.0', blocks: [] } },
        ],
        types: [{ name: 'My Type', templateClientId: 'c1' }],
      })
      expect(result.tenantSeededAt).toBeTruthy()
    })

    it('propagates TENANT_ALREADY_SEEDED ConflictException from seeder', async () => {
      mockSeeder.seedCustom.mockRejectedValue(
        new ConflictException({ code: 'TENANT_ALREADY_SEEDED' }),
      )
      await expect(
        service.seedCustom('fb1', {
          templates: [{ clientId: 'c1', name: 'T', schema: {} }],
          types: [{ name: 'Ty', templateClientId: 'c1' }],
        }),
      ).rejects.toThrow(ConflictException)
      await expect(
        service.seedCustom('fb1', {
          templates: [{ clientId: 'c1', name: 'T', schema: {} }],
          types: [{ name: 'Ty', templateClientId: 'c1' }],
        }),
      ).rejects.toMatchObject({ response: { code: 'TENANT_ALREADY_SEEDED' } })
    })

    it('passes all templates and types to seeder (multiple)', async () => {
      await service.seedCustom('fb1', {
        templates: [
          { clientId: 'a', name: 'Template A', schema: { version: '1.0', blocks: [] } },
          { clientId: 'b', name: 'Template B', schema: { version: '1.0', blocks: [] } },
          { clientId: 'c', name: 'Template C', schema: { version: '1.0', blocks: [] } },
        ],
        types: [
          { name: 'Type A', templateClientId: 'a' },
          { name: 'Type B', templateClientId: 'b' },
        ],
      })

      const [, templates, types] = mockSeeder.seedCustom.mock.calls[0] as [
        string,
        unknown[],
        unknown[],
      ]
      expect(templates).toHaveLength(3)
      expect(types).toHaveLength(2)
    })
  })
})
