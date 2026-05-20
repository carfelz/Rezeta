import { useState } from 'react'
import { Button, Callout, EmptyState } from '@/components/ui'
import { useAppointments, useDeleteAppointment } from '@/hooks/appointments/use-appointments'
import { useUiStore } from '@/store/ui.store'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { AppointmentCardWithMutation } from './AppointmentCardWithMutation'
import { AppointmentFormModal } from './AppointmentFormModal'
import { DateNavigation } from './DateNavigation'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { toDateInputValue } from './helpers'
import { schedulePageStrings } from './strings'

export function Schedule(): JSX.Element {
  const activeLocationId = useUiStore((s) => s.activeLocationId)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<AppointmentWithDetails | null>(null)
  const [deleting, setDeleting] = useState<AppointmentWithDetails | null>(null)

  const deleteMutation = useDeleteAppointment()

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

  function prevDay(): void {
    setCurrentDate((d) => {
      const nd = new Date(d)
      nd.setDate(nd.getDate() - 1)
      return nd
    })
  }

  function nextDay(): void {
    setCurrentDate((d) => {
      const nd = new Date(d)
      nd.setDate(nd.getDate() + 1)
      return nd
    })
  }

  function goToday(): void {
    setCurrentDate(new Date())
  }

  async function handleDelete(): Promise<void> {
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

      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-h1 m-0">{schedulePageStrings.pageTitle}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus mr-2" />
          {schedulePageStrings.newAppointmentButton}
        </Button>
      </div>

      <DateNavigation
        currentDate={currentDate}
        isToday={isToday}
        onPrev={prevDay}
        onNext={nextDay}
        onToday={goToday}
      />

      {!activeLocationId && (
        <Callout variant="info" icon={<i className="ph ph-info" style={{ fontSize: 18 }} />}>
          {schedulePageStrings.selectLocationInfo}
        </Callout>
      )}

      {activeLocationId && isLoading && (
        <p className="text-body text-n-500">{schedulePageStrings.loading}</p>
      )}

      {activeLocationId && isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {schedulePageStrings.loadError}
        </Callout>
      )}

      {activeLocationId && !isLoading && !isError && (appointments?.length ?? 0) === 0 && (
        <EmptyState
          icon={<i className="ph ph-calendar-blank" />}
          title={schedulePageStrings.emptyTitle}
          description={schedulePageStrings.emptyDescription}
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              {schedulePageStrings.newAppointmentButton}
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
