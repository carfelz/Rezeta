import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Field,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  NativeSelect,
} from '@/components/ui'
import { useCreateConsultation } from '@/hooks/consultations/use-consultations'
import { useLocations } from '@/hooks/locations/use-locations'
import { useUiStore } from '@/store/ui.store'
import { PatientCombobox } from '@/pages/Schedule/PatientCombobox'
import { newConsultationDialogStrings as s } from './newConsultationDialogStrings'

export interface NewConsultationDialogProps {
  open: boolean
  onClose: () => void
}

export function NewConsultationDialog({ open, onClose }: NewConsultationDialogProps): JSX.Element {
  const navigate = useNavigate()
  const activeLocationId = useUiStore((st) => st.activeLocationId)
  const { data: locations } = useLocations()
  const createConsultation = useCreateConsultation()

  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [locationId, setLocationId] = useState(activeLocationId ?? '')

  const canSubmit =
    Boolean(selectedPatientId) && Boolean(locationId) && !createConsultation.isPending

  async function handleSubmit(): Promise<void> {
    const consultation = await createConsultation.mutateAsync({
      patientId: selectedPatientId,
      locationId,
    })
    onClose()
    void navigate(`/consultas/${consultation.id}`)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={s.title} />
        <ModalBody className="flex flex-col gap-4">
          <Field label={s.patientLabel} required>
            <PatientCombobox
              value={selectedPatientId}
              onChange={(id) => setSelectedPatientId(id)}
              placeholder={s.searchPlaceholder}
            />
          </Field>

          <Field label={s.locationLabel} required id="new-consultation-location">
            <NativeSelect
              id="new-consultation-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="" disabled>
                {s.locationPlaceholder}
              </option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.city ? ` · ${loc.city}` : ''}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {s.cancelButton}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              // Mutation errors surface via the hooks' onError toasts; swallow the
              // rejection here so the dialog stays open without an unhandled rejection.
              handleSubmit().catch(() => undefined)
            }}
          >
            {s.submitButton}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
