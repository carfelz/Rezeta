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
      setError('No se pudo eliminar la factura. Intenta de nuevo.')
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
          title="Eliminar factura"
          subtitle={`¿Eliminar la factura ${invoice.invoiceNumber}? Esta acción no se puede deshacer.`}
          icon={<i className="ph ph-trash" />}
          iconVariant="danger"
        />
        <ModalBody>
          {error && (
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              {error}
            </Callout>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleConfirm()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar factura'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
