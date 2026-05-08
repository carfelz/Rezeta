import { useEffect } from 'react'
import { useUiStore, type ConsultationViewMode } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'
import type { UserPreferences } from '@rezeta/shared'

const STORAGE_KEY = 'rezeta:consultation-view-mode'

function readStoredMode(): ConsultationViewMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'canvas' || stored === 'soap') return stored
  } catch {
    // localStorage unavailable
  }
  return null
}

function writeStoredMode(mode: ConsultationViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // localStorage unavailable
  }
}

/**
 * Persistent view-mode preference.
 *
 * Source-of-truth: server-side `User.preferences.consultationViewMode`.
 * localStorage is a write-through cache for snappy first-render before the
 * authenticated user has loaded. When the server preference changes, the
 * local cache is overwritten on next mutation; stale local values lose to
 * server values on the next read.
 */
export function useConsultationViewMode(hasProtocol: boolean): {
  viewMode: ConsultationViewMode
  setViewMode: (mode: ConsultationViewMode) => void
} {
  const { viewMode, setViewMode: setStoreMode } = useUiStore()
  const user = useAuthStore((s) => s.user)
  const setStorePreferences = useAuthStore((s) => s.setPreferences)
  const serverMode = user?.preferences?.consultationViewMode ?? null

  // On mount: hydrate from localStorage so the first paint is correct even
  // before the user object has loaded. The server-mode effect below overrides
  // this once the user resolves.
  useEffect(() => {
    const cached = readStoredMode()
    if (cached) setStoreMode(cached)
  }, [setStoreMode])

  // Reconcile with server preference whenever it changes. Server wins.
  useEffect(() => {
    if (serverMode) {
      setStoreMode(serverMode)
      writeStoredMode(serverMode)
    }
  }, [serverMode, setStoreMode])

  // Reset to soap when no protocol is attached.
  useEffect(() => {
    if (!hasProtocol) {
      setStoreMode('soap')
    }
  }, [hasProtocol, setStoreMode])

  function setViewMode(mode: ConsultationViewMode): void {
    setStoreMode(mode)
    writeStoredMode(mode)
    if (!user) return
    const next: UserPreferences = { ...user.preferences, consultationViewMode: mode }
    // Optimistic in-memory update; PATCH in background.
    setStorePreferences(next)
    void apiClient
      .patch<UserPreferences>('/v1/users/me/preferences', { consultationViewMode: mode })
      .catch(() => {
        // Network/API failure is non-fatal — local state and cache already
        // reflect the user's choice. Next successful read reconciles.
      })
  }

  return { viewMode: hasProtocol ? viewMode : 'soap', setViewMode }
}
