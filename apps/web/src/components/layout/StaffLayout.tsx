import { NavLink, Outlet } from 'react-router-dom'
import { staffStrings } from '@/pages/staff/strings'

/**
 * Minimal shell for the staff console — deliberately separate from AppLayout /
 * Sidebar (the institution app shell). Staff-facing copy is English.
 */
export function StaffLayout(): JSX.Element {
  return (
    <div className="min-h-screen bg-n-25">
      <header className="flex items-center gap-3 border-b border-n-200 bg-n-0 px-6 py-4">
        <div className="flex h-btn-sm w-btn-sm items-center justify-center rounded-sm bg-p-500 font-serif text-body-lg font-medium text-n-0">
          R
        </div>
        <span className="text-h3 font-serif font-medium tracking-heading text-n-900">
          {staffStrings.consoleTitle}
        </span>
      </header>
      <nav className="flex gap-1 border-b border-n-200 bg-n-0 px-6">
        <StaffNavLink to="/staff/institutions/new" label={staffStrings.navInstitutions} />
        <StaffNavLink to="/staff/platform-users" label={staffStrings.navPlatformUsers} />
      </nav>
      <main className="mx-auto max-w-560 px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function StaffNavLink({ to, label }: { to: string; label: string }): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'border-b-2 border-p-500 px-3 py-2 text-sm font-medium text-p-700'
          : 'border-b-2 border-transparent px-3 py-2 text-sm text-n-500'
      }
    >
      {label}
    </NavLink>
  )
}
