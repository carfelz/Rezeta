import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ProtocolPanel } from '../ProtocolPanel'
import type { ConsultationWithDetails, ConsultationProtocolUsage } from '@rezeta/shared'

// ─── Mock all hooks used by ProtocolPanel ──────────────────────────────────────

const mockMutate = vi.fn()
const mockMutation = { mutate: mockMutate, isPending: false }

vi.mock('@/hooks/consultations/use-consultations', () => ({
  useAddProtocolUsage: () => mockMutation,
  useRemoveProtocolUsage: () => mockMutation,
  useSkipStep: () => mockMutation,
  useAddOffProtocolNote: () => mockMutation,
}))

vi.mock('../ProtocolBar', () => ({
  ProtocolBar: () => <div data-testid="protocol-bar" />,
}))

vi.mock('@/components/protocols/ProtocolPickerModal', () => ({
  ProtocolPickerModal: () => null,
}))

vi.mock('../ConsultationModals', () => ({
  ConsultationModals: () => null,
}))

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeConsultation(
  usages: ConsultationProtocolUsage[] = [],
): ConsultationWithDetails {
  return {
    id: 'consult-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    patientName: 'Ana Reyes',
    doctorId: 'doctor-1',
    doctorName: 'Dr. Feliz',
    locationId: 'loc-1',
    locationName: 'Consultorio',
    status: 'open',
    startedAt: new Date().toISOString(),
    signedAt: null,
    patientAllergies: [],
    patientChronicConditions: [],
    amendments: [],
    protocolUsages: usages,
  } as unknown as ConsultationWithDetails
}

function makeUsage(
  overrides: Partial<ConsultationProtocolUsage> = {},
): ConsultationProtocolUsage {
  return {
    id: 'usage-1',
    tenantId: 'tenant-1',
    consultationId: 'consult-1',
    protocolId: 'proto-1',
    protocolVersionId: 'ver-1',
    protocolTitle: 'Protocolo de prueba',
    protocolTypeName: 'Diagnóstico',
    versionNumber: 1,
    status: 'in_progress',
    depth: 0,
    parentUsageId: null,
    triggerBlockId: null,
    completedAt: null,
    notes: null,
    appliedAt: new Date().toISOString(),
    modificationSummary: null,
    checkedState: {},
    modifications: {},
    content: {
      version: '1.0',
      blocks: [
        {
          id: 'sec_1',
          type: 'section',
          title: 'Anamnesis',
          blocks: [
            {
              id: 'chk_1',
              type: 'checklist',
              items: [{ id: 'itm_1', text: 'Cefalea' }],
            },
          ],
        },
      ],
    },
    ...overrides,
  } as unknown as ConsultationProtocolUsage
}

function renderPanel(
  overrides: Partial<Parameters<typeof ProtocolPanel>[0]> = {},
): void {
  render(
    <MemoryRouter>
      <ProtocolPanel
        consultation={makeConsultation()}
        readOnly={false}
        onRecordModification={vi.fn()}
        onFlushPending={vi.fn(async () => true)}
        showSign={false}
        onShowSignChange={vi.fn()}
        showAmend={false}
        onShowAmendChange={vi.fn()}
        showPicker={false}
        onShowPickerChange={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  )
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ProtocolPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the "Agregar protocolo" empty state and no SOAP fields when no protocol is attached', () => {
    renderPanel({ consultation: makeConsultation([]) })

    expect(screen.getByRole('button', { name: /Agregar protocolo/i })).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText(/subjetivo|objetivo|análisis|plan/i),
    ).not.toBeInTheDocument()
  })

  it('renders the protocol canvas when a protocol is attached', () => {
    const usage = makeUsage()
    renderPanel({ consultation: makeConsultation([usage]) })

    expect(screen.getByText('Cefalea')).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText(/subjetivo|objetivo|análisis|plan/i),
    ).not.toBeInTheDocument()
  })

  it('records checklist toggles locally instead of firing a mutation', () => {
    const onRecordModification = vi.fn()
    const usage = makeUsage()
    renderPanel({ consultation: makeConsultation([usage]), onRecordModification })

    fireEvent.click(screen.getByText('Cefalea'))

    expect(onRecordModification).toHaveBeenCalledTimes(1)
    expect(onRecordModification).toHaveBeenCalledWith('usage-1', {
      type: 'checklist_item',
      item_id: 'itm_1',
      checked: true,
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
