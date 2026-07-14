import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Callout,
  DatePicker,
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
  TimePicker,
} from '@/components/ui'
import { useCreateAppointment, useUpdateAppointment } from '@/hooks/appointments/use-appointments'
import { useLocations } from '@/hooks/locations/use-locations'
import { useGetBlocks } from '@/hooks/schedules/use-schedules'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { PatientCombobox } from './PatientCombobox'
import {
  addMinutesToTime,
  nextSlotAfter,
  toDateInputValue,
  toTimeInputValue,
} from './helpers'
import { appointmentFormModalStrings } from './strings'

const DEFAULT_INTERVAL_MIN = 30

export interface AppointmentFormModalProps {
  appointment?: AppointmentWithDetails
  defaultDate: string
  defaultLocationId: string
  defaultPatientId?: string
  onClose: () => void
}

export function AppointmentFormModal({
  appointment,
  defaultDate,
  defaultLocationId,
  defaultPatientId,
  onClose,
}: AppointmentFormModalProps): JSX.Element {
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment(appointment?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

  const { data: locations } = useLocations()

  const isEdit = Boolean(appointment)

  const existingStart = appointment ? new Date(appointment.startsAt) : null
  const existingEnd = appointment ? new Date(appointment.endsAt) : null

  const initialPatientId = appointment?.patientId ?? defaultPatientId ?? ''
  const initialLocationId = appointment?.locationId ?? defaultLocationId
  const initialDate = existingStart ? toDateInputValue(existingStart) : defaultDate
  const initialStartTime = existingStart
    ? toTimeInputValue(existingStart)
    : nextSlotAfter(new Date(), DEFAULT_INTERVAL_MIN)
  const initialEndTime = existingEnd
    ? toTimeInputValue(existingEnd)
    : addMinutesToTime(initialStartTime, DEFAULT_INTERVAL_MIN)
  const initialReason = appointment?.reason ?? ''
  const initialNotes = appointment?.notes ?? ''

  const [patientId, setPatientId] = useState(initialPatientId)
  const [locationId, setLocationId] = useState(initialLocationId)
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [endTime, setEndTime] = useState(initialEndTime)
  const [reason, setReason] = useState(initialReason)
  const [notes, setNotes] = useState(initialNotes)
  const [error, setError] = useState<string | null>(null)

  const { data: blocks } = useGetBlocks(locationId || undefined)

  const intervalMin = useMemo(() => {
    if (!blocks || blocks.length === 0 || !date) return DEFAULT_INTERVAL_MIN
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
    const match = blocks.find(
      (b) => b.dayOfWeek === dayOfWeek && b.locationId === locationId,
    )
    return match?.slotDurationMin ?? DEFAULT_INTERVAL_MIN
  }, [blocks, date, locationId])

  function handleStartTimeChange(value: string): void {
    setStartTime(value)
    setEndTime(addMinutesToTime(value, intervalMin))
  }

  function clearFields(): void {
    setPatientId(initialPatientId)
    setLocationId(initialLocationId)
    setDate(initialDate)
    setStartTime(initialStartTime)
    setEndTime(initialEndTime)
    setReason(initialReason)
    setNotes(initialNotes)
    setError(null)
  }

  function handleClose(): void {
    clearFields()
    onClose()
  }

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
      handleClose()
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

  useEffect(() => {
    if (isEdit) return
    setEndTime(addMinutesToTime(startTime, intervalMin))
  }, [intervalMin, isEdit, startTime])

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) handleClose()
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
                <PatientCombobox
                  value={patientId}
                  onChange={(id) => setPatientId(id)}
                />
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
              <DatePicker
                value={date}
                onChange={setDate}
                placeholder={appointmentFormModalStrings.datePlaceholder}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={appointmentFormModalStrings.startTimeLabel} required>
                <TimePicker
                  value={startTime}
                  onChange={handleStartTimeChange}
                  intervalMin={intervalMin}
                  placeholder={appointmentFormModalStrings.startTimePlaceholder}
                />
              </Field>
              <Field label={appointmentFormModalStrings.endTimeLabel} required>
                <TimePicker
                  value={endTime}
                  onChange={setEndTime}
                  intervalMin={intervalMin}
                  placeholder={appointmentFormModalStrings.endTimePlaceholder}
                />
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
                className="min-h-60"
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
            <Button type="button" variant="secondary" onClick={handleClose}>
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
