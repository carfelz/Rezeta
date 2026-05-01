import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { OnboardingService } from '../onboarding.service.js'

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

describe('OnboardingService', () => {
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

  // ── getStarters ────────────────────────────────────────────────────────────

  describe('getStarters', () => {
    it('returns 5 starter candidates for es locale', () => {
      const starters = service.getStarters('es')
      expect(starters).toHaveLength(5)
    })

    it('returns 5 starter candidates for en locale', () => {
      const starters = service.getStarters('en')
      expect(starters).toHaveLength(5)
    })

    it('each candidate has clientId, name, typeName, schema', () => {
      const starters = service.getStarters()
      for (const s of starters) {
        expect(s).toHaveProperty('clientId')
        expect(s).toHaveProperty('name')
        expect(s).toHaveProperty('typeName')
        expect(s).toHaveProperty('schema')
      }
    })

    it('defaults to es when no locale given', () => {
      const es = service.getStarters()
      const esExplicit = service.getStarters('es')
      expect(es.map((s) => s.name)).toEqual(esExplicit.map((s) => s.name))
    })
  })

  // ── seedDefault ────────────────────────────────────────────────────────────

  describe('seedDefault', () => {
    it('looks up user by firebaseUid, seeds, then refreshes', async () => {
      const result = await service.seedDefault('u1', 'fb1')
      expect(mockAuthRepository.findByFirebaseUid).toHaveBeenCalledWith('fb1')
      expect(mockSeeder.seedDefault).toHaveBeenCalledWith('t1', 'es')
      expect(result).toEqual(authUser)
    })

    it('throws InternalServerErrorException when user not found initially', async () => {
      mockAuthRepository.findByFirebaseUid.mockResolvedValueOnce(null)
      await expect(service.seedDefault('u1', 'fb1')).rejects.toThrow(InternalServerErrorException)
    })

    it('throws InternalServerErrorException when user not found after seeding', async () => {
      mockAuthRepository.findByFirebaseUid.mockResolvedValueOnce(dbUser).mockResolvedValueOnce(null)
      await expect(service.seedDefault('u1', 'fb1')).rejects.toThrow(InternalServerErrorException)
    })

    it('passes locale to seeder', async () => {
      await service.seedDefault('u1', 'fb1', 'en')
      expect(mockSeeder.seedDefault).toHaveBeenCalledWith('t1', 'en')
    })
  })

  // ── seedCustom ─────────────────────────────────────────────────────────────

  describe('seedCustom', () => {
    const validInput = {
      templates: [{ clientId: 'c1', name: 'Template 1', schema: { version: '1.0', blocks: [] } }],
      types: [{ name: 'Type 1', templateClientId: 'c1' }],
    }

    it('seeds with resolved tenantId and returns refreshed user', async () => {
      const result = await service.seedCustom('fb1', validInput)
      expect(mockSeeder.seedCustom).toHaveBeenCalledWith(
        't1',
        expect.arrayContaining([expect.objectContaining({ clientId: 'c1' })]),
        validInput.types,
      )
      expect(result).toEqual(authUser)
    })

    it('throws BadRequestException when type references unknown templateClientId', async () => {
      const badInput = {
        templates: [{ clientId: 'c1', name: 'T', schema: {} }],
        types: [{ name: 'Bad', templateClientId: 'nonexistent' }],
      }
      await expect(service.seedCustom('fb1', badInput)).rejects.toThrow(BadRequestException)
      expect(mockSeeder.seedCustom).not.toHaveBeenCalled()
    })

    it('throws InternalServerErrorException when user not found initially', async () => {
      mockAuthRepository.findByFirebaseUid.mockResolvedValueOnce(null)
      await expect(service.seedCustom('fb1', validInput)).rejects.toThrow(
        InternalServerErrorException,
      )
    })

    it('throws InternalServerErrorException when user not found after seeding', async () => {
      mockAuthRepository.findByFirebaseUid.mockResolvedValueOnce(dbUser).mockResolvedValueOnce(null)
      await expect(service.seedCustom('fb1', validInput)).rejects.toThrow(
        InternalServerErrorException,
      )
    })

    it('passes suggestedSpecialty when present in template', async () => {
      const withSpecialty = {
        templates: [{ clientId: 'c1', name: 'T', suggestedSpecialty: 'cardiology', schema: {} }],
        types: [{ name: 'Ty', templateClientId: 'c1' }],
      }
      await service.seedCustom('fb1', withSpecialty)
      const callArgs = mockSeeder.seedCustom.mock.calls[0] as [
        string,
        Array<{ suggestedSpecialty?: string }>,
      ]
      expect(callArgs[1][0]).toHaveProperty('suggestedSpecialty', 'cardiology')
    })

    it('omits suggestedSpecialty when not present in template', async () => {
      await service.seedCustom('fb1', validInput)
      const callArgs = mockSeeder.seedCustom.mock.calls[0] as [
        string,
        Array<Record<string, unknown>>,
      ]
      expect(callArgs[1][0]).not.toHaveProperty('suggestedSpecialty')
    })
  })
})
