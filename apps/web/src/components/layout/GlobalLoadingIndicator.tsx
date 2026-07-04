import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui'
import { useGlobalLoading } from '@/hooks/use-global-loading'
import { globalLoadingStrings } from './strings'

const SHOW_DELAY_MS = 250

export function GlobalLoadingIndicator(): JSX.Element | null {
  const { isLoading } = useGlobalLoading()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setVisible(false)
      return
    }
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [isLoading])

  if (!visible) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 pointer-events-none flex items-center gap-2 bg-n-0 border border-n-200 rounded-md shadow-floating px-3 py-2"
    >
      <Spinner size="sm" className="text-p-500" />
      <span className="text-[11.5px] font-mono text-n-600">{globalLoadingStrings.loadingLabel}</span>
    </div>
  )
}
