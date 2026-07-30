import type { StaffSecurityInstitutionDto } from '@rezeta/shared'
import { Badge, Callout, EmptyState, Spinner } from '@/components/ui'
import { useStaffSecurityOverview } from '@/hooks/staff/use-staff-security'
import { staffSecurityStrings as s } from './strings'

function StatTile({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="border border-n-200 rounded-md bg-n-0 p-4">
      <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">{label}</div>
      <div className="text-h3 font-serif font-medium text-n-900 mt-1">{value}</div>
    </div>
  )
}

function formatPct(value: number | null): string {
  return value === null ? '—' : `${value}%`
}

function Sparkline({ values }: { values: number[] }): JSX.Element {
  const max = Math.max(...values, 0)
  return (
    <div className="flex items-end gap-0.5 h-8 w-180">
      {values.map((value, index) => {
        const height = max > 0 ? Math.max(4, (value / max) * 100) : 4
        const isLast = index === values.length - 1
        return (
          <div
            key={index}
            data-testid="sparkline-bar"
            className={isLast ? 'flex-1 rounded-sm bg-p-500' : 'flex-1 rounded-sm bg-p-100'}
            style={{ height: `${height}%` }}
          />
        )
      })}
    </div>
  )
}

function SignalsChips({ institution }: { institution: StaffSecurityInstitutionDto }): JSX.Element {
  if (institution.dormant30d === 0 && institution.pendingInvites === 0) {
    return <span className="text-xs text-n-400">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {institution.dormant30d > 0 && (
        <Badge variant="review">{s.signalDormant(institution.dormant30d)}</Badge>
      )}
      {institution.pendingInvites > 0 && (
        <Badge variant="review">{s.signalPending(institution.pendingInvites)}</Badge>
      )}
    </div>
  )
}

function InstitutionRow({ institution }: { institution: StaffSecurityInstitutionDto }): JSX.Element {
  return (
    <tr className="border-t border-n-100">
      <td className="px-4 py-3">
        <span className="font-medium text-n-800">{institution.name ?? s.unnamed}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs uppercase text-n-500">{institution.plan}</span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-n-600">{institution.mau30d}</td>
      <td className="px-4 py-3">
        <Sparkline values={institution.logins14d} />
      </td>
      <td className="px-4 py-3">
        <SignalsChips institution={institution} />
      </td>
    </tr>
  )
}

export function Security(): JSX.Element {
  const { data, isLoading, isError } = useStaffSecurityOverview()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 font-serif font-medium text-n-900">{s.pageTitle}</h1>
        <p className="text-sm text-n-500">{s.pageSubtitle}</p>
      </div>

      {isLoading && <Spinner />}
      {isError && <Callout variant="danger">{s.loadError}</Callout>}

      {data && (
        <>
          <div className="grid grid-cols-5 gap-3">
            <StatTile label={s.tileActiveInstitutions} value={data.tiles.activeInstitutions} />
            <StatTile label={s.tileActiveUsers} value={data.tiles.activeUsers30d} />
            <StatTile label={s.tileLogins7d} value={data.tiles.logins7d} />
            <StatTile label={s.tileDormant} value={data.tiles.dormantAccounts60d} />
            <StatTile label={s.tileMfaAdoption} value={formatPct(data.tiles.mfaAdoptionPct)} />
          </div>

          {data.tiles.dormantAccounts60d > 0 && (
            <Callout variant="warning" icon={<i className="ph ph-warning" />}>
              {s.dormantCallout(data.tiles.dormantAccounts60d)}
            </Callout>
          )}

          {data.institutions.length === 0 && (
            <EmptyState
              icon={<i className="ph ph-shield-check" />}
              title={s.emptyTitle}
              description={s.emptyBody}
            />
          )}

          {data.institutions.length > 0 && (
            <div className="border border-n-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse bg-n-0">
                <thead>
                  <tr>
                    {[s.tableInstitution, s.tablePlan, s.tableMau, s.tableLogins, s.tableSignals].map((col) => (
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
                  {data.institutions.map((institution) => (
                    <InstitutionRow key={institution.tenantId} institution={institution} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
