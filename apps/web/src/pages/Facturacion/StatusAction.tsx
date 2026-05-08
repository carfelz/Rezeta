import { TextLink } from '@/components/ui'
import { useUpdateInvoiceStatus } from '@/hooks/invoices/use-invoices'
import type { InvoiceWithDetails } from '@rezeta/shared'

export function StatusAction({ invoice }: { invoice: InvoiceWithDetails }): JSX.Element | null {
  const updateStatus = useUpdateInvoiceStatus(invoice.id)

  if (invoice.status === 'draft') {
    return (
      <TextLink
        tone="primary"
        size="sm"
        disabled={updateStatus.isPending}
        onClick={() => void updateStatus.mutateAsync({ status: 'issued' })}
      >
        Emitir
      </TextLink>
    )
  }
  if (invoice.status === 'issued') {
    return (
      <TextLink
        tone="primary"
        size="sm"
        disabled={updateStatus.isPending}
        onClick={() => void updateStatus.mutateAsync({ status: 'paid', paymentMethod: 'cash' })}
      >
        Marcar pagada
      </TextLink>
    )
  }
  return null
}
