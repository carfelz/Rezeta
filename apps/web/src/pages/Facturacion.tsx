import { useState } from 'react'
import { useInvoices, useUpdateInvoiceStatus } from '@/hooks/invoices/use-invoices'
import type { InvoiceWithDetails, InvoiceStatus } from '@rezeta/shared'
import { Badge, Card, Callout, EmptyState } from '@/components/ui'
import type { BadgeProps } from '@/components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? 'US$' : 'RD$'
  return `${symbol} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusVariant(status: InvoiceStatus): BadgeProps['variant'] {
  switch (status) {
    case 'paid':
      return 'paid'
    case 'issued':
      return 'active'
    case 'cancelled':
      return 'archived'
    default:
      return 'draft'
  }
}

function statusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft':
      return 'Borrador'
    case 'issued':
      return 'Emitida'
    case 'paid':
      return 'Pagada'
    case 'cancelled':
      return 'Cancelada'
  }
}

// ─── Status action modal ──────────────────────────────────────────────────────

function StatusAction({ invoice }: { invoice: InvoiceWithDetails }): JSX.Element | null {
  const updateStatus = useUpdateInvoiceStatus(invoice.id)

  if (invoice.status === 'draft') {
    return (
      <button
        type="button"
        disabled={updateStatus.isPending}
        onClick={() => void updateStatus.mutateAsync({ status: 'issued' })}
        className="text-[11.5px] font-sans text-p-700 hover:text-p-900 transition-colors disabled:opacity-50"
      >
        Emitir
      </button>
    )
  }
  if (invoice.status === 'issued') {
    return (
      <button
        type="button"
        disabled={updateStatus.isPending}
        onClick={() => void updateStatus.mutateAsync({ status: 'paid', paymentMethod: 'cash' })}
        className="text-[11.5px] font-sans text-p-700 hover:text-p-900 transition-colors disabled:opacity-50"
      >
        Marcar pagada
      </button>
    )
  }
  return null
}

// ─── Invoice row ──────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: InvoiceWithDetails }): JSX.Element {
  return (
    <tr className="hover:bg-n-25">
      <td className="px-4 py-3 border-b border-n-100">
        <div className="text-[13px] font-mono font-medium text-n-700">{invoice.invoiceNumber}</div>
        <div className="text-[11.5px] text-n-500 mt-0.5">{formatDate(invoice.createdAt)}</div>
      </td>
      <td className="px-4 py-3 border-b border-n-100">
        <div className="text-[13px] font-sans font-semibold text-n-800">{invoice.patientName}</div>
        <div className="text-[11.5px] text-n-500 mt-0.5">{invoice.locationName}</div>
      </td>
      <td className="px-4 py-3 border-b border-n-100">
        <Badge variant={statusVariant(invoice.status)} showDot={false}>
          {statusLabel(invoice.status)}
        </Badge>
      </td>
      <td className="px-4 py-3 border-b border-n-100 text-right">
        <div className="text-[13px] font-mono font-semibold text-n-800">
          {formatCurrency(invoice.total, invoice.currency)}
        </div>
        {invoice.commissionPercent > 0 && (
          <div className="text-[11px] font-mono text-n-500 mt-0.5">
            Neto: {formatCurrency(invoice.netToDoctor, invoice.currency)}
          </div>
        )}
      </td>
      <td className="px-4 py-3 border-b border-n-100 text-right">
        <StatusAction invoice={invoice} />
      </td>
    </tr>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'issued', label: 'Emitidas' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'cancelled', label: 'Canceladas' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Facturacion(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, isError } = useInvoices(
    statusFilter ? { status: statusFilter } : undefined,
  )

  const invoices = data?.items ?? []

  const totals = invoices.reduce(
    (acc, inv) => {
      if (inv.status !== 'cancelled') {
        acc.gross += inv.total
        acc.net += inv.netToDoctor
      }
      return acc
    },
    { gross: 0, net: 0 },
  )

  return (
    <div>
      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">Facturación</h1>
      </div>

      {/* Summary row */}
      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="border border-n-200 rounded-md bg-n-0 p-4">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400">
              Total facturado
            </div>
            <div className="text-[18px] font-serif font-medium text-n-900 mt-1">
              RD$ {totals.gross.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="border border-n-200 rounded-md bg-n-0 p-4">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400">
              Neto al médico
            </div>
            <div className="text-[18px] font-serif font-medium text-n-900 mt-1">
              RD$ {totals.net.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="border border-n-200 rounded-md bg-n-0 p-4">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400">
              Facturas activas
            </div>
            <div className="text-[18px] font-serif font-medium text-n-900 mt-1">
              {invoices.filter((i) => i.status === 'draft' || i.status === 'issued').length}
            </div>
          </div>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-2 p-4 border-b border-n-100">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-sm text-[12px] font-sans transition-colors ${
                statusFilter === opt.value
                  ? 'bg-p-500 text-white'
                  : 'bg-n-50 text-n-600 hover:bg-n-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="p-8 text-center text-n-400 text-[13px]">Cargando facturas...</div>
        )}

        {isError && (
          <div className="m-4">
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              No se pudo cargar la lista de facturas.
            </Callout>
          </div>
        )}

        {!isLoading && !isError && invoices.length === 0 && (
          <EmptyState
            icon={<i className="ph ph-receipt" />}
            title="No hay facturas"
            description="Las facturas se generan automáticamente al firmar una consulta."
            className="rounded-none border-0"
          />
        )}

        {!isLoading && invoices.length > 0 && (
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Número
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Paciente / Ubicación
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-right">
                  Monto
                </th>
                <th className="bg-n-50 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
