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
import { amendmentModalStrings } from './strings'

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
      <ModalHeader title={amendmentModalStrings.title} subtitle={amendmentModalStrings.subtitle} />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <Field label={amendmentModalStrings.reasonLabel} required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={amendmentModalStrings.reasonPlaceholder}
              rows={3}
            />
          </Field>
          <Field label={amendmentModalStrings.notesLabel}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={amendmentModalStrings.notesPlaceholder}
              rows={3}
            />
          </Field>
          {amendMutation.isError && (
            <p className="text-[12px] text-danger-text">{amendmentModalStrings.errorMessage}</p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="secondary" onClick={onClose}>
            {amendmentModalStrings.cancelButton}
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
          {amendMutation.isPending
            ? amendmentModalStrings.savingButton
            : amendmentModalStrings.saveButton}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}
