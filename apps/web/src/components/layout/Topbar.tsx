import { Bell, CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { useUiStore } from '@/store/ui.store'
import { useAuth } from '@/hooks/use-auth'

function initials(name: string): string {
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
      <button className="topbar__location-switcher" type="button">
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--color-p-500)',
            display: 'inline-block',
            marginRight: 8,
          }}
        />
        <div>
          <div className="topbar__location-name">
            {activeLocationId ? 'Consultorio' : 'Seleccionar ubicación'}
          </div>
          <div className="topbar__location-sub">Centro Médico</div>
        </div>
        <CaretDown size={16} style={{ marginLeft: 6, color: 'var(--color-n-400)' }} />
      </button>

      <div className="topbar__search">
        <span className="input-icon input-icon--leading">
          <MagnifyingGlass size={16} />
        </span>
        <input
          className="input"
          type="search"
          placeholder="Buscar pacientes, citas..."
          style={{ border: 'none', background: 'transparent', flex: 1 }}
        />
        <span className="topbar__search-kbd">⌘K</span>
      </div>

      <div className="row gap-1" style={{ marginLeft: 'auto' }}>
        <button className="topbar__icon-btn" type="button" aria-label="Notificaciones">
          <Bell size={16} />
        </button>

        {user && (
          <div className="topbar__doctor">
            <div className="avatar">{initials(user.fullName)}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-n-800)' }}>
                {user.fullName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-n-500)' }}>
                {user.specialty ?? 'Médico'}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
