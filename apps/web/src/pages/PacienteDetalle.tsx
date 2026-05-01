import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePatient, useUpdatePatient } from '@/hooks/patients/use-patients'
import { usePatientConsultations } from '@/hooks/consultations/use-consultations'
import type { Patient, ConsultationWithDetails } from '@rezeta/shared'
import {
  Button,
  Badge,
  Callout,
  Field,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—'
  const years = Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  )
  return `${years} años`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const SEX_LABELS: Record<string, string> = { male: 'Masculino', female: 'Femenino', other: 'Otro' }
const DOC_LABELS: Record<string, string> = { cedula: 'Cédula', passport: 'Pasaporte', rnc: 'RNC' }

// ─── Read-only field ──────────────────────────────────────────────────────────

function ReadField({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-1">
        {label}
      </div>
      <div className="text-[13px] font-sans text-n-700">
        {value || <span className="text-n-300">—</span>}
      </div>
    </div>
  )
}

// ─── Consultation list item ───────────────────────────────────────────────────

function ConsultationListItem({
  consultation,
}: {
  consultation: ConsultationWithDetails
}): JSX.Element {
  const navigate = useNavigate()
  const date = new Date(consultation.consultedAt).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const isSigned = consultation.status === 'signed'

  return (
    <button
      type="button"
      onClick={() => void navigate(`/consultas/${consultation.id}`)}
      className="flex items-center gap-3 w-full text-left px-3 py-3 rounded border border-n-200 bg-n-0 hover:bg-n-25 transition-colors"
    >
      <i className="ph ph-notepad text-[16px] text-n-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-sans font-semibold text-n-800 truncate">
          {consultation.chiefComplaint ?? 'Sin motivo registrado'}
        </div>
        <div className="text-[11.5px] text-n-500 mt-1">
          {date} · {consultation.locationName}
        </div>
      </div>
      <span
        className={`text-[10.5px] font-mono px-2 py-1 rounded border shrink-0 ${
          isSigned ? 'bg-p-50 border-p-100 text-p-700' : 'bg-n-50 border-n-200 text-n-500'
        }`}
      >
        {isSigned ? 'Firmada' : 'Borrador'}
      </span>
      <i className="ph ph-caret-right text-[13px] text-n-300 shrink-0" />
    </button>
  )
}

// ─── Clinical history ─────────────────────────────────────────────────────────

function ClinicalHistory({ patientId }: { patientId: string }): JSX.Element {
  const navigate = useNavigate()
  const { data: consultations = [], isLoading } = usePatientConsultations(patientId)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-mono font-semibold text-n-600 uppercase tracking-[0.08em]">
            Historia clínica
          </h2>
          {!isLoading && (
            <span className="text-[11px] font-mono text-n-400 border border-n-200 rounded px-2 py-1">
              {consultations.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void navigate(`/consultas/nueva?patientId=${patientId}`)}
          className="flex items-center gap-1 text-[11.5px] font-sans text-p-700 hover:text-p-900 transition-colors"
        >
          <i className="ph ph-plus text-[12px]" />
          Nueva consulta
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-[12.5px] text-n-400 justify-center">
          <i className="ph ph-spinner animate-spin text-[13px]" /> Cargando…
        </div>
      ) : consultations.length === 0 ? (
        <div className="flex flex-col items-center py-10 border border-dashed border-n-200 rounded-md">
          <i className="ph ph-notepad text-[28px] text-n-300 mb-2" />
          <p className="text-[13px] text-n-400">No hay consultas registradas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {consultations.map((c) => (
            <ConsultationListItem key={c.id} consultation={c} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({ patient, onClose }: { patient: Patient; onClose: () => void }): JSX.Element {
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

  async function handleSubmit(e: React.FormEvent) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PacienteDetalle(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showEdit, setShowEdit] = useState(false)

  const { data: patient, isLoading, isError } = usePatient(id ?? '')

  if (!id) {
    void navigate('/pacientes', { replace: true })
    return <></>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="ph ph-spinner animate-spin text-[32px] text-n-400" />
      </div>
    )
  }

  if (isError || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[14px] font-sans text-n-600">Paciente no encontrado.</p>
        <Link to="/pacientes" className="text-[13px] font-sans text-p-500 hover:text-p-700">
          ← Volver a pacientes
        </Link>
      </div>
    )
  }

  const fullName = `${patient.firstName} ${patient.lastName}`.trim()
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()

  return (
    <div className="max-w-[800px] m-auto">
      {showEdit && <EditModal patient={patient} onClose={() => setShowEdit(false)} />}

      {/* Back nav */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/pacientes"
          className="flex items-center gap-2 text-[12.5px] font-sans text-n-500 hover:text-n-800 transition-colors"
        >
          <i className="ph ph-arrow-left text-[14px]" />
          Pacientes
        </Link>
        <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
          <i className="ph ph-pencil-simple mr-2 text-[14px]" />
          Editar
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-p-50 text-p-700 text-[16px] font-semibold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-h2 font-serif font-medium text-n-900">{fullName}</h1>
          <p className="text-[12.5px] font-sans text-n-500 mt-1">
            {patient.dateOfBirth ? `${formatAge(patient.dateOfBirth)} · ` : ''}
            {patient.documentNumber
              ? `${DOC_LABELS[patient.documentType ?? ''] ?? patient.documentType} ${patient.documentNumber}`
              : 'Sin documento'}
          </p>
        </div>
      </div>

      {/* Demographics */}
      <div className="border border-n-200 rounded-md bg-n-0 p-5 mb-4">
        <h2 className="text-[12px] font-mono font-semibold text-n-600 uppercase tracking-[0.08em] mb-4">
          Datos personales
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
      </div>

      {/* Medical info */}
      {(patient.allergies.length > 0 || patient.chronicConditions.length > 0) && (
        <div className="border border-n-200 rounded-md bg-n-0 p-5 mb-4">
          <h2 className="text-[12px] font-mono font-semibold text-n-600 uppercase tracking-[0.08em] mb-4">
            Antecedentes médicos
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
        </div>
      )}

      {/* Clinical history */}
      <div className="border border-n-200 rounded-md bg-n-0 p-5">
        <ClinicalHistory patientId={patient.id} />
      </div>
    </div>
  )
}
