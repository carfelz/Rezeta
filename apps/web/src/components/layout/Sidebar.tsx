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

const NAV_HOY: NavItem[] = [
  { to: '/dashboard', Icon: SquaresFour, label: 'Dashboard' },
  { to: '/agenda', Icon: CalendarBlank, label: 'Agenda' },
]

const NAV_CLINICO: NavItem[] = [
  { to: '/pacientes', Icon: User, label: 'Pacientes' },
  { to: '/protocolos', Icon: Stack, label: 'Protocolos' },
]

const NAV_ADMIN: NavItem[] = [
  { to: '/facturacion', Icon: Receipt, label: 'Facturación' },
  { to: '/ajustes', Icon: Gear, label: 'Ajustes' },
]

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function NavGroup({ items }: { items: NavItem[] }): JSX.Element {
  return (
    <>
      {items.map(({ to, Icon, label, count }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `sidebar__item${isActive ? ' sidebar__item--active' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={16}
                weight={isActive ? 'fill' : 'regular'}
                color={isActive ? 'var(--color-p-500)' : 'var(--color-n-500)'}
                style={{ flexShrink: 0 }}
              />
              {label}
              {count !== undefined && (
                <span className="sidebar__item__count">{count}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

export function Sidebar(): JSX.Element {
  const { user } = useAuth()

  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">R</div>
        <span className="sidebar__brand-name">Rezeta</span>
      </div>

      <span className="sidebar__section-label">Hoy</span>
      <NavGroup items={NAV_HOY} />

      <span className="sidebar__section-label">Trabajo Clínico</span>
      <NavGroup items={NAV_CLINICO} />

      <span className="sidebar__section-label">
        Administración
      </span>
      <NavGroup items={NAV_ADMIN} />

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
