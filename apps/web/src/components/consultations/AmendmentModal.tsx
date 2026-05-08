import { useState } from 'react'
import {
  Button,
  Field,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@/components/ui'
import { useAmendConsultation } from '@/hooks/consultations/use-consultations'

export interface AmendmentModalProps {
  consultationId: string
  onClose: () => void
}

export function AmendmentModal({ consultationId, onClose }: AmendmentModalProps): JSX.Element {
  const amendMutation = useAmendConsultation(consultationId)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <ModalContent>
      <ModalHeader
        title="Agregar enmienda"
        subtitle="Las enmiendas quedan registradas junto a la consulta original."
      />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <Field label="Motivo de la enmienda" required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe la corrección…"
              rows={3}
            />
          </Field>
          <Field label="Notas adicionales (opcional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información corregida o aclarada…"
              rows={3}
            />
          </Field>
          {amendMutation.isError && (
            <p className="text-[12px] text-danger-text">
              No se pudo guardar la enmienda. Inténtalo de nuevo.
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </ModalClose>
        <Button
          variant="primary"
          disabled={!reason.trim() || amendMutation.isPending}
          onClick={() =>
            amendMutation.mutate(
              { reason: reason.trim(), ...(notes.trim() ? { plan: notes.trim() } : {}) },
              { onSuccess: onClose },
            )
          }
        >
          {amendMutation.isPending ? 'Guardando…' : 'Guardar enmienda'}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}
