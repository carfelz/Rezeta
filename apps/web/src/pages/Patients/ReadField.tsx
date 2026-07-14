import type { ReactNode } from 'react'

export function ReadField({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400 mb-1">
        {label}
      </div>
      <div className="text-sm font-sans text-n-700">
        {value || <span className="text-n-300">—</span>}
      </div>
    </div>
  )
}
