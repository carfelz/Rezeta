import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HistoriaTab } from '../HistoriaTab'
import * as consultationHooks from '@/hooks/consultations/use-consultations'
import * as recordHooks from '@/hooks/consultations/use-consultation-record'

vi.mock('@/hooks/consultations/use-consultations')
vi.mock('@/hooks/consultations/use-consultation-record')

const consultations = [
  {
    id: 'c1',
    status: 'signed',
    startedAt: '2026-07-06T10:42:00Z',
    locationName: 'Centro Médico Naco',
    doctorName: 'Dra. Herrera',
    protocolUsages: [],
  },
  {
    id: 'c2',
    status: 'open',
    startedAt: '2026-07-05T09:00:00Z',
    locationName: 'Centro Médico Naco',
    doctorName: 'Dra. Herrera',
    protocolUsages: [],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consultationHooks.usePatientConsultations).mockReturnValue({
    data: consultations,
    isLoading: false,
  } as never)
  vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
    data: null,
    isLoading: false,
    isSuccess: true,
  } as never)
  const stub = { mutate: vi.fn(), isPending: false } as never
  vi.mocked(recordHooks.useEnsureRecord).mockReturnValue(stub)
  vi.mocked(recordHooks.useUpdateRecordSections).mockReturnValue(stub)
  vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(stub)
  vi.mocked(recordHooks.useSignRecord).mockReturnValue(stub)
})

describe('HistoriaTab', () => {
  it('lists consultations with a status chip per row', () => {
    render(<HistoriaTab patientId="p1" />)
    expect(screen.getByText('Expediente')).toBeInTheDocument()
    // open consultation without a record shows "Sin historia"
    const list = screen.getByTestId('historia-consultation-list')
    expect(within(list).getByText('Sin historia')).toBeInTheDocument()
  })

  it('selects the newest signed consultation by default and renders its document pane', () => {
    render(<HistoriaTab patientId="p1" />)
    expect(vi.mocked(recordHooks.useConsultationRecord)).toHaveBeenCalledWith('c1')
  })

  it('shows the loading state while consultations are loading', () => {
    vi.mocked(consultationHooks.usePatientConsultations).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never)
    render(<HistoriaTab patientId="p1" />)
    expect(screen.queryByText('Expediente')).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no consultations', () => {
    vi.mocked(consultationHooks.usePatientConsultations).mockReturnValue({
      data: [],
      isLoading: false,
    } as never)
    render(<HistoriaTab patientId="p1" />)
    expect(screen.getByText('Selecciona una consulta para ver su historia médica.')).toBeInTheDocument()
  })

  it('switches the active consultation when a row is clicked', () => {
    render(<HistoriaTab patientId="p1" />)
    fireEvent.click(screen.getByText(/5 jul/i))
    expect(vi.mocked(recordHooks.useConsultationRecord)).toHaveBeenCalledWith('c2')
  })

  it('falls back to the first consultation when none are signed', () => {
    vi.mocked(consultationHooks.usePatientConsultations).mockReturnValue({
      data: [{ ...consultations[1] }, { ...consultations[1], id: 'c3' }],
      isLoading: false,
    } as never)
    render(<HistoriaTab patientId="p1" />)
    expect(vi.mocked(recordHooks.useConsultationRecord)).toHaveBeenCalledWith('c2')
  })
})
