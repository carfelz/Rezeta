import { useAuthStore } from '@/store/auth.store'
import { useTodayAppointments } from '@/hooks/appointments/use-appointments'
import { usePatients } from '@/hooks/patients/use-patients'
import { useInvoices } from '@/hooks/invoices/use-invoices'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { useAuditLogs } from '@/hooks/audit-logs/use-audit-logs'
import { ActivityFeed } from './ActivityFeed'
import { KpiCard } from './KpiCard'
import { PageHeader } from './PageHeader'
import { RecentPatients } from './RecentPatients'
import { RecentProtocols } from './RecentProtocols'
import { UpcomingAppointments } from './UpcomingAppointments'
import { dashboardStrings } from './strings'
import { MONTHS_ES, minutesUntil } from './helpers'

export function Dashboard(): JSX.Element {
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

  const nextAppt = todayScheduled
    .filter((a) => a.status === 'scheduled' && new Date(a.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
  const nextApptMins = nextAppt ? minutesUntil(nextAppt.startsAt) : null

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
      ? dashboardStrings.kpiBillingDelta(
          Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100),
        )
      : dashboardStrings.kpiBillingNoPrev
  const billingDeltaDir: 'up' | 'down' | 'flat' =
    lastMonthTotal === 0 || thisMonthTotal === lastMonthTotal
      ? 'flat'
      : thisMonthTotal > lastMonthTotal
        ? 'up'
        : 'down'

  const patientsAddedThisMonth = (patients?.items ?? []).filter((p) => {
    const d = new Date(p.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const greeting = dashboardStrings.greeting(user?.fullName ?? null)

  let subtitle: string = dashboardStrings.subtitleWelcome
  if (!apptLoading) {
    if (todayTotal > 0) {
      subtitle = dashboardStrings.subtitleConsultations(todayTotal)
      if (nextApptMins !== null && nextApptMins >= 0 && nextApptMins <= 120) {
        subtitle += dashboardStrings.subtitleNextAppt(nextApptMins)
      }
    } else {
      subtitle = dashboardStrings.subtitleNoConsultations
    }
  }

  return (
    <div>
      <PageHeader now={now} greeting={greeting} subtitle={subtitle} />

      <div className="grid grid-cols-4 gap-5 mb-5">
        <KpiCard
          label={dashboardStrings.kpiConsultationsLabel}
          value={apptLoading ? '—' : todayCompleted}
          {...(!apptLoading && { unit: `/ ${todayTotal}` })}
          delta={
            apptLoading
              ? dashboardStrings.kpiConsultationsLoading
              : todayTotal > 0
                ? dashboardStrings.kpiConsultationsCompleted(
                    Math.round((todayCompleted / todayTotal) * 100),
                  )
                : dashboardStrings.kpiConsultationsNone
          }
          deltaDir="flat"
          loading={apptLoading}
        />
        <KpiCard
          label={dashboardStrings.kpiPatientsLabel}
          value={patientsLoading ? '—' : totalPatients.toLocaleString('es-DO')}
          delta={
            patientsLoading
              ? dashboardStrings.kpiConsultationsLoading
              : patientsAddedThisMonth > 0
                ? dashboardStrings.kpiPatientsAdded(patientsAddedThisMonth)
                : dashboardStrings.kpiPatientsNone
          }
          deltaDir={patientsAddedThisMonth > 0 ? 'up' : 'flat'}
          loading={patientsLoading}
        />
        <KpiCard
          label={dashboardStrings.kpiBillingLabel(MONTHS_ES[now.getMonth()] ?? '')}
          value={billingFormatted}
          delta={billingDelta}
          deltaDir={billingDeltaDir}
        />
        <KpiCard
          label={dashboardStrings.kpiProtocolsLabel}
          value={(recentProtocols?.length ?? 0).toString()}
          delta={
            recentProtocols && recentProtocols.length > 0
              ? dashboardStrings.kpiProtocolsActive
              : dashboardStrings.kpiProtocolsNone
          }
          deltaDir="flat"
        />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        <UpcomingAppointments appointments={todayScheduled} isLoading={apptLoading} />
        <RecentPatients patients={patients?.items ?? []} isLoading={patientsLoading} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <RecentProtocols protocols={recentProtocols ?? []} />
        <ActivityFeed entries={auditFeed?.data ?? []} />
      </div>
    </div>
  )
}
