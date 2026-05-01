import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useTodayAppointments } from '@/hooks/appointments/use-appointments'
import { usePatients } from '@/hooks/patients/use-patients'
import { useInvoices } from '@/hooks/invoices/use-invoices'
import { Badge } from '@/components/ui'
import type { AppointmentWithDetails, AppointmentStatus } from '@rezeta/shared'
import type { BadgeProps } from '@/components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function formatDateKicker(date: Date): string {
  const day = DAYS_ES[date.getDay()]
  const dayNum = date.getDate()
  const month = MONTHS_ES[date.getMonth()]
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${day} ${dayNum} de ${month} · ${h12}:${minutes} ${ampm}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-DO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000)
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
      return 'Confirmada'
    case 'completed':
      return 'Completada'
    case 'cancelled':
      return 'Cancelada'
    case 'no_show':
      return 'No asistió'
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaDir,
  loading,
}: {
  label: string
  value: string | number
  unit?: string
  delta: string
  deltaDir: 'up' | 'down' | 'flat'
  loading?: boolean
}): JSX.Element {
  const deltaIcon =
    deltaDir === 'up' ? 'ph-arrow-up' : deltaDir === 'down' ? 'ph-arrow-down' : 'ph-minus'
  const deltaColor =
    deltaDir === 'up'
      ? 'text-success-text'
      : deltaDir === 'down'
        ? 'text-danger-text'
        : 'text-n-500'

  return (
    <div className="bg-n-0 border border-n-200 rounded-md px-5 py-[18px]">
      <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-n-500 mb-[10px]">
        {label}
      </div>
      {loading ? (
        <div className="h-9 w-24 bg-n-100 rounded animate-pulse" />
      ) : (
        <div className="font-serif font-medium text-[34px] text-n-900 leading-none tracking-[-0.015em]">
          {value}
          {unit && (
            <span className="font-sans font-medium text-[13px] text-n-400 ml-1">{unit}</span>
          )}
        </div>
      )}
      <div className={`font-mono text-[11px] mt-2 flex items-center gap-1 ${deltaColor}`}>
        <i className={`ph ${deltaIcon}`} />
        {delta}
      </div>
    </div>
  )
}

// ─── Upcoming Appointment Row ─────────────────────────────────────────────────

