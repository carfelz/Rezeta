import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConsultationGate } from '../ConsultationGate'

const doctorHistoryRecommendations = [
  {
    protocolId: 'proto-9',
    title: 'Asma agudizada',
    typeId: 'type-9',
    typeName: 'Respiratorio',
    currentVersionNumber: 1,
    lastUsedAt: null,
    usageCount: 0,
    isMostProbable: false,
    source: 'doctor-history' as const,
  },
]

const doctorHistoryProtocols = doctorHistoryRecommendations.map((r) => ({
  id: r.protocolId,
  title: r.title,
  typeId: r.typeId,
  typeName: r.typeName,
  status: 'active',
  isFavorite: false,
  currentVersionNumber: r.currentVersionNumber,
  updatedAt: '',
  blockCount: 3,
}))

vi.mock('@/hooks/consultations/use-protocol-suggestions', () => ({
  useProtocolSuggestions: () => ({
    suggestions: doctorHistoryRecommendations,
    isLoading: false,
  }),
}))

vi.mock('@/hooks/protocols/use-protocols', () => ({
  useProtocols: () => ({
    useGetProtocols: () => ({ data: doctorHistoryProtocols, isLoading: false }),
  }),
}))

describe('ConsultationGate — recommendation source semantics', () => {
  it('renders generic heading + Tu favorito subtitle when source is doctor-history', () => {
    render(
      <ConsultationGate
        patientId="patient-1"
        patientFirstName="Isabel"
        locationId="location-1"
        onSelect={vi.fn()}
        isCreating={false}
      />,
    )
    // No false patient-scoped claim
    expect(screen.queryByText(/Para Isabel/)).not.toBeInTheDocument()
    expect(screen.queryByText(/sus consultas anteriores/)).not.toBeInTheDocument()
    expect(screen.getByText(/Protocolos sugeridos/)).toBeInTheDocument()
    // Doctor-history rows show "Tu favorito · vN"
    expect(screen.getByText(/Tu favorito/)).toBeInTheDocument()
    // No MÁS PROBABLE badge for doctor-history rows
    expect(screen.queryByText('Más probable')).not.toBeInTheDocument()
  })
})
