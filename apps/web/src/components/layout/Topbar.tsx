import { Bell, CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { useUiStore } from '@/store/ui.store'
import { useAuth } from '@/hooks/use-auth'

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Topbar(): JSX.Element {
  const activeLocationId = useUiStore((s) => s.activeLocationId)
  const { user } = useAuth()

  return (
    <header className="topbar">
      {/* Location switcher */}
      <button className="topbar__location-switcher" type="button">
        <span className="topbar__location-dot" />
        <span className="topbar__location-name">
          {activeLocationId ? 'Consultorio' : 'Seleccionar ubicación'}
        </span>
        <span className="topbar__location-sub">· Centro Médico</span>
        <CaretDown size={12} style={{ marginLeft: 4, color: 'var(--color-n-400)' }} />
      </button>

      {/* Search */}
      <div className="topbar__search">
        <span
          className="topbar__search-icon"
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <MagnifyingGlass size={16} />
        </span>
        <input
          className="input"
          type="search"
          placeholder="Buscar pacientes, citas..."
        />
        <span className="topbar__search-kbd">⌘K</span>
      </div>

      {/* Right side */}
      <div className="topbar__right">
        <button className="topbar__icon-btn" type="button" aria-label="Notificaciones">
          <Bell size={16} />
        </button>

        {user && (
          <div className="topbar__doctor">
            <div className="avatar">{initials(user.fullName)}</div>
            <div>
              <div className="topbar__doctor-name">{user.fullName}</div>
              <div className="topbar__doctor-role">{user.specialty ?? 'Médico'}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
