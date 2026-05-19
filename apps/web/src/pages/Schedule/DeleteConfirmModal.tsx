import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { formatTime } from './helpers'

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
        <ModalHeader title="Eliminar cita" showClose={false} />
        <ModalBody>
          <p className="text-body text-n-700">
            ¿Eliminar la cita de <span className="font-semibold">{appt.patientName}</span> el{' '}
            {new Date(appt.startsAt).toLocaleDateString('es-DO', {
              day: 'numeric',
              month: 'long',
            })}{' '}
            a las {formatTime(appt.startsAt)}? Esta acción no se puede deshacer.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Eliminando...' : 'Eliminar cita'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
