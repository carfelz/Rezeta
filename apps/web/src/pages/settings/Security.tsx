import { useState } from 'react'
import type { LoginEventItemDto } from '@rezeta/shared'
import { useSecuritySummary, useSecurityLogins, downloadSecurityLoginsCsv } from '@/hooks/identity/use-security'
import { useCan } from '@/hooks/use-can'
import { triggerDownload } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { Badge, Button, Callout, EmptyState, NativeSelect } from '@/components/ui'
import { securityStrings as s } from './strings'

const METHOD_LABELS: Record<string, string> = {
  password: s.methodPassword,
  google: s.methodGoogle,
  sso: s.methodSso,
  unknown: s.methodUnknown,
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('es-DO', { month: 'short' })
  const year = d.getFullYear()
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${day} ${month} ${year}, ${h12}:${minutes} ${ampm}`
}

function OutcomeBadge({ outcome }: { outcome: LoginEventItemDto['outcome'] }): JSX.Element {
  return outcome === 'success' ? (
    <Badge variant="active">{s.outcomeSuccess}</Badge>
  ) : (
    <Badge variant="overdue">{s.outcomeBlocked}</Badge>
  )
}

function formatPct(value: number | null): string {
  return value === null ? '—' : `${value}%`
}

function StatTiles({
  days,
  logins,
  distinctUsers,
  dormantUsers30d,
  mfaAdoptionPct,
}: {
  days: number
  logins: number
  distinctUsers: number
  dormantUsers30d: number
  mfaAdoptionPct: number | null
}): JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">
          {s.statLogins(days)}
        </div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{logins}</div>
      </div>
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">
          {s.statDistinctUsers(days)}
        </div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{distinctUsers}</div>
      </div>
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">{s.statDormant}</div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{dormantUsers30d}</div>
      </div>
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">{s.statMfaAdoption}</div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{formatPct(mfaAdoptionPct)}</div>
      </div>
    </div>
  )
}

export function Security(): JSX.Element {
  const [days, setDays] = useState<7 | 30>(7)
  const canExport = useCan('users', 'manage')
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const summaryQuery = useSecuritySummary(days)
  const loginsQuery = useSecurityLogins({ days, limit: 50 })

  async function handleExport(): Promise<void> {
    setExportError(null)
    setExporting(true)
    try {
      const blob = await downloadSecurityLoginsCsv({ days })
      const ts = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `login-activity-${ts}.csv`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Security.exportCsv' })
      setExportError(s.exportError)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1 m-0">{s.pageTitle}</h1>
          <p className="text-sm text-n-500 mt-1">{s.pageSubtitle}</p>
        </div>
        {canExport && (
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => {
              void handleExport()
            }}
          >
            <i className="ph ph-download-simple mr-1.5" />
            {exporting ? s.exportingButton : s.exportButton}
          </Button>
        )}
      </div>

      {exportError && (
        <div className="mb-4">
          <Callout variant="danger" icon={<i className="ph ph-warning" />}>
            {exportError}
          </Callout>
        </div>
      )}

      <StatTiles
        days={days}
        logins={summaryQuery.data?.logins ?? 0}
        distinctUsers={summaryQuery.data?.distinctUsers ?? 0}
        dormantUsers30d={summaryQuery.data?.dormantUsers30d ?? 0}
        mfaAdoptionPct={summaryQuery.data?.mfaAdoptionPct ?? null}
      />

      <div className="flex items-center gap-2 mb-5">
        <label className="text-overline font-medium text-n-600 shrink-0">{s.rangeLabel}</label>
        <NativeSelect value={String(days)} onChange={(e) => setDays(Number(e.target.value) as 7 | 30)}>
          <option value="7">{s.range7}</option>
          <option value="30">{s.range30}</option>
        </NativeSelect>
      </div>

      {loginsQuery.isLoading && <p className="text-body text-n-500">{s.loading}</p>}

      {loginsQuery.isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" />}>
          {s.loadError}
        </Callout>
      )}

      {!loginsQuery.isLoading && !loginsQuery.isError && (loginsQuery.data?.length ?? 0) === 0 && (
        <EmptyState icon={<i className="ph ph-shield-check" />} title={s.emptyTitle} description={s.emptyDescription} />
      )}

      {!loginsQuery.isLoading && !loginsQuery.isError && (loginsQuery.data?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                {[s.tableDate, s.tableUser, s.tableMethod, s.tableIp, s.tableOutcome].map((col) => (
                  <th
                    key={col}
                    className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loginsQuery.data!.map((item) => (
                <tr key={item.id} className="border-t border-n-100">
                  <td className="px-4 py-3 font-mono text-xs text-n-600 whitespace-nowrap">
                    {formatTs(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-n-700">{item.userName ?? s.unknownUser}</td>
                  <td className="px-4 py-3 text-sm text-n-600">{METHOD_LABELS[item.method] ?? item.method}</td>
                  <td className="px-4 py-3 font-mono text-xs text-n-500">{item.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={item.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
