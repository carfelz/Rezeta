import { Badge, Stack, TextLink } from '@/components/ui'
import type { AppointmentStatus, AppointmentWithDetails } from '@rezeta/shared'
import { formatTime, statusBadgeVariant, statusLabel } from './helpers'

export interface AppointmentCardProps {
  appt: AppointmentWithDetails
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: AppointmentStatus) => void
  isUpdatingStatus: boolean
}

export function AppointmentCard({
  appt,
  onEdit,
  onDelete,
  onStatusChange,
  isUpdatingStatus,
}: AppointmentCardProps): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-4 flex gap-4 hover:border-n-300 transition-colors duration-[100ms]">
      <div className="flex flex-col items-center shrink-0 w-[56px]">
        <span className="text-[13px] font-mono font-medium text-n-700">
          {formatTime(appt.startsAt)}
        </span>
        <span className="text-[11px] text-n-400 mt-1">{formatTime(appt.endsAt)}</span>
      </div>

      <div
        className="w-[2px] shrink-0 rounded-full self-stretch"
        style={{ background: 'var(--color-p-500)' }}
      />

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

      <Stack gap={1} className="shrink-0">
        {appt.status === 'scheduled' && (
          <>
            <TextLink
              tone="primary"
              size="md"
              underline="hover"
              onClick={() => onStatusChange('completed')}
              disabled={isUpdatingStatus}
              className="text-success-text hover:text-success-text"
            >
              <i className="ph ph-check-circle text-[14px]" />
              Completar
            </TextLink>
            <TextLink
              tone="warning"
              size="md"
              underline="hover"
              onClick={() => onStatusChange('no_show')}
              disabled={isUpdatingStatus}
            >
              <i className="ph ph-user-x text-[14px]" />
              No asistió
            </TextLink>
            <TextLink tone="neutral" size="md" underline="hover" onClick={onEdit}>
              <i className="ph ph-pencil-simple text-[14px]" />
              Editar
            </TextLink>
          </>
        )}
        <TextLink tone="danger" size="md" underline="hover" onClick={onDelete} className="mt-1">
          <i className="ph ph-trash text-[14px]" />
          Eliminar
        </TextLink>
      </Stack>
    </div>
  )
}
