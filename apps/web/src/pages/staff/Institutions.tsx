import { Link } from 'react-router-dom'
import type { StaffInstitutionDto } from '@rezeta/shared'
import { Button, Callout, EmptyState, Spinner } from '@/components/ui'
import { useStaffInstitutions } from '@/hooks/staff/use-institutions'
import { institutionsStrings as s } from './strings'

function InstitutionRow({ institution }: { institution: StaffInstitutionDto }): JSX.Element {
  return (
    <tr className="border-t border-n-100">
      <td className="px-4 py-3">
        <span className="font-medium text-n-800">{institution.name ?? s.unnamed}</span>
        <span className="block font-mono text-xs text-n-500">{institution.type}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs uppercase text-n-500">{institution.plan}</span>
      </td>
      <td className="px-4 py-3 text-sm text-n-600">
        {s.usersCell(institution.activeUserCount, institution.userCount)}
      </td>
      <td className="px-4 py-3 text-sm text-n-600">
        {new Date(institution.createdAt).toLocaleDateString()}
      </td>
    </tr>
  )
}

export function Institutions(): JSX.Element {
  const { data: institutions, isLoading, isError } = useStaffInstitutions()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-serif font-medium text-n-900">{s.pageTitle}</h1>
          <p className="text-sm text-n-500">{s.pageSubtitle}</p>
        </div>
        <Button asChild variant="primary">
          <Link to="/staff/institutions/new">{s.newButton}</Link>
        </Button>
      </div>

      {isLoading && <Spinner />}
      {isError && <Callout variant="danger">{s.loadError}</Callout>}

      {institutions && institutions.length === 0 && (
        <EmptyState icon={<i className="ph ph-buildings" />} title={s.emptyTitle} description={s.emptyBody} />
      )}

      {institutions && institutions.length > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableInstitution}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tablePlan}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableUsers}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableCreated}
                </th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((institution) => (
                <InstitutionRow key={institution.id} institution={institution} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
