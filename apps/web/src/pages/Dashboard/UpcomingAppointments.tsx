import { useNavigate } from 'react-router-dom'
import { TextLink } from '@/components/ui'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { UpcomingRow } from './UpcomingRow'
import { dashboardStrings } from './strings'

export interface UpcomingAppointmentsProps {
  appointments: AppointmentWithDetails[]
  isLoading: boolean
}

export function UpcomingAppointments({
  appointments,
  isLoading,
}: UpcomingAppointmentsProps): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="col-span-2 bg-n-0 border border-n-200 rounded-md p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="font-serif font-medium text-h3 text-n-900 m-0 tracking-heading-sm">
          {dashboardStrings.upcomingTitle}
        </h3>
        <TextLink tone="neutral" size="md" onClick={() => void navigate('/agenda')}>
          {dashboardStrings.upcomingViewAll}
        </TextLink>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 bg-n-50 rounded animate-pulse" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <i className="ph ph-calendar-blank text-h2 text-n-300 mb-2" />
          <p className="text-sm text-n-400 m-0">{dashboardStrings.upcomingEmpty}</p>
        </div>
      ) : (
        <div>
          {appointments.slice(0, 5).map((appt, idx) => (
            <UpcomingRow key={appt.id} appt={appt} isFirst={idx === 0} />
          ))}
        </div>
      )}
    </div>
  )
}
