import { useState } from 'react'
import {
  Button,
  Callout,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/components/ui'
import { useDeleteInvoice } from '@/hooks/invoices/use-invoices'
import type { InvoiceWithDetails } from '@rezeta/shared'
import { billingStrings } from './strings'

export interface DeleteConfirmModalProps {
  invoice: InvoiceWithDetails
  onClose: () => void
}

export function DeleteConfirmModal({ invoice, onClose }: DeleteConfirmModalProps): JSX.Element {
  const deleteMutation = useDeleteInvoice()
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setError(null)
    try {
      await deleteMutation.mutateAsync(invoice.id)
      onClose()
    } catch {
      setError(billingStrings.deleteErrorMessage)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader
          title={billingStrings.deleteModalTitle}
          subtitle={billingStrings.deleteModalSubtitle(invoice.invoiceNumber)}
          icon={<i className="ph ph-trash" />}
          iconVariant="danger"
        />
        {error && (
          <ModalBody>
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              {error}
            </Callout>
          </ModalBody>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={deleteMutation.isPending}>
            {billingStrings.deleteCancelButton}
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleConfirm()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending
              ? billingStrings.deletingButton
              : billingStrings.deleteConfirmButton}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
