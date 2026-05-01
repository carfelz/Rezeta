import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OnboardingController } from '../onboarding.controller.js'

const mockService = {
  getStarters: vi.fn(),
  seedDefault: vi.fn(),
  seedCustom: vi.fn(),
}

const user = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner' as const,
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: null,
}

const authUser = {
  ...user,
  tenantSeededAt: '2026-01-01T00:00:00.000Z',
}

const starterCandidate = {
  clientId: 'starter-0',
  name: 'Intervención de emergencia',
  typeName: 'Emergencia',
  schema: { version: '1.0', blocks: [] },
}

describe('OnboardingController', () => {
  let controller: OnboardingController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new OnboardingController(mockService as never)
  })

  // ── getStarters ───────────────────────────────────────────────────────────

  it('getStarters: delegates to service.getStarters', () => {
    mockService.getStarters.mockReturnValue([starterCandidate])
    const result = controller.getStarters()
    expect(mockService.getStarters).toHaveBeenCalledOnce()
    expect(result).toEqual([starterCandidate])
  })

  it('getStarters: returns empty array when service returns empty', () => {
    mockService.getStarters.mockReturnValue([])
    const result = controller.getStarters()
    expect(result).toEqual([])
  })

  // ── seedDefault ───────────────────────────────────────────────────────────

  it('seedDefault: delegates to service.seedDefault with user.id and user.firebaseUid', async () => {
    mockService.seedDefault.mockResolvedValue(authUser)
    const result = await controller.seedDefault(user)
    expect(mockService.seedDefault).toHaveBeenCalledWith(user.id, user.firebaseUid)
    expect(result).toEqual(authUser)
  })

  it('seedDefault: returns authUser with tenantSeededAt set', async () => {
    mockService.seedDefault.mockResolvedValue(authUser)
    const result = await controller.seedDefault(user)
    expect(result.tenantSeededAt).toBeTruthy()
  })

  it('seedDefault: propagates service errors', async () => {
    mockService.seedDefault.mockRejectedValue(new Error('Already seeded'))
    await expect(controller.seedDefault(user)).rejects.toThrow('Already seeded')
  })

  // ── seedCustom ────────────────────────────────────────────────────────────

  it('seedCustom: delegates to service.seedCustom with firebaseUid and body', async () => {
    mockService.seedCustom.mockResolvedValue(authUser)
    const body = {
      templates: [{ clientId: 'c1', name: 'My Template', schema: { version: '1.0', blocks: [] } }],
      types: [{ name: 'My Type', templateClientId: 'c1' }],
    }
    const result = await controller.seedCustom(user, body)
    expect(mockService.seedCustom).toHaveBeenCalledWith(user.firebaseUid, body)
    expect(result).toEqual(authUser)
  })

  it('seedCustom: returns authUser with tenantSeededAt set', async () => {
    mockService.seedCustom.mockResolvedValue(authUser)
    const result = await controller.seedCustom(user, {
      templates: [{ clientId: 'c1', name: 'T', schema: {} }],
      types: [{ name: 'Ty', templateClientId: 'c1' }],
    })
    expect(result.tenantSeededAt).toBeTruthy()
  })

  it('seedCustom: propagates service errors', async () => {
    mockService.seedCustom.mockRejectedValue(new Error('Validation failed'))
    await expect(
      controller.seedCustom(user, {
        templates: [{ clientId: 'c1', name: 'T', schema: {} }],
        types: [{ name: 'Ty', templateClientId: 'c1' }],
      }),
    ).rejects.toThrow('Validation failed')
  })
})
