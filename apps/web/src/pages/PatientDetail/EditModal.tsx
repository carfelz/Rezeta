import { useState } from 'react'
import {
  Button,
  Callout,
  Field,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui'
import { useUpdatePatient } from '@/hooks/patients/use-patients'
import type { Patient } from '@rezeta/shared'
import { logger } from '@/lib/logger'
import { patientDetailStrings } from './strings'

export interface EditModalProps {
  patient: Patient
  onClose: () => void
}

export function EditModal({ patient, onClose }: EditModalProps): JSX.Element {
  const updateMutation = useUpdatePatient(patient.id)

  const [fullName, setFullName] = useState(`${patient.firstName} ${patient.lastName}`.trim())
  const [dateOfBirth, setDateOfBirth] = useState(patient.dateOfBirth?.slice(0, 10) ?? '')
  const [sex, setSex] = useState(patient.sex ?? '')
  const [documentType, setDocumentType] = useState(patient.documentType ?? '')
  const [documentNumber, setDocumentNumber] = useState(patient.documentNumber ?? '')
  const [phone, setPhone] = useState(patient.phone ?? '')
  const [email, setEmail] = useState(patient.email ?? '')
  const [notes, setNotes] = useState(patient.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const canSubmit = fullName.trim().length >= 2

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    try {
      await updateMutation.mutateAsync({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || null,
        sex: (sex as 'male' | 'female' | 'other') || null,
        documentType: (documentType as 'cedula' | 'passport' | 'rnc') || null,
        documentNumber: documentNumber.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        allergies: patient.allergies,
        chronicConditions: patient.chronicConditions,
      })
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'PatientDetail.EditModal' })
      setError(patientDetailStrings.errorMessage)
    }
  }

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={patientDetailStrings.editModalTitle} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={patientDetailStrings.fieldFullName} required>
              <Input
                type="text"
                placeholder={patientDetailStrings.fieldFullNamePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={patientDetailStrings.fieldDateOfBirthLabel}>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </Field>
              <Field label={patientDetailStrings.fieldSexLabel}>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger>
                    <SelectValue placeholder={patientDetailStrings.sexSelectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">{patientDetailStrings.sexFemale}</SelectItem>
                    <SelectItem value="male">{patientDetailStrings.sexMale}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={patientDetailStrings.fieldDocumentType}>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder={patientDetailStrings.documentTypeSelectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cedula">
                      {patientDetailStrings.documentTypeCedula}
                    </SelectItem>
                    <SelectItem value="passport">
                      {patientDetailStrings.documentTypePassport}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={patientDetailStrings.fieldDocumentNumber}>
                <Input
                  type="text"
                  placeholder={patientDetailStrings.fieldDocumentNumberPlaceholder}
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={patientDetailStrings.fieldPhoneLabel}>
                <Input
                  type="tel"
                  placeholder={patientDetailStrings.fieldPhonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label={patientDetailStrings.fieldEmailLabel}>
                <Input
                  type="email"
                  placeholder={patientDetailStrings.fieldEmailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>

            <Field label={patientDetailStrings.fieldNotesLabel}>
              <Textarea
                placeholder={patientDetailStrings.fieldNotesPlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </Field>

            {error && (
              <Callout
                variant="danger"
                icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}
              >
                {error}
              </Callout>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {patientDetailStrings.cancelButton}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit || updateMutation.isPending}
            >
              {updateMutation.isPending
                ? patientDetailStrings.savingButton
                : patientDetailStrings.saveButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
