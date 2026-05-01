import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { strings } from '@/lib/strings'
import { useTodayAppointments } from '@/hooks/appointments/use-appointments'
import { usePatients } from '@/hooks/patients/use-patients'
import { Badge } from '@/components/ui'
import type { AppointmentWithDetails, AppointmentStatus } from '@rezeta/shared'
import type { BadgeProps } from '@/components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function formatDateKicker(date: Date): string {
  const day = DAYS_ES[date.getDay()]
  const dayNum = date.getDate()
  const month = MONTHS_ES[date.getMonth()]
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${day?.toUpperCase()} ${dayNum} DE ${month?.toUpperCase()} · ${h12}:${minutes} ${ampm}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-DO', {
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: string
  label: string
  value: string | number
  loading?: boolean
}): JSX.Element {
  return (
    <div className="border border-n-200 rounded-md bg-n-0 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-md bg-p-50 flex items-center justify-center shrink-0">
        <i className={`${icon} text-[18px] text-p-700`} />
      </div>
      <div>
        <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400">
          {label}
        </div>
        {loading ? (
          <div className="h-4 w-6 mt-0.5 bg-n-100 rounded animate-pulse" />
        ) : (
          <div className="text-[20px] font-serif font-medium text-n-900 leading-none mt-0.5">
            {value}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Appointment Row ──────────────────────────────────────────────────────────

function AppointmentRow({ appt }: { appt: AppointmentWithDetails }): JSX.Element {
  const navigate = useNavigate()
  const initials = appt.patientName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={() => void navigate(`/agenda`)}
      className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-n-25 transition-colors border-b border-n-100 last:border-b-0"
    >
      <div className="w-[30px] h-[30px] rounded-full bg-p-50 text-p-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-sans font-semibold text-n-800 truncate">
          {appt.patientName}
        </div>
        <div className="text-[11.5px] text-n-500 mt-0.5">
          {formatTime(appt.startsAt)} · {appt.locationName}
        </div>
      </div>
      {appt.reason && (
        <div className="text-[12px] text-n-500 truncate max-w-[160px] hidden sm:block">
          {appt.reason}
        </div>
      )}
      <Badge variant={statusBadgeVariant(appt.status)} showDot={false}>
        {statusLabel(appt.status)}
      </Badge>
    </button>
  )
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-md border border-n-200 bg-n-0 hover:bg-n-25 hover:border-n-300 transition-colors text-[12.5px] font-sans text-n-700"
    >
      <i className={`${icon} text-[15px] text-n-500`} />
      {label}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const greeting = strings.DASHBOARD_GREETING(user?.fullName ?? null)

  const { data: todayAppts, isLoading: apptLoading } = useTodayAppointments()
  const { data: patients, isLoading: patientsLoading } = usePatients()

  const totalPatients = patients?.items.length ?? 0
  const todayCount = todayAppts?.length ?? 0

  const scheduledToday = (todayAppts ?? []).filter((a) => a.status !== 'cancelled')

  return (
    <div className="max-w-[900px]">
      <p className="text-overline font-mono font-medium text-n-500 uppercase mb-2">
        {formatDateKicker(new Date())}
      </p>
      <h1 className="text-h1 font-serif font-medium text-n-900 mb-6">{greeting}</h1>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <QuickAction
          icon="ph ph-plus"
          label="Nueva consulta"
          onClick={() => void navigate('/consultas/nueva')}
        />
        <QuickAction
          icon="ph ph-user-plus"
          label="Registrar paciente"
          onClick={() => void navigate('/pacientes')}
        />
        <QuickAction
          icon="ph ph-calendar-blank"
          label="Ver agenda"
          onClick={() => void navigate('/agenda')}
        />
        <QuickAction
          icon="ph ph-stack"
          label="Protocolos"
          onClick={() => void navigate('/protocolos')}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          icon="ph ph-calendar-check"
          label="Citas hoy"
          value={todayCount}
          loading={apptLoading}
        />
        <StatCard
          icon="ph ph-users"
          label={patients?.hasMore ? 'Pacientes (parcial)' : 'Pacientes'}
          value={totalPatients}
          loading={patientsLoading}
        />
        <StatCard
          icon="ph ph-check-circle"
          label="Completadas hoy"
          value={(todayAppts ?? []).filter((a) => a.status === 'completed').length}
          loading={apptLoading}
        />
      </div>

      {/* Today's agenda */}
      <div className="border border-n-200 rounded-md bg-n-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-n-100">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-mono font-semibold text-n-600 uppercase tracking-[0.08em]">
              Agenda de hoy
            </h2>
            {!apptLoading && (
              <span className="text-[11px] font-mono text-n-400 border border-n-200 rounded px-1.5 py-0.5">
                {scheduledToday.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void navigate('/agenda')}
            className="text-[11.5px] font-sans text-p-700 hover:text-p-900 transition-colors"
          >
            Ver agenda completa →
          </button>
        </div>

        {apptLoading ? (
          <div className="flex items-center gap-2 py-10 justify-center text-[12.5px] text-n-400">
            <i className="ph ph-spinner animate-spin text-[13px]" /> Cargando citas…
          </div>
        ) : scheduledToday.length === 0 ? (
          <div className="flex flex-col items-center py-10">
            <i className="ph ph-calendar-blank text-[28px] text-n-300 mb-2" />
            <p className="text-[13px] text-n-400">No hay citas programadas para hoy</p>
            <button
              type="button"
              onClick={() => void navigate('/agenda')}
              className="mt-3 text-[12px] font-sans text-p-700 hover:text-p-900 transition-colors"
            >
              Ir a la agenda
            </button>
          </div>
        ) : (
          <div>
            {scheduledToday.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
