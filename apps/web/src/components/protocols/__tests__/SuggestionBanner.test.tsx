import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { ProtocolSuggestion } from '@rezeta/shared'
import { SuggestionBanner } from '../SuggestionBanner'

vi.mock('@/hooks/protocols/use-protocols', () => ({
  useProtocols: vi.fn(),
}))

import { useProtocols } from '@/hooks/protocols/use-protocols'

function makeSuggestion(overrides: Partial<ProtocolSuggestion> = {}): ProtocolSuggestion {
  return {
    id: 'sug-1',
    protocolId: 'proto-1',
    protocolVersionId: 'ver-1',
    tenantId: 'tenant-1',
    patternType: 'medication_dose_change',
    patternData: {},
    suggestedChanges: {},
    impactSummary: 'Cambiar dosis de Metformina a 1000mg',
    occurrenceCount: 8,
    totalUses: 10,
    occurrencePercentage: 80,
    status: 'pending',
    appliedAt: null,
    dismissedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMutation<T>(overrides: Partial<UseMutationResult<T, Error, string>> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
    ...overrides,
  } as unknown as UseMutationResult<T, Error, string>
}

function makeQuery(suggestions: ProtocolSuggestion[]): UseQueryResult<ProtocolSuggestion[], Error> {
  return {
    data: suggestions,
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as UseQueryResult<ProtocolSuggestion[], Error>
}

function setup(
  suggestions: ProtocolSuggestion[] = [makeSuggestion()],
  mutationOverrides: {
    apply?: Partial<UseMutationResult<void, Error, string>>
    createVariant?: Partial<UseMutationResult<void, Error, string>>
    dismiss?: Partial<UseMutationResult<void, Error, string>>
  } = {},
) {
  const applyMutation = makeMutation<void>(mutationOverrides.apply)
  const createVariantMutation = makeMutation<void>(mutationOverrides.createVariant)
  const dismissMutation = makeMutation<void>(mutationOverrides.dismiss)

  vi.mocked(useProtocols).mockReturnValue({
    useGetSuggestions: () => makeQuery(suggestions),
    useApplySuggestion: () => applyMutation,
    useCreateVariantFromSuggestion: () => createVariantMutation,
    useDismissSuggestion: () => dismissMutation,
  } as unknown as ReturnType<typeof useProtocols>)

  render(<SuggestionBanner protocolId="proto-1" />)

  return { applyMutation, createVariantMutation, dismissMutation }
}

describe('SuggestionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no pending suggestions', () => {
    setup([])
    expect(screen.queryByText('Sugerencia de optimización')).not.toBeInTheDocument()
  })

  it('renders nothing when all suggestions are dismissed', () => {
    setup([makeSuggestion({ status: 'dismissed' })])
    expect(screen.queryByText('Sugerencia de optimización')).not.toBeInTheDocument()
  })

  it('renders a card for each pending suggestion', () => {
    setup([
      makeSuggestion({ id: 'sug-1' }),
      makeSuggestion({ id: 'sug-2', impactSummary: 'Otra sugerencia' }),
    ])
    expect(screen.getAllByText('Sugerencia de optimización')).toHaveLength(2)
  })

  it('shows impact summary', () => {
    setup()
    expect(screen.getByText('Cambiar dosis de Metformina a 1000mg')).toBeInTheDocument()
  })

  it('shows occurrence stats', () => {
    setup()
    expect(screen.getByText('Detectado en 8/10 usos (80%)')).toBeInTheDocument()
  })

  it('calls apply mutation with suggestion id', () => {
    const { applyMutation } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambio' }))
    expect(applyMutation.mutate).toHaveBeenCalledWith('sug-1')
  })

  it('calls createVariant mutation with suggestion id', () => {
    const { createVariantMutation } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Crear variante' }))
    expect(createVariantMutation.mutate).toHaveBeenCalledWith('sug-1')
  })

  it('calls dismiss mutation with suggestion id', () => {
    const { dismissMutation } = setup()
    fireEvent.click(screen.getByText('Ignorar'))
    expect(dismissMutation.mutate).toHaveBeenCalledWith('sug-1')
  })

  it('shows applying label while apply is pending', () => {
    setup(undefined, { apply: { isPending: true } })
    expect(screen.getByRole('button', { name: 'Aplicando…' })).toBeInTheDocument()
  })

  it('shows creating label while createVariant is pending', () => {
    setup(undefined, { createVariant: { isPending: true } })
    expect(screen.getByRole('button', { name: 'Creando…' })).toBeInTheDocument()
  })

  it('apply button disabled while pending', () => {
    setup(undefined, { apply: { isPending: true } })
    expect(screen.getByRole('button', { name: 'Aplicando…' })).toBeDisabled()
  })
})
