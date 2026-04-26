import { useState, useRef } from 'react'
import {
  usePatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from '@/hooks/patients/use-patients'
import type { Patient } from '@rezeta/shared'
import {
  Button,
  Badge,
  EmptyState,
  Callout,
  Card,
  InputGroup,
  InputIcon,
  Input,
  Field,
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
      <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-0.5">
        {label}
      </div>
      <div className="text-[13px] font-sans text-n-700">
        {value || <span className="text-n-300">—</span>}
      </div>
    </div>
  )
}

// ─── Clinical History (stub — wired up once consultations module is built) ────

function ClinicalHistory({ patientId }: { patientId: string }): JSX.Element {
  // TODO: replace with usePatientConsultations(patientId) once consultations module is built
  void patientId
  const consultations: never[] = []

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[13px] font-sans font-semibold text-n-800 uppercase tracking-[0.06em]">
          Historia clínica
        </h3>
        <span className="text-[11px] font-mono text-n-400 border border-n-200 rounded px-1.5 py-0.5">
          {consultations.length}
        </span>
      </div>

      {consultations.length === 0 ? (
        <div className="flex flex-col items-center py-8 border border-dashed border-n-200 rounded-md">
          <i className="ph ph-notepad text-[28px] text-n-300 mb-2" />
          <p className="text-[13px] text-n-400">No hay consultas registradas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Consultation entries rendered here once available */}
        </div>
      )}
    </div>
  )
}

// ─── Patient Modal (create / edit / view) ────────────────────────────────────

type ModalMode = 'create' | 'edit' | 'view'

interface PatientModalProps {
  mode: ModalMode
  patient?: Patient
  onClose: () => void
}

function PatientModal({ mode, patient, onClose }: PatientModalProps): JSX.Element {
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

  async function handleSubmit(e: React.FormEvent) {
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
          /* ── View mode ─────────────────────────────────────── */
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

            {/* Allergies + Chronic conditions */}
            {(patient.allergies.length > 0 || patient.chronicConditions.length > 0) && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 border-b border-n-100">
                {patient.allergies.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-1.5">
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
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-1.5">
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
          /* ── Create / Edit form ────────────────────────────── */
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

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  patient: Patient
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
  error: string | null
}

function DeleteConfirmModal({
  patient,
  onConfirm,
  onClose,
  isDeleting,
  error,
}: DeleteConfirmModalProps): JSX.Element {
  const name = `${patient.firstName} ${patient.lastName}`.trim()
  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader
          icon={<i className="ph ph-trash" />}
          iconVariant="danger"
          title="Eliminar paciente"
          subtitle={`¿Eliminar a ${name}? Esta acción no se puede deshacer y eliminará todos sus datos del sistema.`}
          showClose={false}
        />
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Eliminando...' : 'Eliminar paciente'}
          </Button>
        </ModalFooter>
        {error && (
          <div className="px-6 pb-4 -mt-2">
            <Callout
              variant="danger"
              icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}
            >
              {error}
            </Callout>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}

// ─── Patient Row ──────────────────────────────────────────────────────────────

interface PatientRowProps {
  patient: Patient
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}

function PatientRow({ patient, onView, onEdit, onDelete }: PatientRowProps): JSX.Element {
  const name = `${patient.firstName} ${patient.lastName}`
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()

  return (
    <tr className="hover:bg-n-25">
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <div className="flex items-center gap-2">
          <div className="w-[30px] h-[30px] rounded-full bg-p-50 text-p-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-semibold text-n-800">{name}</div>
            {patient.phone && <div className="text-[12px] text-n-500">{patient.phone}</div>}
          </div>
        </div>
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100 font-mono text-[12px] text-n-600">
        {patient.documentNumber ?? '—'}
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100 text-n-600">
        {formatAge(patient.dateOfBirth)}
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <Badge variant="active">Activo</Badge>
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={onView}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-sm text-n-500 hover:bg-n-100 hover:text-n-800 transition-colors duration-[100ms]"
            title="Ver paciente"
          >
            <i className="ph ph-eye text-[15px]" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-sm text-n-500 hover:bg-n-100 hover:text-n-800 transition-colors duration-[100ms]"
            title="Editar paciente"
          >
            <i className="ph ph-pencil-simple text-[15px]" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-sm text-n-500 hover:bg-danger-bg hover:text-danger-text transition-colors duration-[100ms]"
            title="Eliminar paciente"
          >
            <i className="ph ph-trash text-[15px]" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Pacientes(): JSX.Element {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  const { data, isLoading, isError } = usePatients(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  )
  const deleteMutation = useDeletePatient()

  function handleSearch(value: string) {
    setSearch(value)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setDebouncedSearch(value), 300)
  }

  function openCreate() {
    setSelectedPatient(null)
    setModalMode('create')
  }

  function openView(patient: Patient) {
    setSelectedPatient(patient)
    setModalMode('view')
  }

  function openEdit(patient: Patient) {
    setSelectedPatient(patient)
    setModalMode('edit')
  }

  function openDelete(patient: Patient) {
    setDeleteError(null)
    setDeletingPatient(patient)
  }

  function closeModal() {
    setModalMode(null)
    setSelectedPatient(null)
  }

  async function handleDelete() {
    if (!deletingPatient) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync(deletingPatient.id)
      setDeletingPatient(null)
    } catch {
      setDeleteError('No se pudo eliminar el paciente. Intenta de nuevo.')
    }
  }

  return (
    <div>
      {modalMode && selectedPatient && (
        <PatientModal mode={modalMode} patient={selectedPatient} onClose={closeModal} />
      )}

      {deletingPatient && (
        <DeleteConfirmModal
          patient={deletingPatient}
          onConfirm={() => {
            void handleDelete()
          }}
          onClose={() => {
            setDeletingPatient(null)
            setDeleteError(null)
          }}
          isDeleting={deleteMutation.isPending}
          error={deleteError}
        />
      )}

      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">Pacientes</h1>
        <Button variant="primary" onClick={openCreate}>
          <i className="ph ph-plus mr-1.5" />
          Registrar paciente
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center p-4 border-b border-n-100">
          <InputGroup className="max-w-[320px]">
            <InputIcon side="left">
              <i className="ph ph-magnifying-glass text-[16px]" />
            </InputIcon>
            <Input
              type="search"
              placeholder="Buscar por nombre, cédula, teléfono..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </InputGroup>
        </div>

        {isLoading && <div className="p-8 text-center text-n-400">Cargando pacientes...</div>}

        {isError && (
          <div className="m-4">
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              No se pudo cargar la lista de pacientes.
            </Callout>
          </div>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={<i className="ph ph-user" />}
            title="Aún no hay pacientes registrados"
            description="Registra a tu primer paciente para empezar a gestionar citas, consultas y prescripciones desde un solo lugar."
            action={
              <Button variant="primary" onClick={openCreate}>
                Registrar paciente
              </Button>
            }
            className="rounded-none border-0"
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Paciente
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Cédula / Documento
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Edad
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  onView={() => openView(patient)}
                  onEdit={() => openEdit(patient)}
                  onDelete={() => openDelete(patient)}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
