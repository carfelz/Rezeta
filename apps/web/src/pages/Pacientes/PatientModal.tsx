import { useState } from 'react'
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
  Textarea,
} from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { useCreatePatient, useUpdatePatient } from '@/hooks/patients/use-patients'
import { ClinicalHistory } from './ClinicalHistory'
import { ReadField } from './ReadField'
import { DOC_LABELS, SEX_LABELS, formatAge, formatDate } from './helpers'

export type PatientModalMode = 'create' | 'edit' | 'view'

export interface PatientModalProps {
  mode: PatientModalMode
  patient?: Patient
  onClose: () => void
}

export function PatientModal({ mode, patient, onClose }: PatientModalProps): JSX.Element {
  const createMutation = useCreatePatient()
  const updateMutation = useUpdatePatient(patient?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

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
  const [error, setError] = useState<string | null>(null)

  const canSubmit = fullName.trim().length >= 2

  const title = isView
    ? `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim()
    : isEdit
      ? 'Editar paciente'
      : 'Registrar paciente'

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
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
      allergies: patient?.allergies ?? [],
      chronicConditions: patient?.chronicConditions ?? [],
    }
    try {
      if (isEdit && patient) {
        await updateMutation.mutateAsync(payload)
      } else {
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch {
      setError(
        isEdit
          ? 'No se pudo actualizar el paciente. Intenta de nuevo.'
          : 'No se pudo registrar el paciente. Intenta de nuevo.',
      )
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
                label="Documento"
                value={
                  patient.documentNumber
                    ? `${DOC_LABELS[patient.documentType ?? ''] ?? patient.documentType} · ${patient.documentNumber}`
                    : null
                }
              />
              <ReadField
                label="Fecha de nacimiento"
                value={
                  patient.dateOfBirth
                    ? `${formatDate(patient.dateOfBirth)} (${formatAge(patient.dateOfBirth)})`
                    : null
                }
              />
              <ReadField label="Sexo" value={patient.sex ? SEX_LABELS[patient.sex] : null} />
              <ReadField label="Teléfono" value={patient.phone} />
              <ReadField label="Correo electrónico" value={patient.email} />
              {patient.notes && (
                <div className="col-span-2">
                  <ReadField label="Notas" value={patient.notes} />
                </div>
              )}
            </div>

            {(patient.allergies.length > 0 || patient.chronicConditions.length > 0) && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 border-b border-n-100">
                {patient.allergies.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
                      Alergias
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
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
                      Condiciones crónicas
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

            <ClinicalHistory patientId={patient.id} />
          </ModalBody>
        ) : (
          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
          >
            <ModalBody className="flex flex-col gap-4">
              <Field label="Nombre completo" required>
                <Input
                  type="text"
                  placeholder="Ej. Ana María Reyes"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus={isCreate}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de nacimiento">
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </Field>
                <Field label="Sexo">
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Femenino</SelectItem>
                      <SelectItem value="male">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de documento">
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cedula">Cédula</SelectItem>
                      <SelectItem value="passport">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Número de documento">
                  <Input
                    type="text"
                    placeholder="Ej. 001-1234567-8"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono">
                  <Input
                    type="tel"
                    placeholder="Ej. 809-555-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field label="Correo electrónico">
                  <Input
                    type="email"
                    placeholder="Ej. ana@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Notas">
                <Textarea
                  placeholder="Observaciones iniciales..."
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
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
                {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar paciente'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}
