import { Link } from 'react-router-dom'
import type { InvoiceWithDetails } from '@rezeta/shared'
import { Badge, EmptyState } from '@/components/ui'
import { useInvoices } from '@/hooks/invoices/use-invoices'
import { formatCurrency, formatDate, statusLabel, statusVariant } from '@/pages/Billing/helpers'
import { patientDetailStrings as s } from './strings'

interface InvoicesTabProps {
  patientId: string
}

export function InvoicesTab({ patientId }: InvoicesTabProps): JSX.Element {
  const { data, isLoading, isError } = useInvoices({ patientId })
  const invoices = data?.items ?? []

  if (isLoading) {
    return <TabSpinner />
  }

  if (isError) {
    return <p className="text-[13px] font-sans text-danger-text">{s.loadError}</p>
  }

  if (invoices.length === 0) {
    return <EmptyState icon={<i className="ph ph-receipt" />} title={s.invoicesEmpty} />
  }

  return (
    <ul className="flex flex-col divide-y divide-n-100">
      {invoices.map((invoice) => (
        <InvoiceRow key={invoice.id} invoice={invoice} />
      ))}
    </ul>
  )
}

function InvoiceRow({ invoice }: { invoice: InvoiceWithDetails }): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[13px] font-mono text-n-800 whitespace-nowrap">
          {invoice.invoiceNumber}
        </span>
        <span className="text-[12px] font-sans text-n-500 whitespace-nowrap">
          {formatDate(invoice.createdAt)}
        </span>
        <span className="text-[13px] font-sans text-n-800 whitespace-nowrap">
          {formatCurrency(invoice.total, invoice.currency)}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={statusVariant(invoice.status)}>{statusLabel(invoice.status)}</Badge>
        {invoice.consultationId !== null && (
          <Link
            to={`/consultas/${invoice.consultationId}`}
            className="inline-flex items-center gap-1 text-[12px] font-sans text-p-500 hover:text-p-700 hover:underline underline-offset-2"
          >
            <i className="ph ph-file-text text-[14px]" />
            {s.viewConsultation}
          </Link>
        )}
        <Link
          to="/facturacion"
          className="inline-flex items-center gap-1 text-[12px] font-sans text-p-500 hover:text-p-700 hover:underline underline-offset-2"
        >
          <i className="ph ph-arrow-square-out text-[14px]" />
          {s.viewInvoice}
        </Link>
      </div>
    </li>
  )
}

function TabSpinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-10">
      <i className="ph ph-spinner animate-spin text-[24px] text-n-400" />
    </div>
  )
}
