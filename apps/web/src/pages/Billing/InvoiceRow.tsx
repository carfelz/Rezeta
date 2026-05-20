import { useState } from 'react'
import { Badge, IconButton, Row } from '@/components/ui'
import { apiClient, triggerDownload } from '@/lib/api-client'
import type { InvoiceWithDetails } from '@rezeta/shared'
import { formatCurrency, formatDate, statusLabel, statusVariant } from './helpers'
import { StatusAction } from './StatusAction'
import { billingStrings } from './strings'

export interface InvoiceRowProps {
  invoice: InvoiceWithDetails
  onEdit: (inv: InvoiceWithDetails) => void
  onDelete: (inv: InvoiceWithDetails) => void
}

export function InvoiceRow({ invoice, onEdit, onDelete }: InvoiceRowProps): JSX.Element {
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf(): Promise<void> {
    setDownloading(true)
    try {
      const blob = await apiClient.download(`/v1/invoices/${invoice.id}/pdf`)
      triggerDownload(blob, `factura-${invoice.invoiceNumber}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  const isDraft = invoice.status === 'draft'

  return (
    <tr className="hover:bg-n-25">
      <td className="px-4 py-3 border-b border-n-100">
        <div className="text-[13px] font-mono font-medium text-n-700">{invoice.invoiceNumber}</div>
        <div className="text-[11.5px] text-n-500 mt-1">{formatDate(invoice.createdAt)}</div>
      </td>
      <td className="px-4 py-3 border-b border-n-100">
        <div className="text-[13px] font-sans font-semibold text-n-800">{invoice.patientName}</div>
        <div className="text-[11.5px] text-n-500 mt-1">{invoice.locationName}</div>
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
          <div className="text-[11px] font-mono text-n-500 mt-1">
            {billingStrings.netLabel(formatCurrency(invoice.netToDoctor, invoice.currency))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 border-b border-n-100 text-right">
        <Row gap={3} justify="end">
          <IconButton
            icon={downloading ? 'ph ph-spinner animate-spin' : 'ph ph-file-pdf'}
            aria-label={billingStrings.downloadPdfLabel}
            tone="neutral"
            size="sm"
            disabled={downloading}
            onClick={() => void handleDownloadPdf()}
          />
          {isDraft && (
            <>
              <IconButton
                icon="ph ph-pencil-simple"
                aria-label={billingStrings.editInvoiceLabel}
                tone="neutral"
                size="sm"
                onClick={() => onEdit(invoice)}
              />
              <IconButton
                icon="ph ph-trash"
                aria-label={billingStrings.deleteInvoiceLabel}
                tone="danger"
                size="sm"
                onClick={() => onDelete(invoice)}
              />
            </>
          )}
          <StatusAction invoice={invoice} />
        </Row>
      </td>
    </tr>
  )
}
