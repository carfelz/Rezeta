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
    } catch {
      setError('No se pudo actualizar el paciente. Intenta de nuevo.')
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
        <ModalHeader title="Editar paciente" />
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
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
