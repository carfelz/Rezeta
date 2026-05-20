import { Button, Callout, Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { deletePatientModalStrings } from './strings'

export interface DeleteConfirmModalProps {
  patient: Patient
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
  error: string | null
}

export function DeleteConfirmModal({
  patient,
  onConfirm,
  onClose,
  isDeleting,
  error,
}: DeleteConfirmModalProps): JSX.Element {
  const name = `${patient.firstName} ${patient.lastName}`.trim()
  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader
          icon={<i className="ph ph-trash" />}
          iconVariant="danger"
          title={deletePatientModalStrings.title}
          subtitle={deletePatientModalStrings.subtitle(name)}
          showClose={false}
        />
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {deletePatientModalStrings.cancelButton}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting
              ? deletePatientModalStrings.deletingButton
              : deletePatientModalStrings.deleteButton}
          </Button>
        </ModalFooter>
        {error && (
          <div className="px-6 pb-4 -mt-2">
            <Callout
              variant="danger"
              icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}
            >
              {error}
            </Callout>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}
