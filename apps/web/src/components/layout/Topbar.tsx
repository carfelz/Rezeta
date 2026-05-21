import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '@/store/ui.store'
import { useAuth } from '@/hooks/use-auth'
import type { Location as ClinicLocation } from '@rezeta/shared'
import { useLocations } from '@/hooks/locations/use-locations'
import { Avatar, Button, Caption, IconButton, Input } from '@/components/ui'
import { topbarStrings } from './strings'

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps): JSX.Element {
  const activeLocationId = useUiStore((s) => s.activeLocationId)
  const setActiveLocation = useUiStore((s) => s.setActiveLocation)
  const { user } = useAuth()
  const { data: locations } = useLocations()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeLocation: ClinicLocation | null =
    locations?.find((l) => l.id === activeLocationId) ?? locations?.[0] ?? null

  useEffect(() => {
    if (!activeLocationId && locations && locations.length > 0) {
      const first = locations[0]
      if (first) setActiveLocation(first.id)
    }
  }, [locations, activeLocationId, setActiveLocation])

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="fixed top-0 left-0 lg:left-sidebar right-0 h-topbar bg-n-0 border-b border-n-200 flex items-center px-4 lg:px-5 gap-3 z-30">
      <button
        type="button"
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-n-600 hover:bg-n-50 transition-colors duration-[100ms] shrink-0"
        onClick={onMenuClick}
        aria-label={topbarStrings.openMenuLabel}
      >
        <i className="ph ph-list text-[20px]" />
      </button>
      <div className="relative shrink-0" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 px-3 py-2"
          onClick={() => setDropdownOpen((o) => !o)}
        >
          <span className="w-2 h-2 bg-p-500 rounded-full shrink-0" />
          <span className="text-[13px] font-medium text-n-800">
            {activeLocation ? activeLocation.name : topbarStrings.selectLocation}
          </span>
          {activeLocation?.city && (
            <Caption tone="neutral" size="md">
              · {activeLocation.city}
            </Caption>
          )}
          <i className="ph ph-caret-down text-[12px] text-n-400 ml-1" />
        </Button>

        {dropdownOpen && locations && locations.length > 0 && (
          <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-n-0 border border-n-200 rounded-md shadow-floating z-50 py-1">
            {locations.map((loc) => (
              <Button
                key={loc.id}
                variant="item"
                size="sm"
                className="w-full flex items-center gap-2 px-4 py-3 text-left"
                onClick={() => {
                  setActiveLocation(loc.id)
                  setDropdownOpen(false)
                }}
              >
                <span
                  className={
                    loc.id === activeLocationId
                      ? 'w-2 h-2 bg-p-500 rounded-full shrink-0'
                      : 'w-2 h-2 bg-n-300 rounded-full shrink-0'
                  }
                />
                <div>
                  <div
                    className={
                      loc.id === activeLocationId
                        ? 'text-[13px] font-semibold text-n-800'
                        : 'text-[13px] font-regular text-n-800'
                    }
                  >
                    {loc.name}
                  </div>
                  {loc.city && (
                    <Caption tone="neutral" size="sm" as="div">
                      {loc.city}
                    </Caption>
                  )}
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 max-w-[480px] relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-n-400 flex items-center pointer-events-none">
          <i className="ph ph-magnifying-glass text-[16px]" />
        </span>
        <Input type="search" placeholder={topbarStrings.searchPlaceholder} className="pl-8 pr-12" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-n-500 border border-n-200 bg-n-25 rounded px-1 py-1 pointer-events-none">
          ⌘K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <IconButton
          icon="ph ph-bell"
          aria-label={topbarStrings.notificationsLabel}
          tone="neutral"
          size="md"
        />

        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-n-200">
            <Avatar initials={initials(user.fullName)} size="default" />
            <div>
              <div className="text-[13px] font-semibold text-n-800">{user.fullName}</div>
              <Caption tone="neutral" size="md" as="div">
                {user.specialty ?? topbarStrings.defaultSpecialty}
              </Caption>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
