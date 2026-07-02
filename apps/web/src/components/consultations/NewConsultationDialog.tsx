import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Field,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  NativeSelect,
} from '@/components/ui'
import { useCreateConsultation } from '@/hooks/consultations/use-consultations'
import { useCreatePatient } from '@/hooks/patients/use-patients'
import { useLocations } from '@/hooks/locations/use-locations'
import { useUiStore } from '@/store/ui.store'
import { PatientCombobox } from '@/pages/Schedule/PatientCombobox'
import { newConsultationDialogStrings as s } from './newConsultationDialogStrings'

export interface NewConsultationDialogProps {
  open: boolean
  onClose: () => void
}

type Mode = 'search' | 'create-patient'

export function NewConsultationDialog({ open, onClose }: NewConsultationDialogProps): JSX.Element {
  const navigate = useNavigate()
  const activeLocationId = useUiStore((st) => st.activeLocationId)
  const { data: locations } = useLocations()
  const createPatient = useCreatePatient()
  const createConsultation = useCreateConsultation()

  const [mode, setMode] = useState<Mode>('search')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [locationId, setLocationId] = useState(activeLocationId ?? '')

  const isPending = createPatient.isPending || createConsultation.isPending

  const hasPatient =
    mode === 'search'
      ? Boolean(selectedPatientId)
      : firstName.trim().length > 0 && lastName.trim().length > 0
  const canSubmit = hasPatient && Boolean(locationId) && !isPending

  async function handleSubmit(): Promise<void> {
    let pid = selectedPatientId
    if (mode === 'create-patient') {
      const patient = await createPatient.mutateAsync({
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        allergies: [],
        chronicConditions: [],
        ...(dateOfBirth ? { dateOfBirth } : {}),
      })
      pid = patient.id
    }
    const consultation = await createConsultation.mutateAsync({
      patientId: pid,
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
          {mode === 'search' ? (
            <Field label={s.title} required>
              <PatientCombobox
                value={selectedPatientId}
                onChange={(id) => setSelectedPatientId(id)}
                placeholder={s.searchPlaceholder}
              />
              <button
                type="button"
                className="self-start mt-1 text-[12.5px] font-sans font-medium text-p-600 hover:text-p-700"
                onClick={() => setMode('create-patient')}
              >
                {s.createPatientAction}
              </button>
            </Field>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label={s.firstNameLabel} id="new-consultation-first-name">
                  <Input
                    id="new-consultation-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field label={s.lastNameLabel} id="new-consultation-last-name">
                  <Input
                    id="new-consultation-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
              </div>
              <Field label={s.dateOfBirthLabel} id="new-consultation-dob">
                <Input
                  id="new-consultation-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </Field>
              <button
                type="button"
                className="self-start text-[12.5px] font-sans font-medium text-p-600 hover:text-p-700"
                onClick={() => setMode('search')}
              >
                {s.backToSearchAction}
              </button>
            </div>
          )}

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
