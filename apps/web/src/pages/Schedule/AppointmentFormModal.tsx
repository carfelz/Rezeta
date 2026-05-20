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
import { useCreateAppointment, useUpdateAppointment } from '@/hooks/appointments/use-appointments'
import { useLocations } from '@/hooks/locations/use-locations'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { PatientCombobox } from './PatientCombobox'
import { toDateInputValue } from './helpers'
import { appointmentFormModalStrings } from './strings'

export interface AppointmentFormModalProps {
  appointment?: AppointmentWithDetails
  defaultDate: string
  defaultLocationId: string
  onClose: () => void
}

export function AppointmentFormModal({
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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)

    const startsAt = new Date(`${date}T${startTime}:00`).toISOString()
    const endsAt = new Date(`${date}T${endTime}:00`).toISOString()

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError(appointmentFormModalStrings.timeOrderError)
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
        setError(appointmentFormModalStrings.conflictError)
      } else {
        setError(
          isEdit
            ? appointmentFormModalStrings.updateError
            : appointmentFormModalStrings.createError,
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
        <ModalHeader
          title={
            isEdit ? appointmentFormModalStrings.titleEdit : appointmentFormModalStrings.titleCreate
          }
          showClose={false}
        />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            {!isEdit && (
              <Field label={appointmentFormModalStrings.patientLabel} required>
                <PatientCombobox value={patientId} onChange={(id) => setPatientId(id)} />
              </Field>
            )}

            <Field label={appointmentFormModalStrings.locationLabel} required>
              <Select {...(locationId ? { value: locationId } : {})} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder={appointmentFormModalStrings.locationPlaceholder} />
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

            <Field label={appointmentFormModalStrings.dateLabel} required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={appointmentFormModalStrings.startTimeLabel} required>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field label={appointmentFormModalStrings.endTimeLabel} required>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
            </div>

            <Field label={appointmentFormModalStrings.reasonLabel}>
              <Input
                type="text"
                placeholder={appointmentFormModalStrings.reasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>

            <Field label={appointmentFormModalStrings.notesLabel}>
              <Textarea
                placeholder={appointmentFormModalStrings.notesPlaceholder}
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
              {appointmentFormModalStrings.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
              {isPending
                ? appointmentFormModalStrings.savingButton
                : isEdit
                  ? appointmentFormModalStrings.saveButton
                  : appointmentFormModalStrings.createButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
