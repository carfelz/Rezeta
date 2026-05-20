import { useEffect } from 'react'

/**
 * Registers a `beforeunload` handler when `active` is true, prompting the
 * user before closing/reloading the tab. Cleans up when `active` is false.
 */
export function useBeforeUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])
}
