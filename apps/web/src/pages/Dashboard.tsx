import { useAuthStore } from '@/store/auth.store'
import { strings } from '@/lib/strings'
import { EmptyState } from '@/components/ui'

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

export function Dashboard(): JSX.Element {
  const user = useAuthStore((s) => s.user)

  const greeting = strings.DASHBOARD_GREETING(user?.fullName ?? null)

  return (
    <div>
      <p className="text-overline font-mono font-medium text-n-500 uppercase mb-2">
        {formatDateKicker(new Date())}
      </p>
      <h1 className="text-h1 font-serif font-medium text-n-900 mb-8">{greeting}</h1>

      <EmptyState
        icon={<i className="ph ph-squares-four" />}
        title={strings.DASHBOARD_UNDER_CONSTRUCTION}
        description={strings.DASHBOARD_UNDER_CONSTRUCTION_DESCRIPTION}
      />
    </div>
  )
}