function UpcomingRow({
  appt,
  isFirst,
}: {
  appt: AppointmentWithDetails
  isFirst: boolean
}): JSX.Element {
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
      badgeLabel = 'En espera'
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

// ─── Activity Item ────────────────────────────────────────────────────────────

function ActivityItem({
  initials,
  html,
  time,
}: {
  initials: string
  html: string
  time: string
}): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div className="w-[28px] h-[28px] rounded-full bg-p-50 text-p-700 text-[10px] font-semibold flex items-center justify-center shrink-0 mt-1">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-n-700" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="text-[11.5px] text-n-500 mt-1">{time}</div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: todayAppts, isLoading: apptLoading } = useTodayAppointments()
  const { data: patients, isLoading: patientsLoading } = usePatients()
  const { data: invoices } = useInvoices({ status: 'paid', limit: 50 })

  const now = new Date()
  const totalPatients = patients?.items.length ?? 0
  const todayAll = todayAppts ?? []
  const todayScheduled = todayAll.filter((a) => a.status !== 'cancelled')
  const todayCompleted = todayAll.filter((a) => a.status === 'completed').length
  const todayTotal = todayScheduled.length

  // Next upcoming appointment
  const nextAppt = todayScheduled
    .filter((a) => a.status === 'scheduled' && new Date(a.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]

  const nextApptMins = nextAppt ? minutesUntil(nextAppt.startsAt) : null

  // Billing: sum paid invoices this month
  const thisMonthTotal = (invoices?.items ?? []).reduce((sum, inv) => {
    const d = new Date(inv.createdAt)
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      return sum + Number(inv.total ?? 0)
    }
    return sum
  }, 0)

  const billingFormatted =
    thisMonthTotal > 0
      ? `RD$ ${thisMonthTotal.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`
      : '—'

  // Doctor display name
  const fullName = user?.fullName ?? ''
  const lastName = fullName.split(' ').at(-1) ?? fullName
  const greeting = `Buenos días, Dr. ${lastName}.`

  // Subtitle
  let subtitle = 'Bienvenido a Rezeta.'
  if (!apptLoading) {
    if (todayTotal > 0) {
      subtitle = `Tienes ${todayTotal} consulta${todayTotal !== 1 ? 's' : ''} programada${todayTotal !== 1 ? 's' : ''} hoy.`
      if (nextApptMins !== null && nextApptMins >= 0 && nextApptMins <= 120) {
        subtitle += ` Tu próxima cita es en ${nextApptMins} minuto${nextApptMins !== 1 ? 's' : ''}.`
      }
    } else {
      subtitle = 'No tienes consultas programadas hoy.'
    }
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-n-400 mb-[6px]">
            {formatDateKicker(now)}
          </div>
          <h1 className="font-serif font-medium text-[30px] text-n-900 leading-[1.15] tracking-[-0.015em] m-0">
            {greeting}
          </h1>
          <p className="text-[13px] text-n-500 mt-1 mb-0">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void navigate('/agenda')}
            className="btn h-8 px-[14px] bg-n-0 text-n-800 border border-n-300 rounded-sm font-sans font-medium text-[13px] flex items-center gap-2 hover:bg-n-50 hover:border-n-400 transition-colors"
          >
            <i className="ph ph-calendar-blank text-[15px]" />
            Ver agenda
          </button>
          <button
            type="button"
            onClick={() => void navigate('/consultas/nueva')}
            className="h-8 px-[14px] bg-p-500 text-white border border-p-500 rounded-sm font-sans font-medium text-[13px] flex items-center gap-2 hover:bg-p-700 hover:border-p-700 transition-colors"
          >
            <i className="ph ph-plus text-[15px]" />
            Nueva consulta
          </button>
        </div>
      </div>

      {/* ── KPI grid ── */}
      <div className="grid grid-cols-4 gap-5 mb-5">
        <KpiCard
          label="Consultas hoy"
          value={apptLoading ? '—' : todayCompleted}
          unit={apptLoading ? undefined : `/ ${todayTotal}`}
          delta={
            apptLoading
              ? '…'
              : todayTotal > 0
                ? `${Math.round((todayCompleted / todayTotal) * 100)}% completadas`
                : 'Sin citas hoy'
          }
          deltaDir="flat"
          loading={apptLoading}
        />
        <KpiCard
          label="Pacientes activos"
          value={patientsLoading ? '—' : totalPatients.toLocaleString('es-DO')}
          delta="+32 este mes"
          deltaDir="up"
          loading={patientsLoading}
        />
        <KpiCard
          label={`Facturación · ${MONTHS_ES[now.getMonth()]}`}
          value={billingFormatted}
          delta="+12% vs mes anterior"
          deltaDir="up"
        />
        <KpiCard
          label="Prescripciones pendientes"
          value="3"
          delta="requieren firma"
          deltaDir="down"
        />
      </div>

      {/* ── Main 3-col grid ── */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Upcoming appointments — spans 2 cols */}
        <div className="col-span-2 bg-n-0 border border-n-200 rounded-md p-5">
          <div className="flex items-center justify-between mb-[14px]">
            <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
              Próximas citas
            </h3>
            <button
              type="button"
              onClick={() => void navigate('/agenda')}
              className="text-[12px] text-n-500 hover:text-n-800 transition-colors"
            >
              Ver agenda completa →
            </button>
          </div>

          {apptLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[52px] bg-n-50 rounded animate-pulse" />
              ))}
            </div>
          ) : todayScheduled.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <i className="ph ph-calendar-blank text-[28px] text-n-300 mb-2" />
              <p className="text-[13px] text-n-400 m-0">No hay citas programadas para hoy</p>
            </div>
          ) : (
            <div>
              {todayScheduled.slice(0, 5).map((appt, idx) => (
                <UpcomingRow key={appt.id} appt={appt} isFirst={idx === 0} />
              ))}
            </div>
          )}
        </div>

        {/* Pending prescriptions */}
        <div className="bg-n-0 border border-n-200 rounded-md p-5">
          <div className="mb-[14px]">
            <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
              Prescripciones pendientes
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[13px] font-semibold text-n-900">Loratadina 10 mg · 7 días</div>
              <div className="text-[11.5px] text-n-500 mt-1">Ana María Reyes · hace 5 min</div>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-n-900">
                Metformina 850 mg · continuo
              </div>
              <div className="text-[11.5px] text-n-500 mt-1">Juan Pablo Castillo · hace 1 h</div>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-n-900">
                Atorvastatina 20 mg · 30 días
              </div>
              <div className="text-[11.5px] text-n-500 mt-1">Miguel Ángel Santana · ayer</div>
            </div>
            <button
              type="button"
              className="self-start mt-1 h-7 px-[10px] bg-n-0 text-n-800 border border-n-300 rounded-sm font-sans font-medium text-[12.5px] flex items-center gap-2 hover:bg-n-50 hover:border-n-400 transition-colors"
            >
              Firmar todas
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom 2-col grid ── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Recent protocols */}
        <div className="bg-n-0 border border-n-200 rounded-md p-5">
          <div className="flex items-center justify-between mb-[14px]">
            <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
              Protocolos recientes
            </h3>
            <button
              type="button"
              onClick={() => void navigate('/protocolos')}
              className="text-[12px] text-n-500 hover:text-n-800 transition-colors"
            >
              Ver todos →
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-[10px] border-b border-n-100">
              <div>
                <div className="text-[13px] font-semibold text-n-900">
                  Manejo de anafilaxia en adultos
                </div>
                <div className="text-[11.5px] text-n-500 mt-1">v2.3 · actualizado hace 2 días</div>
              </div>
              <Badge variant="signed" showDot>
                Firmado
              </Badge>
            </div>
            <div className="flex items-center justify-between pb-[10px] border-b border-n-100">
              <div>
                <div className="text-[13px] font-semibold text-n-900">Dolor torácico agudo</div>
                <div className="text-[11.5px] text-n-500 mt-1">
                  v1.8 · actualizado hace 1 semana
                </div>
              </div>
              <Badge variant="review" showDot>
                En revisión
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-n-900">Cetoacidosis diabética</div>
                <div className="text-[11.5px] text-n-500 mt-1">v3.1 · actualizado hoy</div>
              </div>
              <Badge variant="signed" showDot>
                Firmado
              </Badge>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-n-0 border border-n-200 rounded-md p-5">
          <div className="mb-[14px]">
            <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
              Actividad
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            <ActivityItem
              initials="DR"
              html={`Firmaste la prescripción para <b>Carlos Méndez</b>`}
              time="hace 15 minutos"
            />
            <ActivityItem
              initials="AM"
              html={`<b>Ana Martínez</b> confirmó su cita del miércoles`}
              time="hace 1 hora"
            />
            <ActivityItem
              initials="SS"
              html={`Se publicó la v2.3 de <b>Manejo de anafilaxia</b>`}
              time="hace 2 días"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
