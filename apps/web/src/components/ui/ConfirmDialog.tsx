import * as Dialog from '@radix-ui/react-dialog'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from './Modal'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  /** Main body copy of the dialog. */
  description: string
  /** Optional secondary line shown under the title in the header. */
  subtitle?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

/**
 * Async, state-driven replacement for window.confirm(). Built on the
 * Modal + ModalHeader pattern used across the app (see DeleteConfirmModal).
 *
 * `description` is the body of the modal. `subtitle`, when provided, is the
 * header line under the title. Radix wires `aria-describedby` to a single
 * `Dialog.Description`: the subtitle owns it when present, otherwise the body
 * description does — so the description is always announced and the id is never
 * duplicated.
 */
export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  subtitle,
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
          {...(subtitle ? { subtitle } : {})}
          icon={<i className={`ph ph-${variant === 'danger' ? 'trash' : 'question'}`} />}
          iconVariant={variant === 'danger' ? 'danger' : 'default'}
        />
        <ModalBody>
          {subtitle ? (
            <p className="text-[14px] font-sans text-n-700 leading-normal">{description}</p>
          ) : (
            <Dialog.Description className="text-[14px] font-sans text-n-700 leading-normal">
              {description}
            </Dialog.Description>
          )}
        </ModalBody>
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
