import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { hasCapability } from '@rezeta/shared'
import type { CapabilityMap, ModuleKey } from '@rezeta/shared'
import { Avatar, Caption, Overline } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/store/auth.store'
import { sidebarStrings } from './strings'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

interface NavItem {
  to: string
  icon: string
  label: string
  count?: number
  /** Extra path prefixes that should also mark this item active. */
  alsoActiveOn?: string[]
  /** Module this item maps to; when set, hidden unless the user can `view` it. */
  module?: ModuleKey
}

const NAV_HOY: NavItem[] = [
  { to: '/dashboard', icon: 'squares-four', label: sidebarStrings.navDashboard },
  { to: '/agenda', icon: 'calendar-blank', label: sidebarStrings.navAgenda, module: 'appointments' },
]

const NAV_CLINICO: NavItem[] = [
  {
    to: '/pacientes',
    icon: 'user',
    label: sidebarStrings.navPatients,
    alsoActiveOn: ['/consultas'],
    module: 'patients',
  },
  { to: '/protocolos', icon: 'stack', label: sidebarStrings.navProtocols, module: 'protocols' },
]

const NAV_ADMIN: NavItem[] = [
  { to: '/facturacion', icon: 'receipt', label: sidebarStrings.navBilling, module: 'billing' },
  // 'templates' represents the admin section: doctor/admin/super_admin have it,
  // assistant does not — matching the settings route guard in App.tsx.
  { to: '/ajustes', icon: 'gear-six', label: sidebarStrings.navSettings, module: 'templates' },
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

function canViewNav(caps: CapabilityMap | undefined, module?: ModuleKey): boolean {
  if (!module) return true
  if (!caps) return false
  return hasCapability(caps, module, 'view')
}

interface NavGroupProps {
  label: string
  items: NavItem[]
}

function NavGroup({ label, items }: NavGroupProps): JSX.Element | null {
  const { pathname } = useLocation()
  if (items.length === 0) return null
  return (
    <div className="mb-4">
      <Overline tone="neutral" size="sm" className="block px-5 mb-1">
        {label}
      </Overline>
      {items.map(({ to, icon, label: itemLabel, count, alsoActiveOn }) => {
        const matchesExtraRoute = (alsoActiveOn ?? []).some((prefix) => pathname.startsWith(prefix))
        return (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => {
              const active = isActive || matchesExtraRoute
              return cn(
                'relative flex items-center gap-3 px-5 py-1.75 text-sm font-sans transition-colors duration-fast',
                active
                  ? 'bg-n-0 text-n-900 font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-p-500 before:rounded-sm'
                  : 'text-n-600 hover:bg-n-50 hover:text-n-800',
              )
            }}
          >
            {({ isActive }): JSX.Element => {
              const active = isActive || matchesExtraRoute
              return (
                <>
                  <i
                    className={cn(
                      active ? 'ph-fill' : 'ph',
                      `ph-${icon}`,
                      'text-body-lg shrink-0',
                      active ? 'text-p-500' : 'text-n-500',
                    )}
                  />
                  <span className="flex-1">{itemLabel}</span>
                  {count !== undefined && (
                    <span className="text-overline font-mono text-n-400">{count}</span>
                  )}
                </>
              )
            }}
          </NavLink>
        )
      })}
    </div>
  )
}

export function Sidebar({ open, onClose }: SidebarProps): JSX.Element {
  const { user } = useAuth()
  const { signOut } = useAuthStore()
  const capabilities = useAuthStore((s) => s.user?.capabilities)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    onClose()
  }, [pathname])

  async function handleSignOut(): Promise<void> {
    await signOut()
    void navigate('/login', { replace: true })
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <nav
        className={cn(
          'fixed left-0 top-0 w-sidebar h-screen bg-n-25 border-r border-n-200 flex flex-col overflow-y-auto z-40 transition-transform duration-200',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-5 border-b border-n-100 shrink-0">
          <div className="w-btn-sm h-btn-sm bg-p-500 rounded-sm flex items-center justify-center text-n-0 font-serif font-medium text-body-lg shrink-0">
            R
          </div>
          <span className="text-h3 font-serif font-medium text-n-900 tracking-heading">
            Rezeta
          </span>
        </div>

        <div className="flex-1 pt-4">
          <NavGroup
            label={sidebarStrings.navTodayLabel}
            items={NAV_HOY.filter((item) => canViewNav(capabilities, item.module))}
          />
          <NavGroup
            label={sidebarStrings.navClinicalLabel}
            items={NAV_CLINICO.filter((item) => canViewNav(capabilities, item.module))}
          />
          <NavGroup
            label={sidebarStrings.navAdminLabel}
            items={NAV_ADMIN.filter((item) => canViewNav(capabilities, item.module))}
          />
        </div>

        {user && (
          <div className="shrink-0 border-t border-n-100 py-3">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-5 py-2 hover:bg-n-50 transition-colors duration-fast cursor-pointer"
                  aria-label={sidebarStrings.userMenuLabel}
                >
                  <Avatar initials={initials(user.fullName)} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-sans font-semibold text-n-800 truncate">
                      {user.fullName ?? sidebarStrings.defaultName}
                    </div>
                    <Caption tone="neutral" size="xs" as="div">
                      {user.specialty ?? sidebarStrings.defaultSpecialty}
                    </Caption>
                  </div>
                  <i className="ph ph-caret-up-down text-n-400 text-base shrink-0" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="start"
                  sideOffset={4}
                  className="z-50 min-w-200 bg-n-0 border border-n-200 rounded-md shadow-floating py-1 animate-in fade-in-0 zoom-in-95"
                >
                  <DropdownMenu.Item asChild>
                    <NavLink
                      to="/ajustes"
                      className="flex items-center gap-2 px-3 py-2 text-sm font-sans text-n-700 hover:bg-n-50 hover:text-n-900 cursor-pointer outline-none no-underline transition-colors duration-fast"
                    >
                      <i className="ph ph-gear-six text-base text-n-500" />
                      {sidebarStrings.userMenuSettings}
                    </NavLink>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="my-1 h-px bg-n-100" />

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm font-sans text-n-700 hover:bg-n-50 hover:text-n-900 cursor-pointer outline-none transition-colors duration-fast"
                    onSelect={() => {
                      void handleSignOut()
                    }}
                  >
                    <i className="ph ph-sign-out text-base text-n-500" />
                    {sidebarStrings.userMenuSignOut}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
      </nav>
    </>
  )
}
