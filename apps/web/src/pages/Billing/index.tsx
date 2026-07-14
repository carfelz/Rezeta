import { useCallback, useState } from 'react'
import { Button, Callout, Card, EmptyState } from '@/components/ui'
import { useInvoices } from '@/hooks/invoices/use-invoices'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { InvoiceFormModal } from './InvoiceFormModal'
import { InvoiceRow } from './InvoiceRow'
import { SummaryCards } from './SummaryCards'
import { STATUS_OPTIONS, type ActiveModal } from './helpers'
import { billingStrings } from './strings'

export function Billing(): JSX.Element {
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
        <h1 className="text-h1 flex-1">{billingStrings.pageTitle}</h1>
        <Button variant="primary" size="md" onClick={() => setActiveModal({ type: 'create' })}>
          <i className="ph ph-plus text-base" />
          {billingStrings.newInvoiceButton}
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
          <div className="p-8 text-center text-n-400 text-sm">
            {billingStrings.loadingInvoices}
          </div>
        )}

        {isError && (
          <div className="m-4">
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              {billingStrings.errorLoadingInvoices}
            </Callout>
          </div>
        )}

        {!isLoading && !isError && invoices.length === 0 && (
          <EmptyState
            icon={<i className="ph ph-receipt" />}
            title={billingStrings.emptyTitle}
            description={billingStrings.emptyDescription}
            action={
              <Button variant="primary" onClick={() => setActiveModal({ type: 'create' })}>
                {billingStrings.emptyCta}
              </Button>
            }
            className="rounded-none border-0"
          />
        )}

        {!isLoading && invoices.length > 0 && (
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {billingStrings.tableColNumber}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {billingStrings.tableColPatientLocation}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {billingStrings.tableColStatus}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-right">
                  {billingStrings.tableColAmount}
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
