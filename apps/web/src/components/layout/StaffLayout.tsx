import { Outlet } from 'react-router-dom'
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
      <main className="mx-auto max-w-560 px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
