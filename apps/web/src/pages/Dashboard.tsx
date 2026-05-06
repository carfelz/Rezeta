import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useTodayAppointments } from '@/hooks/appointments/use-appointments'
import { usePatients } from '@/hooks/patients/use-patients'
import { useInvoices } from '@/hooks/invoices/use-invoices'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { useAuditLogs } from '@/hooks/audit-logs/use-audit-logs'
import { Badge, Button, Caption, Row, TextLink } from '@/components/ui'
import type {
  AppointmentWithDetails,
  AppointmentStatus,
  AuditLogItem,
  ProtocolListItem,
} from '@rezeta/shared'
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
        <div className="h-10 w-[96px] bg-n-100 rounded animate-pulse" />
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

// ─── Audit-feed helpers ──────────────────────────────────────────────────────

function initialsForActor(fullName: string | null): string {
  if (!fullName) return '?'
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
}

function describeAuditEntry(entry: AuditLogItem): string {
  const actor = entry.actor?.fullName ?? 'Sistema'
  const entityType = entry.entityType ?? 'registro'
  const action = entry.action.toLowerCase()
  // Friendly Spanish phrasing for the most common actions
  if (action.includes('create')) return `<b>${actor}</b> creó ${friendlyEntity(entityType)}`
  if (action.includes('update')) return `<b>${actor}</b> actualizó ${friendlyEntity(entityType)}`
  if (action.includes('delete')) return `<b>${actor}</b> eliminó ${friendlyEntity(entityType)}`
  if (action.includes('sign')) return `<b>${actor}</b> firmó ${friendlyEntity(entityType)}`
  if (action.includes('login') || action.includes('signin')) return `<b>${actor}</b> inició sesión`
  return `<b>${actor}</b> ${entry.action} (${entityType})`
}

