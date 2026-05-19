import { Modal, ModalContent, ModalHeader, ModalFooter } from './Modal'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

/**
 * Async, state-driven replacement for window.confirm(). Built on the
 * Modal + ModalHeader pattern used across the app (see DeleteConfirmModal).
 */
export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        /* v8 ignore next -- next=true never fires; dialog is fully controlled with no trigger */
        if (!next && !loading) onCancel()
      }}
    >
      <ModalContent>
        <ModalHeader
          title={title}
          subtitle={description}
          icon={<i className={`ph ph-${variant === 'danger' ? 'trash' : 'question'}`} />}
          iconVariant={variant === 'danger' ? 'danger' : 'default'}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Procesando...' : confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
