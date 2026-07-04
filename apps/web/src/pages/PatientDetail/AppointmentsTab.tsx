import { Link } from 'react-router-dom'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { Badge, EmptyState, Spinner, TextLink } from '@/components/ui'
import { useAppointments } from '@/hooks/appointments/use-appointments'
import { useStartConsultation } from '@/hooks/consultations/use-start-consultation'
import { statusBadgeVariant, statusLabel, formatTime } from '@/pages/Schedule/helpers'
import { patientDetailStrings as s } from './strings'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface AppointmentsTabProps {
  patientId: string
}

export function AppointmentsTab({ patientId }: AppointmentsTabProps): JSX.Element {
  // Patient-level list: NOT scoped to the doctor's active location.
  const { data: appointments = [], isLoading, isError } = useAppointments({ patientId })
  const { start, isStarting } = useStartConsultation()

  if (isLoading) {
    return <TabSpinner />
  }

  if (isError) {
    return <p className="text-[13px] font-sans text-danger-text">{s.loadError}</p>
  }

  if (appointments.length === 0) {
    return (
      <EmptyState icon={<i className="ph ph-calendar-blank" />} title={s.appointmentsEmpty} />
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-n-100">
      {appointments.map((appt) => (
        <AppointmentRow
          key={appt.id}
          appt={appt}
          onStart={() => start(appt)}
          isStarting={isStarting}
        />
      ))}
    </ul>
  )
}

interface AppointmentRowProps {
  appt: AppointmentWithDetails
  onStart: () => void
  isStarting: boolean
}

function AppointmentRow({ appt, onStart, isStarting }: AppointmentRowProps): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[13px] font-sans text-n-800 whitespace-nowrap">
          {formatDate(appt.startsAt)}
        </span>
        <span className="text-[12px] font-mono text-n-500 whitespace-nowrap">
          {formatTime(appt.startsAt)}
        </span>
        <span className="text-[12px] font-sans text-n-500 truncate">{appt.locationName}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={statusBadgeVariant(appt.status)}>{statusLabel(appt.status)}</Badge>
        {appt.consultationId !== null ? (
          <Link
            to={`/consultas/${appt.consultationId}`}
            className="inline-flex items-center gap-1 text-[12px] font-sans text-p-500 hover:text-p-700 hover:underline underline-offset-2"
          >
            <i className="ph ph-file-text text-[14px]" />
            {s.viewConsultation}
          </Link>
        ) : (
          appt.status === 'scheduled' && (
            <TextLink
              tone="primary"
              size="md"
              underline="hover"
              onClick={onStart}
              disabled={isStarting}
            >
              <i className="ph ph-play-circle text-[14px]" />
              {s.startConsultation}
            </TextLink>
          )
        )}
      </div>
    </li>
  )
}

function TabSpinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner size="md" className="text-n-400" />
    </div>
  )
}
