import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PostSignPanel } from '../PostSignPanel'
import type { ConsultationWithDetails, InvoiceOutcome, RecordOutcome } from '@rezeta/shared'

// ─── Mock the invoice status mutation ──────────────────────────────────────────

const updateInvoiceStatusMock = vi.fn()

vi.mock('@/hooks/invoices/use-invoices', () => ({
  useUpdateInvoiceStatus: () => ({
    mutateAsync: updateInvoiceStatusMock,
    isPending: false,
  }),
}))

// ─── Mock the historia record mutation ─────────────────────────────────────────

const ensureRecordMutateMock = vi.fn()

vi.mock('@/hooks/consultations/use-consultation-record', () => ({
  useEnsureRecord: () => ({
    mutate: ensureRecordMutateMock,
    isPending: false,
  }),
}))

// The follow-up block opens the appointment form modal, which depends on these
// hooks. Stub them so the modal renders in isolation.
vi.mock('@/hooks/appointments/use-appointments', () => ({
  useCreateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/locations/use-locations', () => ({
  useLocations: () => ({ data: [{ id: 'loc-1', name: 'Consultorio' }] }),
}))

vi.mock('@/hooks/schedules/use-schedules', () => ({
  useGetBlocks: () => ({ data: [] }),
}))

vi.mock('@/hooks/patients/use-patients', () => ({
  usePatients: () => ({ data: { items: [] } }),
}))

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const consultation = {
  id: 'consult-1',
  patientId: 'p1',
  locationId: 'loc-1',
  patientName: 'Ana Reyes',
  locationName: 'Consultorio',
} as unknown as ConsultationWithDetails

const defaultRecordOutcome: RecordOutcome = { status: 'created', recordId: 'rec1' }

function renderPanel(
  invoiceOutcome: InvoiceOutcome,
  recordOutcome: RecordOutcome = defaultRecordOutcome,
): void {
  render(
    <MemoryRouter>
      <PostSignPanel
        invoiceOutcome={invoiceOutcome}
        recordOutcome={recordOutcome}
        consultation={consultation}
      />
    </MemoryRouter>,
  )
}

describe('PostSignPanel invoice card', () => {
  beforeEach(() => {
    updateInvoiceStatusMock.mockReset()
    updateInvoiceStatusMock.mockResolvedValue(undefined)
  })

  it('shows the draft invoice with Emitir and Ver actions when created', () => {
    renderPanel({ status: 'created', invoiceId: 'i1', total: 1500, currency: 'DOP' })
    expect(screen.getByText('Emitir factura')).toBeInTheDocument()
    expect(screen.getByText('Ver en Facturación')).toBeInTheDocument()
  })

  it('explains the missing fee and offers config + manual paths when skipped', () => {
    renderPanel({ status: 'skipped_no_fee' })
    expect(screen.getByText(/no hay tarifa configurada/i)).toBeInTheDocument()
    expect(screen.getByText('Configurar tarifa')).toBeInTheDocument()
    expect(screen.getByText('Crear factura manual')).toBeInTheDocument()
  })

  it('shows the failure callout with the manual path when failed', () => {
    renderPanel({ status: 'failed' })
    expect(screen.getByText(/no se pudo crear la factura/i)).toBeInTheDocument()
    expect(screen.getByText('Crear factura manual')).toBeInTheDocument()
  })

  it('issues the invoice on Emitir factura', async () => {
    const user = userEvent.setup()
    renderPanel({ status: 'created', invoiceId: 'i1', total: 1500, currency: 'DOP' })
    await user.click(screen.getByText('Emitir factura'))
    expect(updateInvoiceStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'issued' }),
    )
  })

  it('shows the Factura emitida state after issuing', async () => {
    const user = userEvent.setup()
    renderPanel({ status: 'created', invoiceId: 'i1', total: 1500, currency: 'DOP' })
    await user.click(screen.getByText('Emitir factura'))
    expect(await screen.findByText('Factura emitida')).toBeInTheDocument()
    expect(screen.queryByText('Emitir factura')).not.toBeInTheDocument()
  })

  it('does not flip to Factura emitida when issuing rejects', async () => {
    const user = userEvent.setup()
    // The hook's onError toasts; the panel must terminate the promise chain so
    // the rejection does not surface as an unhandled rejection (vitest fails on
    // those) and the card stays in the pre-issue state.
    updateInvoiceStatusMock.mockRejectedValue(new Error('issue failed'))
    renderPanel({ status: 'created', invoiceId: 'i1', total: 1500, currency: 'DOP' })
    await user.click(screen.getByText('Emitir factura'))
    expect(updateInvoiceStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'issued' }),
    )
    expect(screen.queryByText('Factura emitida')).not.toBeInTheDocument()
    expect(screen.getByText('Emitir factura')).toBeInTheDocument()
  })
})

describe('PostSignPanel follow-up block', () => {
  beforeEach(() => {
    updateInvoiceStatusMock.mockReset()
    updateInvoiceStatusMock.mockResolvedValue(undefined)
  })

  it('renders the follow-up block regardless of the invoice outcome', () => {
    renderPanel({ status: 'skipped_no_fee' })
    expect(screen.getByText('Agendar seguimiento')).toBeInTheDocument()
  })

  it('opens the appointment form modal pre-filled for the patient', async () => {
    const user = userEvent.setup()
    renderPanel({ status: 'skipped_no_fee' })
    await user.click(screen.getByText('Agendar seguimiento'))
    expect(screen.getByText('Nueva cita')).toBeInTheDocument()
  })
})

describe('PostSignPanel historia card', () => {
  beforeEach(() => {
    updateInvoiceStatusMock.mockReset()
    updateInvoiceStatusMock.mockResolvedValue(undefined)
    ensureRecordMutateMock.mockReset()
  })

  it('shows the historia card with a link to the patient historia tab when created', () => {
    renderPanel(
      { status: 'skipped_no_fee' },
      { status: 'created', recordId: 'rec1' },
    )
    expect(screen.getByText('Historia médica')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver historia/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/pacientes/'),
    )
  })

  it('offers a retry when the draft failed', () => {
    renderPanel({ status: 'skipped_no_fee' }, { status: 'failed' })
    expect(screen.getByText('No se pudo generar la historia médica.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generar historia/ })).toBeInTheDocument()
  })

  it('retries generating the historia on click', async () => {
    const user = userEvent.setup()
    renderPanel({ status: 'skipped_no_fee' }, { status: 'failed' })
    await user.click(screen.getByRole('button', { name: /Generar historia/ }))
    expect(ensureRecordMutateMock).toHaveBeenCalledWith(consultation.id)
  })
})
