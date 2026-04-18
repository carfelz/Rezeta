import { NavLink } from 'react-router-dom'
import {
  SquaresFour,
  CalendarBlank,
  User,
  Stack,
  Receipt,
  Gear,
} from '@phosphor-icons/react'
import { useAuth } from '@/hooks/use-auth'

interface NavItem {
  to: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>
  label: string
  count?: number
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', Icon: SquaresFour, label: 'Dashboard' },
  { to: '/agenda',    Icon: CalendarBlank, label: 'Agenda' },
  { to: '/pacientes', Icon: User,          label: 'Pacientes' },
  { to: '/protocolos',Icon: Stack,         label: 'Protocolos' },
  { to: '/facturacion',Icon: Receipt,      label: 'Facturación' },
]

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Sidebar(): JSX.Element {
  const { user } = useAuth()

  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">R</div>
        <span className="sidebar__brand-name">Rezeta</span>
      </div>

      <span className="sidebar__section-label">Clínico</span>

      {NAV_ITEMS.map(({ to, Icon, label, count }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `sidebar__item${isActive ? ' sidebar__item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
              {label}
              {count !== undefined && (
                <span className="sidebar__item__count">{count}</span>
              )}
            </>
          )}
        </NavLink>
      ))}

      <span className="sidebar__section-label" style={{ marginTop: 'auto' }}>
        Configuración
      </span>
      <NavLink
        to="/ajustes"
        className={({ isActive }) =>
          `sidebar__item${isActive ? ' sidebar__item--active' : ''}`
        }
      >
        {({ isActive }) => (
          <>
            <Gear size={16} weight={isActive ? 'fill' : 'regular'} />
            Ajustes
          </>
        )}
      </NavLink>

      {user && (
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="avatar avatar--sm">{initials(user.fullName)}</div>
            <div className="sidebar__user-info">
              <div className="sidebar__user-name">{user.fullName}</div>
              <div className="sidebar__user-role">
                {user.specialty ?? 'Médico'}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
