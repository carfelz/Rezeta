import { useCallback, useState } from 'react'
import { Button, Callout, Card, EmptyState } from '@/components/ui'
import { useInvoices } from '@/hooks/invoices/use-invoices'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { InvoiceFormModal } from './InvoiceFormModal'
import { InvoiceRow } from './InvoiceRow'
import { SummaryCards } from './SummaryCards'
import { STATUS_OPTIONS, type ActiveModal } from './helpers'

export function Facturacion(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState('')
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  const { data, isLoading, isError } = useInvoices(
    statusFilter ? { status: statusFilter } : undefined,
  )

  const invoices = data?.items ?? []
  const closeModal = useCallback(() => setActiveModal(null), [])

  return (
    <div>
      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">Facturación</h1>
        <Button variant="primary" size="md" onClick={() => setActiveModal({ type: 'create' })}>
          <i className="ph ph-plus text-[14px]" />
          Nueva factura
        </Button>
      </div>

      {!isLoading && invoices.length > 0 && <SummaryCards invoices={invoices} />}

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-n-100">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={statusFilter === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </Button>
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
            description="Las facturas se generan automáticamente al firmar una consulta, o puedes crear una manualmente."
            action={
              <Button variant="primary" onClick={() => setActiveModal({ type: 'create' })}>
                Nueva factura
              </Button>
            }
            className="rounded-none border-0"
          />
        )}

        {!isLoading && invoices.length > 0 && (
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Número
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Paciente / Ubicación
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-right">
                  Monto
                </th>
                <th className="bg-n-50 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onEdit={(inv) => setActiveModal({ type: 'edit', invoice: inv })}
                  onDelete={(inv) => setActiveModal({ type: 'delete', invoice: inv })}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {activeModal?.type === 'create' && <InvoiceFormModal onClose={closeModal} />}
      {activeModal?.type === 'edit' && (
        <InvoiceFormModal invoice={activeModal.invoice} onClose={closeModal} />
      )}
      {activeModal?.type === 'delete' && (
        <DeleteConfirmModal invoice={activeModal.invoice} onClose={closeModal} />
      )}
    </div>
  )
}
