import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PostSignPanel } from '../PostSignPanel'
import type { ConsultationWithDetails, InvoiceOutcome } from '@rezeta/shared'

// ─── Mock the invoice status mutation ──────────────────────────────────────────

const updateInvoiceStatusMock = vi.fn()

vi.mock('@/hooks/invoices/use-invoices', () => ({
  useUpdateInvoiceStatus: () => ({
    mutateAsync: updateInvoiceStatusMock,
    isPending: false,
  }),
}))

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const consultation = {
  id: 'consult-1',
  patientName: 'Ana Reyes',
  locationName: 'Consultorio',
} as unknown as ConsultationWithDetails

function renderPanel(invoiceOutcome: InvoiceOutcome): void {
  render(
    <MemoryRouter>
      <PostSignPanel invoiceOutcome={invoiceOutcome} consultation={consultation} />
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
