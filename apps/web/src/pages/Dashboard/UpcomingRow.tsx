import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui'
import type { BadgeProps } from '@/components/ui'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { formatTime, minutesUntil, statusBadgeVariant, statusLabel } from './helpers'
import { dashboardStrings } from './strings'

export interface UpcomingRowProps {
  appt: AppointmentWithDetails
  isFirst: boolean
}

export function UpcomingRow({ appt, isFirst }: UpcomingRowProps): JSX.Element {
  const navigate = useNavigate()
  const initials = appt.patientName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()

  const isPending = appt.status === 'scheduled'
  const isCompleted = appt.status === 'completed'

  let badgeVariant: BadgeProps['variant'] = 'draft'
  let badgeLabel = statusLabel(appt.status)

  if (isPending) {
    const mins = minutesUntil(appt.startsAt)
    if (mins >= 0 && mins <= 30) {
      badgeVariant = 'active'
      badgeLabel = dashboardStrings.upcomingRowPending
    } else {
      badgeVariant = 'draft'
    }
  } else {
    badgeVariant = statusBadgeVariant(appt.status)
  }

  return (
    <button
      type="button"
      onClick={() => void navigate('/agenda')}
      className={[
        'relative flex items-center gap-4 w-full text-left py-[10px] pl-[14px] pr-4',
        'border-b border-n-100 last:border-b-0 transition-colors hover:bg-n-25',
        'before:absolute before:left-0 before:top-[12px] before:bottom-[12px] before:w-[2px] before:bg-p-500',
        !isFirst && isCompleted ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="w-[28px] h-[28px] rounded-full bg-p-50 text-p-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-n-900 truncate">{appt.patientName}</div>
        {appt.reason && <div className="text-[12px] text-n-500 truncate mt-1">{appt.reason}</div>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-[12px] text-n-500">{formatTime(appt.startsAt)}</span>
        <Badge variant={badgeVariant} showDot>
          {badgeLabel}
        </Badge>
      </div>
    </button>
  )
}
