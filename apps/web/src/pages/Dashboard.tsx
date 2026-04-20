import { useAuthStore } from '@/store/auth.store'
import { strings } from '@/lib/strings'

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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

export function Dashboard(): JSX.Element {
  const user = useAuthStore((s) => s.user)

  const greeting = strings.DASHBOARD_GREETING(user?.fullName ?? null)

  return (
    <div>
      {/* Page header */}
      <p className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>
        {formatDateKicker(new Date())}
      </p>
      <h1 className="text-h1" style={{ marginBottom: 'var(--space-8)' }}>
        {greeting}
      </h1>

      {/* Dashboard content placeholder */}
      <div className="empty-state">
        <div className="empty-state__icon">
          <i className="ph ph-squares-four" />
        </div>
        <h3 className="empty-state__title">{strings.DASHBOARD_UNDER_CONSTRUCTION}</h3>
        <p className="empty-state__description">
          {strings.DASHBOARD_UNDER_CONSTRUCTION_DESCRIPTION}
        </p>
      </div>
    </div>
  )
}
