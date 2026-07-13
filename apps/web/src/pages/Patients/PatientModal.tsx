import { useMemo, useState } from 'react'
import {
  Badge,
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
  TagInput,
  Textarea,
} from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { useCreatePatient, useUpdatePatient } from '@/hooks/patients/use-patients'
import { useLocations } from '@/hooks/locations/use-locations'
import { useUiStore } from '@/store/ui.store'
import { ClinicalHistory } from './ClinicalHistory'
import { patientModalStrings } from './strings'
import { ReadField } from './ReadField'
import { DOC_LABELS, SEX_LABELS, formatAge, formatDate } from './helpers'
import { logger } from '@/lib/logger'

export type PatientModalMode = 'create' | 'edit' | 'view'

export interface PatientModalProps {
  mode: PatientModalMode
  patient?: Patient
  onClose: () => void
  onCreated?: (patient: Patient) => void
}

export function PatientModal({
  mode,
  patient,
  onClose,
  onCreated,
}: PatientModalProps): JSX.Element {
  const createMutation = useCreatePatient()
  const updateMutation = useUpdatePatient(patient?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending
  const { data: locations = [] } = useLocations()
  const activeLocationId = useUiStore((s) => s.activeLocationId)
  const primaryLocationId = useMemo(() => {
    if (locations.length === 0) return undefined
    if (activeLocationId && locations.some((l) => l.id === activeLocationId)) {
      return activeLocationId
    }
    const owned = locations.find((l) => l.isOwned)
    return (owned ?? locations[0])?.id
  }, [locations, activeLocationId])

  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const isCreate = mode === 'create'

  const [fullName, setFullName] = useState(
    patient ? `${patient.firstName} ${patient.lastName}`.trim() : '',
  )
  const [dateOfBirth, setDateOfBirth] = useState(patient?.dateOfBirth?.slice(0, 10) ?? '')
  const [sex, setSex] = useState(patient?.sex ?? '')
  const [documentType, setDocumentType] = useState(patient?.documentType ?? '')
  const [documentNumber, setDocumentNumber] = useState(patient?.documentNumber ?? '')
  const [phone, setPhone] = useState(patient?.phone ?? '')
  const [email, setEmail] = useState(patient?.email ?? '')
  const [notes, setNotes] = useState(patient?.notes ?? '')
  const [allergies, setAllergies] = useState<string[]>(patient?.allergies ?? [])
  const [chronicConditions, setChronicConditions] = useState<string[]>(
    patient?.chronicConditions ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  const canSubmit = fullName.trim().length >= 2

  const title = isView
    ? `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim()
    : isEdit
      ? patientModalStrings.titleEdit
      : patientModalStrings.titleCreate

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    // PatientModal can be rendered from within another page's <form> (e.g. the
    // booking PatientCombobox's "Nuevo paciente" flow inside AppointmentFormModal).
    // React's synthetic events bubble through the React tree, not the DOM tree, so
    // even though this form is portaled elsewhere in the DOM it would otherwise
    // also submit that ancestor form. Stop it here.
    e.stopPropagation()
    setError(null)
    const payload = {
      fullName: fullName.trim(),
      dateOfBirth: dateOfBirth || null,
      sex: (sex as 'male' | 'female' | 'other') || null,
      documentType: (documentType as 'cedula' | 'passport' | 'rnc') || null,
      documentNumber: documentNumber.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      allergies,
      chronicConditions,
    }
    try {
      if (isEdit && patient) {
        await updateMutation.mutateAsync(payload)
        onClose()
      } else {
        const created = await createMutation.mutateAsync(payload)
        if (onCreated) {
          onCreated(created)
        } else {
          onClose()
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'PatientModal.submit' })
      setError(isEdit ? patientModalStrings.updateError : patientModalStrings.createError)
    }
  }

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent size={isView ? 'lg' : 'default'}>
        <ModalHeader title={title} showClose={isView} />

        {isView && patient ? (
          <ModalBody className="flex flex-col gap-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pb-5 border-b border-n-100">
              <ReadField
                label={patientModalStrings.readDocumentLabel}
                value={
                  patient.documentNumber
                    ? `${DOC_LABELS[patient.documentType ?? ''] ?? patient.documentType} · ${patient.documentNumber}`
                    : null
                }
              />
              <ReadField
                label={patientModalStrings.readDobLabel}
                value={
                  patient.dateOfBirth
                    ? `${formatDate(patient.dateOfBirth)} (${formatAge(patient.dateOfBirth)})`
                    : null
                }
              />
              <ReadField
                label={patientModalStrings.readSexLabel}
                value={patient.sex ? SEX_LABELS[patient.sex] : null}
              />
              <ReadField label={patientModalStrings.readPhoneLabel} value={patient.phone} />
              <ReadField label={patientModalStrings.readEmailLabel} value={patient.email} />
              {patient.notes && (
                <div className="col-span-2">
                  <ReadField label={patientModalStrings.readNotesLabel} value={patient.notes} />
                </div>
              )}
            </div>

            {(patient.allergies.length > 0 || patient.chronicConditions.length > 0) && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 border-b border-n-100">
                {patient.allergies.length > 0 && (
                  <div>
                    <div className="text-2xs font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
                      {patientModalStrings.allergiesLabel}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {patient.allergies.map((a) => (
                        <Badge key={a} variant="overdue" showDot={false}>
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {patient.chronicConditions.length > 0 && (
                  <div>
                    <div className="text-2xs font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
                      {patientModalStrings.chronicConditionsLabel}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {patient.chronicConditions.map((c) => (
                        <Badge key={c} variant="review" showDot={false}>
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <ClinicalHistory
              patientId={patient.id}
              {...(primaryLocationId ? { locationId: primaryLocationId } : {})}
            />
          </ModalBody>
        ) : (
          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
          >
            <ModalBody className="flex flex-col gap-4">
              <Field label={patientModalStrings.nameLabel} required>
                <Input
                  type="text"
                  placeholder={patientModalStrings.namePlaceholder}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus={isCreate}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={patientModalStrings.dobLabel}>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </Field>
                <Field label={patientModalStrings.sexLabel}>
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger>
                      <SelectValue placeholder={patientModalStrings.sexPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">{patientModalStrings.sexFemale}</SelectItem>
                      <SelectItem value="male">{patientModalStrings.sexMale}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={patientModalStrings.docTypeLabel}>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger>
                      <SelectValue placeholder={patientModalStrings.docTypePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cedula">{patientModalStrings.docTypeCedula}</SelectItem>
                      <SelectItem value="passport">
                        {patientModalStrings.docTypePassport}
                      </SelectItem>
                      <SelectItem value="rnc">{patientModalStrings.docTypeRnc}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={patientModalStrings.docNumberLabel}>
                  <Input
                    type="text"
                    placeholder={patientModalStrings.docNumberPlaceholder}
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={patientModalStrings.phoneLabel}>
                  <Input
                    type="tel"
                    placeholder={patientModalStrings.phonePlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field label={patientModalStrings.emailLabel}>
                  <Input
                    type="email"
                    placeholder={patientModalStrings.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>

              <Field label={patientModalStrings.notesLabel}>
                <Textarea
                  placeholder={patientModalStrings.notesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px]"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={patientModalStrings.allergiesLabel} id="patient-allergies">
                  <TagInput
                    id="patient-allergies"
                    value={allergies}
                    onChange={setAllergies}
                    placeholder={patientModalStrings.tagInputPlaceholder}
                    removeAriaLabel={patientModalStrings.tagRemoveAria}
                  />
                </Field>
                <Field
                  label={patientModalStrings.chronicConditionsLabel}
                  id="patient-chronic-conditions"
                >
                  <TagInput
                    id="patient-chronic-conditions"
                    value={chronicConditions}
                    onChange={setChronicConditions}
                    placeholder={patientModalStrings.tagInputPlaceholder}
                    removeAriaLabel={patientModalStrings.tagRemoveAria}
                  />
                </Field>
              </div>

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
                {patientModalStrings.cancelButton}
              </Button>
              <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
                {isPending
                  ? patientModalStrings.savingButton
                  : isEdit
                    ? patientModalStrings.saveButton
                    : patientModalStrings.registerButton}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}
