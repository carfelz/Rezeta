import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolsController } from '../protocols.controller.js'

const mockService = {
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  rename: vi.fn(),
  saveVersion: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  restoreVersion: vi.fn(),
  setFavorite: vi.fn(),
}

const now = new Date('2026-01-01T00:00:00Z')

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

const protocol = {
  id: 'p1',
  title: 'Anaphylaxis',
  status: 'draft',
  isFavorite: false,
  typeId: 'type1',
  currentVersion: null,
  type: { id: 'type1', name: 'Emergencia' },
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}

const versionSummary = {
  id: 'v1',
  versionNumber: 1,
  changeSummary: null,
  createdAt: now.toISOString(),
}

const versionDetail = {
  id: 'v1',
  versionNumber: 1,
  content: { version: '1.0', blocks: [] },
  changeSummary: null,
  createdAt: now.toISOString(),
}

describe('ProtocolsController', () => {
  let controller: ProtocolsController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new ProtocolsController(mockService as never)
  })

  // ── list ───────────────────────────────────────────────────────────────────

  it('list: delegates to service.list', async () => {
    mockService.list.mockResolvedValue([protocol])
    const result = await controller.list('t1', { favoritesOnly: false })
    expect(mockService.list).toHaveBeenCalledWith('t1', { favoritesOnly: false })
    expect(result).toEqual([protocol])
  })

  // ── create ─────────────────────────────────────────────────────────────────

  it('create: delegates to service.create with tenantId + userId', async () => {
    mockService.create.mockResolvedValue(protocol)
    const dto = { title: 'Anaphylaxis', typeId: 'type1' }
    const result = await controller.create(dto, 't1', user)
    expect(mockService.create).toHaveBeenCalledWith('t1', 'u1', dto)
    expect(result).toEqual(protocol)
  })

  // ── getOne ─────────────────────────────────────────────────────────────────

  it('getOne: delegates to service.getById', async () => {
    mockService.getById.mockResolvedValue(protocol)
    const result = await controller.getOne('p1', 't1')
    expect(mockService.getById).toHaveBeenCalledWith('p1', 't1')
    expect(result).toEqual(protocol)
  })

  // ── rename ─────────────────────────────────────────────────────────────────

  it('rename: delegates to service.rename', async () => {
    mockService.rename.mockResolvedValue({ id: 'p1', title: 'New Title' })
    const result = await controller.rename('p1', { title: 'New Title' }, 't1')
    expect(mockService.rename).toHaveBeenCalledWith('p1', 't1', { title: 'New Title' })
    expect(result).toEqual({ id: 'p1', title: 'New Title' })
  })

  // ── saveVersion ────────────────────────────────────────────────────────────

  it('saveVersion: delegates to service.saveVersion with userId', async () => {
    mockService.saveVersion.mockResolvedValue(versionSummary)
    const dto = {
      content: { version: '1.0', blocks: [] },
      changeSummary: 'Updated doses',
      publish: false,
    }
    const result = await controller.saveVersion('p1', dto, 't1', user)
    expect(mockService.saveVersion).toHaveBeenCalledWith('p1', 't1', 'u1', dto)
    expect(result).toEqual(versionSummary)
  })

  // ── listVersions ───────────────────────────────────────────────────────────

  it('listVersions: delegates to service.listVersions', async () => {
    mockService.listVersions.mockResolvedValue([versionSummary])
    const result = await controller.listVersions('p1', 't1')
    expect(mockService.listVersions).toHaveBeenCalledWith('p1', 't1')
    expect(result).toEqual([versionSummary])
  })

  // ── getVersion ─────────────────────────────────────────────────────────────

  it('getVersion: delegates to service.getVersion', async () => {
    mockService.getVersion.mockResolvedValue(versionDetail)
    const result = await controller.getVersion('p1', 'v1', 't1')
    expect(mockService.getVersion).toHaveBeenCalledWith('p1', 'v1', 't1')
    expect(result).toEqual(versionDetail)
  })

  // ── restoreVersion ─────────────────────────────────────────────────────────

  it('restoreVersion: delegates to service.restoreVersion with userId', async () => {
    mockService.restoreVersion.mockResolvedValue(versionSummary)
    const result = await controller.restoreVersion('p1', 'v1', 't1', user)
    expect(mockService.restoreVersion).toHaveBeenCalledWith('p1', 'v1', 't1', 'u1')
    expect(result).toEqual(versionSummary)
  })

  // ── addFavorite ────────────────────────────────────────────────────────────

  it('addFavorite: calls service.setFavorite(id, tenantId, true)', async () => {
    mockService.setFavorite.mockResolvedValue(undefined)
    await controller.addFavorite('p1', 't1')
    expect(mockService.setFavorite).toHaveBeenCalledWith('p1', 't1', true)
  })

  // ── removeFavorite ─────────────────────────────────────────────────────────

  it('removeFavorite: calls service.setFavorite(id, tenantId, false)', async () => {
    mockService.setFavorite.mockResolvedValue(undefined)
    await controller.removeFavorite('p1', 't1')
    expect(mockService.setFavorite).toHaveBeenCalledWith('p1', 't1', false)
  })
})
