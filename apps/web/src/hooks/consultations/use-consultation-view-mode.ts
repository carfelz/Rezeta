import { useEffect } from 'react'
import { useUiStore } from '@/store/ui.store'
import type { ConsultationViewMode } from '@/store/ui.store'

const STORAGE_KEY = 'rezeta:consultation-view-mode'

function readStoredMode(): ConsultationViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'canvas' || stored === 'soap') return stored
  } catch {
    // localStorage unavailable
  }
  return 'soap'
}

export function useConsultationViewMode(hasProtocol: boolean): {
  viewMode: ConsultationViewMode
  setViewMode: (mode: ConsultationViewMode) => void
} {
  const { viewMode, setViewMode: setStoreMode } = useUiStore()

  // Hydrate from localStorage on mount — intentionally only runs once
  useEffect(() => {
    const stored = readStoredMode()
    setStoreMode(stored)
  }, [setStoreMode])

  // Reset to soap when no protocol is attached
  useEffect(() => {
    if (!hasProtocol) {
      setStoreMode('soap')
    }
  }, [hasProtocol, setStoreMode])

  function setViewMode(mode: ConsultationViewMode): void {
    setStoreMode(mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // localStorage unavailable
    }
  }

  return { viewMode: hasProtocol ? viewMode : 'soap', setViewMode }
}
