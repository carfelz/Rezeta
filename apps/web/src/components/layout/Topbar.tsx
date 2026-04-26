import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '@/store/ui.store'
import { useAuth } from '@/hooks/use-auth'
import type { Location as ClinicLocation } from '@rezeta/shared'
import { useLocations } from '@/hooks/locations/use-locations'

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
  const setActiveLocation = useUiStore((s) => s.setActiveLocation)
  const { user } = useAuth()
  const { data: locations } = useLocations()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeLocation: ClinicLocation | null =
    locations?.find((l) => l.id === activeLocationId) ?? locations?.[0] ?? null

  // Auto-select first location when list loads and nothing is active
  useEffect(() => {
    if (!activeLocationId && locations && locations.length > 0) {
      setActiveLocation(locations[0].id)
    }
  }, [locations, activeLocationId, setActiveLocation])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="fixed top-0 left-sidebar right-0 h-topbar bg-n-0 border-b border-n-200 flex items-center px-5 gap-4 z-30">
      {/* Location switcher */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded-sm hover:bg-n-50 transition-colors duration-[100ms]"
          onClick={() => setDropdownOpen((o) => !o)}
        >
          <span className="w-1.5 h-1.5 bg-p-500 rounded-full shrink-0" />
          <span className="text-[13px] font-sans font-medium text-n-800">
            {activeLocation ? activeLocation.name : 'Seleccionar ubicación'}
          </span>
          {activeLocation?.city && (
            <span className="text-[12px] font-sans text-n-500">· {activeLocation.city}</span>
          )}
          <i className="ph ph-caret-down text-[12px] text-n-400 ml-1" />
        </button>

        {dropdownOpen && locations && locations.length > 0 && (
          <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-n-0 border border-n-200 rounded-md shadow-floating z-50 py-1">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-n-25 transition-colors duration-[100ms]"
                onClick={() => {
                  setActiveLocation(loc.id)
                  setDropdownOpen(false)
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background:
                      loc.id === activeLocationId ? 'var(--color-p-500)' : 'var(--color-n-300)',
                  }}
                />
                <div>
                  <div
                    className="text-[13px] font-sans text-n-800"
                    style={{ fontWeight: loc.id === activeLocationId ? 600 : 400 }}
                  >
                    {loc.name}
                  </div>
                  {loc.city && <div className="text-[11.5px] font-sans text-n-500">{loc.city}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex-1 max-w-[480px] relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400 flex items-center pointer-events-none">
          <i className="ph ph-magnifying-glass text-[16px]" />
        </span>
        <input
          type="search"
          placeholder="Buscar pacientes, citas..."
          className="w-full h-input-md pl-9 pr-14 text-[13px] font-sans bg-n-0 border border-n-300 rounded-sm outline-none focus:border-p-500 focus:shadow-focus placeholder:text-n-400 transition-colors duration-[100ms]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-n-500 border border-n-200 bg-n-25 rounded px-1 py-0.5 pointer-events-none">
          ⌘K
        </span>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notificaciones"
          className="flex items-center justify-center w-[34px] h-[34px] rounded-sm text-n-600 hover:bg-n-50 transition-colors duration-[100ms]"
        >
          <i className="ph ph-bell text-[16px]" />
        </button>

        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-n-200">
            <div className="w-9 h-9 rounded-full bg-p-50 text-p-700 flex items-center justify-center text-[13px] font-semibold shrink-0">
              {initials(user.fullName)}
            </div>
            <div>
              <div className="text-[13px] font-sans font-semibold text-n-800">{user.fullName}</div>
              <div className="text-[12px] font-sans text-n-500">{user.specialty ?? 'Médico'}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
