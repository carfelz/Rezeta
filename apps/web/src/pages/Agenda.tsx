import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '@/store/ui.store'
import { useLocations } from '@/hooks/locations/use-locations'
import { usePatients } from '@/hooks/patients/use-patients'
import {
  useAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useUpdateAppointmentStatus,
  useDeleteAppointment,
} from '@/hooks/appointments/use-appointments'
import type { AppointmentWithDetails, AppointmentStatus, Patient } from '@rezeta/shared'
import {
  Button,
  Badge,
  EmptyState,
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
import type { BadgeProps } from '@/components/ui'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function statusBadgeVariant(status: AppointmentStatus): BadgeProps['variant'] {
  switch (status) {
    case 'completed':
      return 'active'
    case 'cancelled':
      return 'archived'
    case 'no_show':
      return 'review'
    default:
      return 'draft'
  }
}

function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Programada'
    case 'completed':
      return 'Completada'
    case 'cancelled':
      return 'Cancelada'
    case 'no_show':
      return 'No asistió'
  }
}

// ─── Patient Combobox ─────────────────────────────────────────────────────────

interface PatientComboboxProps {
  value: string
  onChange: (patientId: string, patientName: string) => void
}

function PatientCombobox({ value, onChange }: PatientComboboxProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const { data } = usePatients({ search })
  const patients: Patient[] = data?.items ?? []

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleSelect(p: Patient) {
    const name = `${p.firstName} ${p.lastName}`.trim()
    setSelectedName(name)
    setSearch('')
    setOpen(false)
    onChange(p.id, name)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        type="text"
        placeholder="Buscar paciente..."
        value={value && !open ? selectedName : search}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('', '')
        }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-n-0 border border-n-200 rounded shadow-floating z-50 max-h-[200px] overflow-y-auto">
          {patients.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-n-400">
              {search ? 'Sin resultados' : 'Escribe para buscar'}
            </div>
          ) : (
            patients.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full flex flex-col items-start px-3 py-2 text-left hover:bg-n-50 transition-colors duration-[100ms]"
                onClick={() => handleSelect(p)}
              >
                <span className="text-[13px] font-medium text-n-800">
                  {p.firstName} {p.lastName}
                </span>
                {p.documentNumber && (
                  <span className="text-[11.5px] font-mono text-n-400">{p.documentNumber}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Appointment Form Modal ───────────────────────────────────────────────────

interface AppointmentFormModalProps {
  appointment?: AppointmentWithDetails
  defaultDate: string
  defaultLocationId: string
  onClose: () => void
}

function AppointmentFormModal({
  appointment,
  defaultDate,
  defaultLocationId,
  onClose,
}: AppointmentFormModalProps): JSX.Element {
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment(appointment?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

  const { data: locations } = useLocations()

  const isEdit = Boolean(appointment)

  // Parse existing startsAt/endsAt into date and time parts
  const existingStart = appointment ? new Date(appointment.startsAt) : null
  const existingEnd = appointment ? new Date(appointment.endsAt) : null

  const [patientId, setPatientId] = useState(appointment?.patientId ?? '')
  const [locationId, setLocationId] = useState(appointment?.locationId ?? defaultLocationId)
  const [date, setDate] = useState(existingStart ? toDateInputValue(existingStart) : defaultDate)
  const [startTime, setStartTime] = useState(
    existingStart ? existingStart.toTimeString().slice(0, 5) : '09:00',
  )
  const [endTime, setEndTime] = useState(
    existingEnd ? existingEnd.toTimeString().slice(0, 5) : '09:30',
  )
  const [reason, setReason] = useState(appointment?.reason ?? '')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    Boolean(patientId) &&
    Boolean(locationId) &&
    Boolean(date) &&
    Boolean(startTime) &&
    Boolean(endTime)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const startsAt = new Date(`${date}T${startTime}:00`).toISOString()
    const endsAt = new Date(`${date}T${endTime}:00`).toISOString()

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          patientId,
          locationId,
          startsAt,
          endsAt,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
        })
      } else {
        await createMutation.mutateAsync({
          patientId,
          locationId,
          startsAt,
          endsAt,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
        })
      }
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data
        ?.error?.code
      if (msg === 'APPOINTMENT_CONFLICT') {
        setError('Este horario se solapa con otra cita. Elige un horario diferente.')
      } else {
        setError(
          isEdit
            ? 'No se pudo actualizar la cita. Intenta de nuevo.'
            : 'No se pudo crear la cita. Intenta de nuevo.',
        )
      }
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
        <ModalHeader title={isEdit ? 'Editar cita' : 'Nueva cita'} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            {!isEdit && (
              <Field label="Paciente" required>
                <PatientCombobox value={patientId} onChange={(id) => setPatientId(id)} />
              </Field>
            )}

            <Field label="Ubicación" required>
              <Select {...(locationId ? { value: locationId } : {})} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.city ? ` · ${loc.city}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fecha" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora inicio" required>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field label="Hora fin" required>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
            </div>

            <Field label="Motivo de consulta">
              <Input
                type="text"
                placeholder="Ej. Revisión de rutina"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>

            <Field label="Notas">
              <Textarea
                placeholder="Información adicional..."
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
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cita'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Appointment Card ─────────────────────────────────────────────────────────

interface AppointmentCardProps {
  appt: AppointmentWithDetails
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: AppointmentStatus) => void
  isUpdatingStatus: boolean
}

function AppointmentCard({
  appt,
  onEdit,
  onDelete,
  onStatusChange,
  isUpdatingStatus,
}: AppointmentCardProps): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-4 flex gap-4 hover:border-n-300 transition-colors duration-[100ms]">
      {/* Time column */}
      <div className="flex flex-col items-center shrink-0 w-[56px]">
        <span className="text-[13px] font-mono font-medium text-n-700">
          {formatTime(appt.startsAt)}
        </span>
        <span className="text-[11px] text-n-400 mt-0.5">{formatTime(appt.endsAt)}</span>
      </div>

      {/* 2px teal rule */}
      <div
        className="w-[2px] shrink-0 rounded-full self-stretch"
        style={{ background: 'var(--color-p-500)' }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[14px] font-semibold text-n-800">{appt.patientName}</div>
            {appt.patientDocumentNumber && (
              <div className="text-[11.5px] font-mono text-n-400">{appt.patientDocumentNumber}</div>
            )}
          </div>
          <Badge variant={statusBadgeVariant(appt.status)}>{statusLabel(appt.status)}</Badge>
        </div>

        {appt.reason && <div className="text-[13px] text-n-600 mt-1">{appt.reason}</div>}

        <div className="text-[12px] text-n-400 mt-1">
          <i className="ph ph-map-pin mr-1" />
          {appt.locationName}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 shrink-0">
        {appt.status === 'scheduled' && (
          <>
            <button
              type="button"
              className="flex items-center gap-1.5 text-[12px] text-success-text hover:underline"
              onClick={() => onStatusChange('completed')}
              disabled={isUpdatingStatus}
            >
              <i className="ph ph-check-circle text-[14px]" />
              Completar
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 text-[12px] text-warning-text hover:underline"
              onClick={() => onStatusChange('no_show')}
              disabled={isUpdatingStatus}
            >
              <i className="ph ph-user-x text-[14px]" />
              No asistió
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 text-[12px] text-n-500 hover:underline"
              onClick={onEdit}
            >
              <i className="ph ph-pencil-simple text-[14px]" />
              Editar
            </button>
          </>
        )}
        <button
          type="button"
          className="flex items-center gap-1.5 text-[12px] text-danger-text hover:underline mt-1"
          onClick={onDelete}
        >
          <i className="ph ph-trash text-[14px]" />
          Eliminar
        </button>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  appt: AppointmentWithDetails
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
}

function DeleteConfirmModal({
  appt,
  onConfirm,
  onClose,
  isDeleting,
}: DeleteConfirmModalProps): JSX.Element {
  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title="Eliminar cita" showClose={false} />
        <ModalBody>
          <p className="text-body text-n-700">
            ¿Eliminar la cita de <span className="font-semibold">{appt.patientName}</span> el{' '}
            {new Date(appt.startsAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'long' })}{' '}
            a las {formatTime(appt.startsAt)}? Esta acción no se puede deshacer.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Eliminando...' : 'Eliminar cita'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Agenda(): JSX.Element {
  const activeLocationId = useUiStore((s) => s.activeLocationId)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<AppointmentWithDetails | null>(null)
  const [deleting, setDeleting] = useState<AppointmentWithDetails | null>(null)

  const deleteMutation = useDeleteAppointment()

  // Day range: midnight to midnight
  const fromDate = new Date(currentDate)
  fromDate.setHours(0, 0, 0, 0)
  const toDate = new Date(currentDate)
  toDate.setHours(23, 59, 59, 999)

  const {
    data: appointments,
    isLoading,
    isError,
  } = useAppointments({
    ...(activeLocationId ? { locationId: activeLocationId } : {}),
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  })

  function prevDay() {
    setCurrentDate((d) => {
      const nd = new Date(d)
      nd.setDate(nd.getDate() - 1)
      return nd
    })
  }

  function nextDay() {
    setCurrentDate((d) => {
      const nd = new Date(d)
      nd.setDate(nd.getDate() + 1)
      return nd
    })
  }

  function goToday() {
    setCurrentDate(new Date())
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteMutation.mutateAsync(deleting.id)
    setDeleting(null)
  }

  const isToday = toDateInputValue(currentDate) === toDateInputValue(new Date())

  return (
    <div>
      {showCreate && (
        <AppointmentFormModal
          defaultDate={toDateInputValue(currentDate)}
          defaultLocationId={activeLocationId ?? ''}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <AppointmentFormModal
          appointment={editing}
          defaultDate={toDateInputValue(currentDate)}
          defaultLocationId={activeLocationId ?? ''}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          appt={deleting}
          onConfirm={() => {
            void handleDelete()
          }}
          onClose={() => setDeleting(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-h1 m-0">Agenda</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus mr-1.5" />
          Nueva cita
        </Button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-sm text-n-600 hover:bg-n-100 transition-colors duration-[100ms]"
          onClick={prevDay}
          aria-label="Día anterior"
        >
          <i className="ph ph-caret-left text-[14px]" />
        </button>
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-sm text-n-600 hover:bg-n-100 transition-colors duration-[100ms]"
          onClick={nextDay}
          aria-label="Día siguiente"
        >
          <i className="ph ph-caret-right text-[14px]" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-sans font-semibold text-n-800 capitalize">
            {formatDate(currentDate)}
          </span>
          {isToday && (
            <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-p-50 text-p-700 border border-p-100">
              Hoy
            </span>
          )}
        </div>
        {!isToday && (
          <button
            type="button"
            className="text-[13px] text-p-500 hover:text-p-700 font-medium ml-1"
            onClick={goToday}
          >
            Ir a hoy
          </button>
        )}
      </div>

      {/* Content */}
      {!activeLocationId && (
        <Callout variant="info" icon={<i className="ph ph-info" style={{ fontSize: 18 }} />}>
          Selecciona una ubicación en la barra superior para ver las citas del día.
        </Callout>
      )}

      {activeLocationId && isLoading && <p className="text-body text-n-500">Cargando citas...</p>}

      {activeLocationId && isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          No se pudieron cargar las citas. Intenta recargar la página.
        </Callout>
      )}

      {activeLocationId && !isLoading && !isError && (appointments?.length ?? 0) === 0 && (
        <EmptyState
          icon={<i className="ph ph-calendar-blank" />}
          title="No hay citas para este día"
          description="Agenda la primera cita del día para comenzar."
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              Nueva cita
            </Button>
          }
        />
      )}

      {activeLocationId && !isLoading && !isError && (appointments?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3">
          {appointments!.map((appt) => (
            <AppointmentCardWithMutation
              key={appt.id}
              appt={appt}
              onEdit={() => setEditing(appt)}
              onDelete={() => setDeleting(appt)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card wrapper with its own status mutation ─────────────────────────────

function AppointmentCardWithMutation({
  appt,
  onEdit,
  onDelete,
}: {
  appt: AppointmentWithDetails
  onEdit: () => void
  onDelete: () => void
}): JSX.Element {
  const statusMutation = useUpdateAppointmentStatus(appt.id)

  return (
    <AppointmentCard
      appt={appt}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={(status) => {
        void statusMutation.mutateAsync({ status })
      }}
      isUpdatingStatus={statusMutation.isPending}
    />
  )
}
