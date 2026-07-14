import type { ConsultationAmendment } from '@rezeta/shared'
import { formatDate } from './helpers'

export interface AmendmentsBannerProps {
  amendments: ConsultationAmendment[]
}

export function AmendmentsBanner({ amendments }: AmendmentsBannerProps): JSX.Element | null {
  if (amendments.length === 0) return null
  return (
    <div className="bg-warning-bg border border-warning-border rounded-md px-4 py-3 mb-5">
      <div className="text-overline font-mono uppercase tracking-label text-warning-text mb-2">
        {amendments.length} enmienda
        {amendments.length !== 1 ? 's' : ''}
      </div>
      {amendments.map((a) => (
        <div key={a.id} className="text-xs text-warning-text">
          <span className="font-semibold">#{a.amendmentNumber}</span> — {a.reason}
          <span className="ml-2 text-overline opacity-60">{formatDate(a.amendedAt)}</span>
        </div>
      ))}
    </div>
  )
}
