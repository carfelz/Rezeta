import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ProtocolPanel } from '../ProtocolPanel'
import type { ConsultationWithDetails } from '@rezeta/shared'

// ─── Mocks ──────────────────────────────────────────────────────────────────────
// Regression guard for F4: the protocol picker must be mounted exactly once, so
// the empty-state trigger and the right-rail "Agregar" trigger share a single
// dialog instead of stacking two identical dialogs in the DOM.

const mockMutation = { mutate: vi.fn(), isPending: false }

vi.mock('@/hooks/consultations/use-consultations', () => ({
  useAddProtocolUsage: () => mockMutation,
  useRemoveProtocolUsage: () => mockMutation,
  useSkipStep: () => mockMutation,
  useAddOffProtocolNote: () => mockMutation,
}))

vi.mock('../ProtocolBar', () => ({
  ProtocolBar: () => <div data-testid="protocol-bar" />,
}))

// Render a marker only while open so we can count how many picker dialogs mount.
// Note: ConsultationModals is intentionally NOT mocked here so its real picker
// mount is exercised.
vi.mock('@/components/protocols/ProtocolPickerModal', () => ({
  ProtocolPickerModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="protocol-picker-dialog" /> : null,
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────────

function makeConsultation(): ConsultationWithDetails {
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
    protocolUsages: [],
  } as unknown as ConsultationWithDetails
}

function renderPanel(showPicker: boolean): void {
  render(
    <MemoryRouter>
      <ProtocolPanel
        consultation={makeConsultation()}
        readOnly={false}
        onRecordModification={vi.fn()}
        onFlushPending={vi.fn(async () => true)}
        onUsageRemoved={vi.fn()}
        onRecordContentEdit={vi.fn()}
        showSign={false}
        onShowSignChange={vi.fn()}
        showAmend={false}
        onShowAmendChange={vi.fn()}
        showPicker={showPicker}
        onShowPickerChange={vi.fn()}
      />
    </MemoryRouter>,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────────

describe('ProtocolPanel — protocol picker mounting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts exactly one protocol picker dialog when opened', () => {
    renderPanel(true)

    expect(screen.getAllByTestId('protocol-picker-dialog')).toHaveLength(1)
  })

  it('mounts no protocol picker dialog while closed', () => {
    renderPanel(false)

    expect(screen.queryAllByTestId('protocol-picker-dialog')).toHaveLength(0)
  })
})
