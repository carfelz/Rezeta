/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolSuggestionsController } from '../protocol-suggestions.controller.js'
import type { ProtocolSuggestionsService } from '../protocol-suggestions.service.js'
import type { AuthUser, ProtocolSuggestion } from '@rezeta/shared'

const mockUser: AuthUser = { id: 'user-1', tenantId: 'tenant-1', email: 'doc@test.com', role: 'owner' }
const tenantId = 'tenant-1'
const protocolId = 'proto-1'
const suggestionId = 'sug-1'

const mockSuggestion: ProtocolSuggestion = {
  id: suggestionId,
  protocolId,
  protocolVersionId: 'ver-1',
  tenantId,
  patternType: 'medication_dose_change',
  patternData: {},
  suggestedChanges: {},
  impactSummary: 'Test',
  occurrenceCount: 5,
  totalUses: 6,
  occurrencePercentage: 83.33,
  status: 'pending',
  appliedAt: null,
  dismissedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('ProtocolSuggestionsController', () => {
  let controller: ProtocolSuggestionsController
  let svc: ProtocolSuggestionsService

  beforeEach(() => {
    svc = {
      list: vi.fn(),
      apply: vi.fn(),
      createVariant: vi.fn(),
      dismiss: vi.fn(),
    } as unknown as ProtocolSuggestionsService
    controller = new ProtocolSuggestionsController(svc)
  })

  it('list delegates to service', async () => {
    vi.mocked(svc.list).mockResolvedValue([mockSuggestion])
    const result = await controller.list(tenantId, protocolId)
    expect(svc.list).toHaveBeenCalledWith(protocolId, tenantId)
    expect(result).toHaveLength(1)
  })

  it('apply delegates to service', async () => {
    vi.mocked(svc.apply).mockResolvedValue({ ...mockSuggestion, status: 'applied' })
    const result = await controller.apply(tenantId, mockUser, protocolId, suggestionId)
    expect(svc.apply).toHaveBeenCalledWith(protocolId, suggestionId, tenantId, 'user-1')
    expect(result.status).toBe('applied')
  })

  it('createVariant delegates to service', async () => {
    vi.mocked(svc.createVariant).mockResolvedValue({ ...mockSuggestion, status: 'applied' })
    const result = await controller.createVariant(tenantId, mockUser, protocolId, suggestionId)
    expect(svc.createVariant).toHaveBeenCalledWith(protocolId, suggestionId, tenantId, 'user-1')
    expect(result.status).toBe('applied')
  })

  it('dismiss delegates to service', async () => {
    vi.mocked(svc.dismiss).mockResolvedValue(undefined)
    await controller.dismiss(tenantId, protocolId, suggestionId)
    expect(svc.dismiss).toHaveBeenCalledWith(protocolId, suggestionId, tenantId)
  })
})
