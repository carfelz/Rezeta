import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationGate } from '../ConsultationGate'

const mockRecommendations = [
  {
    protocolId: 'proto-1',
    title: 'Protocolo HTA',
    categoryId: 'cat-1',
    categoryName: 'Cardiovascular',
    currentVersionNumber: 2,
    lastUsedAt: new Date().toISOString(),
    usageCount: 3,
    isMostProbable: true,
    source: 'patient-history' as const,
  },
  {
    protocolId: 'proto-2',
    title: 'Analgesia básica',
    categoryId: 'cat-2',
    categoryName: 'Medicación',
    currentVersionNumber: 1,
    lastUsedAt: null,
    usageCount: 0,
    isMostProbable: false,
    source: 'patient-history' as const,
  },
  {
    protocolId: 'proto-3',
    title: 'Fisioterapia lumbar',
    categoryId: 'cat-3',
    categoryName: 'Fisioterapia',
    currentVersionNumber: 1,
    lastUsedAt: null,
    usageCount: 0,
    isMostProbable: false,
    source: 'patient-history' as const,
  },
]

const mockProtocols = mockRecommendations.map((r) => ({
  id: r.protocolId,
  title: r.title,
  categoryId: r.categoryId,
  categoryName: r.categoryName,
  status: 'active',
  isFavorite: false,
  currentVersionNumber: r.currentVersionNumber,
  updatedAt: '',
  blockCount: 3,
}))

vi.mock('@/hooks/consultations/use-protocol-recommendations', () => ({
  useProtocolRecommendations: () => ({
    suggestions: mockRecommendations,
    isLoading: false,
  }),
}))

vi.mock('@/hooks/protocols/use-protocols', () => ({
  useProtocols: () => ({
    useGetProtocols: () => ({
      data: mockProtocols,
      isLoading: false,
    }),
  }),
}))

function renderGate(props: Partial<Parameters<typeof ConsultationGate>[0]> = {}): void {
  render(
    <ConsultationGate
      patientId="patient-1"
      patientFirstName="Isabel"
      locationId="location-1"
      onSelect={vi.fn()}
      isCreating={false}
      {...props}
    />,
  )
}

describe('ConsultationGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the step indicator', () => {
    renderGate()
    expect(screen.getByText(/Paso 1 de 2/)).toBeInTheDocument()
  })

  it('renders the heading "Comencemos con el motivo"', () => {
    renderGate()
    expect(screen.getByText('Comencemos con el motivo')).toBeInTheDocument()
  })

  it('renders the recent section label with patient first name', () => {
    renderGate({ patientFirstName: 'Isabel' })
    expect(screen.getByText(/Para Isabel/)).toBeInTheDocument()
  })

  it('renders recent protocol cards', () => {
    renderGate()
    expect(screen.getByText('Protocolo HTA')).toBeInTheDocument()
    expect(screen.getByText('Analgesia básica')).toBeInTheDocument()
    expect(screen.getByText('Fisioterapia lumbar')).toBeInTheDocument()
  })

  it('shows "Más probable" badge on first card', () => {
    renderGate()
    expect(screen.getByText('Más probable')).toBeInTheDocument()
  })

  it('renders search input with protocol count', () => {
    renderGate()
    expect(screen.getByPlaceholderText(/Buscar entre tus 3 protocolos/)).toBeInTheDocument()
  })

  it('renders specialty bucket grid', () => {
    renderGate()
    expect(screen.getByText('Cardiovascular')).toBeInTheDocument()
    expect(screen.getByText('Medicación')).toBeInTheDocument()
  })

  it('renders the dashed footer with continue without protocol button', () => {
    renderGate()
    expect(screen.getByText('¿No encaja ningún protocolo?')).toBeInTheDocument()
    expect(screen.getByText('Continuar sin protocolo')).toBeInTheDocument()
  })

  it('calls onSelect with null when "Continuar sin protocolo" clicked', () => {
    const onSelect = vi.fn()
    renderGate({ onSelect })
    fireEvent.click(screen.getByText('Continuar sin protocolo'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('calls onSelect with protocolId when recent card clicked', () => {
    const onSelect = vi.fn()
    renderGate({ onSelect })
    fireEvent.click(screen.getByText('Protocolo HTA').closest('button')!)
    expect(onSelect).toHaveBeenCalledWith('proto-1')
  })

  it('disables footer button when isCreating is true', () => {
    renderGate({ isCreating: true })
    expect(screen.getByText('Creando…').closest('button')).toBeDisabled()
  })

  it('shows search results when typing query of length >= 2', () => {
    renderGate()
    const search = screen.getByPlaceholderText(/Buscar entre tus 3 protocolos/)
    fireEvent.change(search, { target: { value: 'HTA' } })
    expect(screen.getAllByText('Protocolo HTA').length).toBeGreaterThan(0)
  })

  it('calls onSelect when search result clicked', () => {
    const onSelect = vi.fn()
    renderGate({ onSelect })
    const search = screen.getByPlaceholderText(/Buscar entre tus 3 protocolos/)
    fireEvent.change(search, { target: { value: 'Analgesia' } })
    const matches = screen.getAllByText('Analgesia básica')
    const searchResult = matches[matches.length - 1]
    fireEvent.click(searchResult.closest('button')!)
    expect(onSelect).toHaveBeenCalledWith('proto-2')
  })
})