function friendlyEntity(t: string): string {
  const map: Record<string, string> = {
    Consultation: 'una consulta',
    Patient: 'un paciente',
    Protocol: 'un protocolo',
    ProtocolVersion: 'una versión de protocolo',
    Prescription: 'una prescripción',
    Appointment: 'una cita',
    Invoice: 'una factura',
    Location: 'una ubicación',
    ProtocolType: 'un tipo de protocolo',
    ProtocolTemplate: 'una plantilla',
  }
  return map[t] ?? `un registro (${t})`
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} minuto${mins !== 1 ? 's' : ''}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} hora${hrs !== 1 ? 's' : ''}`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `hace ${days} día${days !== 1 ? 's' : ''}`
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
}

function statusToBadgeVariant(status: string): BadgeProps['variant'] {
  if (status === 'active') return 'active'
  if (status === 'archived') return 'archived'
  if (status === 'review') return 'review'
  return 'draft'
}

function labelForProtocolStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Activo',
    draft: 'Borrador',
    archived: 'Archivado',
    review: 'En revisión',
  }
  return map[status] ?? status
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: todayAppts, isLoading: apptLoading } = useTodayAppointments()
  const { data: patients, isLoading: patientsLoading } = usePatients()
  const { data: invoices } = useInvoices({ status: 'paid', limit: 50 })
  const { data: invoicesPrevMonth } = useInvoices({ status: 'paid', limit: 50 })
  const { useGetProtocols } = useProtocols()
  const { data: recentProtocols } = useGetProtocols({
    status: 'active',
    sort: 'updatedAt_desc',
  })
  const { data: auditFeed } = useAuditLogs({ limit: 5 })

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

  // Compare against last month
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthTotal = (invoicesPrevMonth?.items ?? []).reduce((sum, inv) => {
    const d = new Date(inv.createdAt)
    if (
      d.getMonth() === lastMonthDate.getMonth() &&
      d.getFullYear() === lastMonthDate.getFullYear()
    ) {
      return sum + Number(inv.total ?? 0)
    }
    return sum
  }, 0)
  const billingDelta =
    lastMonthTotal > 0
      ? `${Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)}% vs mes anterior`
      : 'Sin datos del mes anterior'
  const billingDeltaDir: 'up' | 'down' | 'flat' =
    lastMonthTotal === 0 || thisMonthTotal === lastMonthTotal
      ? 'flat'
      : thisMonthTotal > lastMonthTotal
        ? 'up'
        : 'down'

  // Patients added this month — count from list
  const patientsAddedThisMonth = (patients?.items ?? []).filter((p) => {
    const d = new Date(p.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

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
        <Row gap={2} className="shrink-0">
          <Button variant="secondary" size="md" onClick={() => void navigate('/agenda')}>
            <i className="ph ph-calendar-blank text-[15px]" />
            Ver agenda
          </Button>
          <Button variant="primary" size="md" onClick={() => void navigate('/consultas/nueva')}>
            <i className="ph ph-plus text-[15px]" />
            Nueva consulta
          </Button>
        </Row>
      </div>

      {/* ── KPI grid ── */}
      <div className="grid grid-cols-4 gap-5 mb-5">
        <KpiCard
          label="Consultas hoy"
          value={apptLoading ? '—' : todayCompleted}
          {...(!apptLoading && { unit: `/ ${todayTotal}` })}
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
          delta={
            patientsLoading
              ? '…'
              : patientsAddedThisMonth > 0
                ? `+${patientsAddedThisMonth} este mes`
                : 'Sin nuevos este mes'
          }
          deltaDir={patientsAddedThisMonth > 0 ? 'up' : 'flat'}
          loading={patientsLoading}
        />
        <KpiCard
          label={`Facturación · ${MONTHS_ES[now.getMonth()]}`}
          value={billingFormatted}
          delta={billingDelta}
          deltaDir={billingDeltaDir}
        />
        <KpiCard
          label="Protocolos activos"
          value={(recentProtocols?.length ?? 0).toString()}
          delta={recentProtocols && recentProtocols.length > 0 ? 'en uso' : 'aún no hay protocolos'}
          deltaDir="flat"
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
            <TextLink tone="neutral" size="md" onClick={() => void navigate('/agenda')}>
              Ver agenda completa →
            </TextLink>
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

        {/* Pacientes recientes */}
        <div className="bg-n-0 border border-n-200 rounded-md p-5">
          <div className="flex items-center justify-between mb-[14px]">
            <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
              Pacientes recientes
            </h3>
            <TextLink tone="neutral" size="md" onClick={() => void navigate('/pacientes')}>
              Ver todos →
            </TextLink>
          </div>
          {patientsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[40px] bg-n-50 rounded animate-pulse" />
              ))}
            </div>
          ) : (patients?.items ?? []).length === 0 ? (
            <Caption tone="muted" size="lg" as="p" className="py-2 block">
              Aún no tienes pacientes registrados.
            </Caption>
          ) : (
            <div className="flex flex-col gap-3">
              {(patients?.items ?? [])
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 4)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void navigate(`/pacientes/${p.id}`)}
                    className="flex items-center gap-3 text-left hover:bg-n-25 -mx-1 px-1 py-1 rounded transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-n-900 truncate">
                        {p.firstName} {p.lastName}
                      </div>
                      <Caption tone="neutral" size="sm" as="div" className="mt-1">
                        {p.documentNumber ?? 'Sin documento'} ·{' '}
                        {new Date(p.createdAt).toLocaleDateString('es-DO', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Caption>
                    </div>
                    <i className="ph ph-caret-right text-[12px] text-n-300" />
                  </button>
                ))}
            </div>
          )}
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
            <TextLink tone="neutral" size="md" onClick={() => void navigate('/protocolos')}>
              Ver todos →
            </TextLink>
          </div>
          {(recentProtocols?.length ?? 0) === 0 ? (
            <Caption tone="muted" size="lg" as="p" className="py-2 block">
              Aún no tienes protocolos. Crea uno desde la sección Protocolos.
            </Caption>
          ) : (
            <div className="flex flex-col gap-3">
              {(recentProtocols ?? []).slice(0, 3).map((proto: ProtocolListItem, idx: number) => (
                <button
                  key={proto.id}
                  type="button"
                  onClick={() => void navigate(`/protocolos/${proto.id}`)}
                  className={`flex items-center justify-between text-left hover:bg-n-25 -mx-1 px-1 py-1 rounded transition-colors ${
                    idx < (recentProtocols ?? []).slice(0, 3).length - 1
                      ? 'pb-[10px] border-b border-n-100'
                      : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-n-900 truncate">
                      {proto.title}
                    </div>
                    <Caption tone="neutral" size="sm" as="div" className="mt-1">
                      {proto.currentVersionNumber !== null
                        ? `v${proto.currentVersionNumber} · `
                        : ''}
                      actualizado{' '}
                      {new Date(proto.updatedAt).toLocaleDateString('es-DO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Caption>
                  </div>
                  <Badge variant={statusToBadgeVariant(proto.status)} showDot>
                    {labelForProtocolStatus(proto.status)}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-n-0 border border-n-200 rounded-md p-5">
          <div className="mb-[14px]">
            <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
              Actividad reciente
            </h3>
          </div>
          {(auditFeed?.data ?? []).length === 0 ? (
            <Caption tone="muted" size="lg" as="p" className="py-2 block">
              Sin actividad reciente.
            </Caption>
          ) : (
            <div className="flex flex-col gap-3">
              {(auditFeed?.data ?? []).slice(0, 5).map((entry: AuditLogItem) => (
                <ActivityItem
                  key={entry.id}
                  initials={initialsForActor(entry.actor?.fullName ?? null)}
                  html={describeAuditEntry(entry)}
                  time={timeAgo(entry.createdAt)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
