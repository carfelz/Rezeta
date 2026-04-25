import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

interface NavItem {
  to: string
  icon: string
  label: string
  count?: number
}

const NAV_HOY: NavItem[] = [
  { to: '/dashboard', icon: 'squares-four', label: 'Dashboard' },
  { to: '/agenda', icon: 'calendar-blank', label: 'Agenda' },
]

const NAV_CLINICO: NavItem[] = [
  { to: '/pacientes', icon: 'user', label: 'Pacientes' },
  { to: '/protocolos', icon: 'stack', label: 'Protocolos' },
]

const NAV_ADMIN: NavItem[] = [
  { to: '/facturacion', icon: 'receipt', label: 'Facturación' },
  { to: '/ajustes', icon: 'gear-six', label: 'Ajustes' },
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

interface NavGroupProps {
  label: string
  items: NavItem[]
}

function NavGroup({ label, items }: NavGroupProps): JSX.Element {
  return (
    <div className="mb-4">
      <span className="block px-5 mb-1 text-[10px] font-mono uppercase tracking-[0.12em] text-n-400">
        {label}
      </span>
      {items.map(({ to, icon, label: itemLabel, count }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 px-5 py-[7px] text-[13px] font-sans transition-colors duration-[100ms]',
              isActive
                ? 'bg-n-0 text-n-900 font-medium before:absolute before:left-0 before:top-[6px] before:bottom-[6px] before:w-0.5 before:bg-p-500 before:rounded-sm'
                : 'text-n-600 hover:bg-n-50 hover:text-n-800',
            )
          }
        >
          {({ isActive }) => (
            <>
              <i
                className={cn(
                  isActive ? 'ph-fill' : 'ph',
                  `ph-${icon}`,
                  'text-[16px] shrink-0',
                  isActive ? 'text-p-500' : 'text-n-500',
                )}
              />
              <span className="flex-1">{itemLabel}</span>
              {count !== undefined && (
                <span className="text-[11px] font-mono text-n-400">{count}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}

export function Sidebar(): JSX.Element {
  const { user } = useAuth()

  return (
    <nav className="fixed left-0 top-0 w-sidebar h-screen bg-n-25 border-r border-n-200 flex flex-col overflow-y-auto z-40">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-5 border-b border-n-100 shrink-0">
        <div className="w-7 h-7 bg-p-500 rounded-sm flex items-center justify-center text-n-0 font-serif font-medium text-base shrink-0">
          R
        </div>
        <span className="text-[18px] font-serif font-medium text-n-900 tracking-[-0.01em]">
          Rezeta
        </span>
      </div>

      {/* Nav groups */}
      <div className="flex-1 pt-4">
        <NavGroup label="Hoy" items={NAV_HOY} />
        <NavGroup label="Trabajo Clínico" items={NAV_CLINICO} />
        <NavGroup label="Administración" items={NAV_ADMIN} />
      </div>

      {/* Footer */}
      {user && (
        <div className="shrink-0 border-t border-n-100 py-3">
          <div className="flex items-center gap-3 px-5 py-2 hover:bg-n-50 transition-colors duration-[100ms] cursor-pointer">
            <div className="w-[30px] h-[30px] rounded-full bg-p-50 text-p-700 flex items-center justify-center text-[11px] font-semibold shrink-0">
              {initials(user.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-sans font-semibold text-n-800 truncate">
                {user.fullName}
              </div>
              <div className="text-[11px] font-sans text-n-500">{user.specialty ?? 'Médico'}</div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
