import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { formatTime } from './helpers'
import { deleteAppointmentModalStrings } from './strings'

export interface DeleteConfirmModalProps {
  appt: AppointmentWithDetails
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
}

export function DeleteConfirmModal({
  appt,
  onConfirm,
  onClose,
  isDeleting,
}: DeleteConfirmModalProps): JSX.Element {
  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={deleteAppointmentModalStrings.title} showClose={false} />
        <ModalBody>
          <p className="text-body text-n-700">
            {deleteAppointmentModalStrings.body(
              appt.patientName,
              new Date(appt.startsAt).toLocaleDateString('es-DO', {
                day: 'numeric',
                month: 'long',
              }),
              formatTime(appt.startsAt),
            )}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {deleteAppointmentModalStrings.cancelButton}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting
              ? deleteAppointmentModalStrings.deletingButton
              : deleteAppointmentModalStrings.deleteButton}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
