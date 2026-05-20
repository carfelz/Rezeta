import { useNavigate } from 'react-router-dom'
import { Caption, TextLink } from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { dashboardStrings } from './strings'

export interface RecentPatientsProps {
  patients: Patient[]
  isLoading: boolean
}

export function RecentPatients({ patients, isLoading }: RecentPatientsProps): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-5">
      <div className="flex items-center justify-between mb-[14px]">
        <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
          {dashboardStrings.recentPatientsTitle}
        </h3>
        <TextLink tone="neutral" size="md" onClick={() => void navigate('/pacientes')}>
          {dashboardStrings.recentPatientsViewAll}
        </TextLink>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[40px] bg-n-50 rounded animate-pulse" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <Caption tone="muted" size="lg" as="p" className="py-2 block">
          {dashboardStrings.recentPatientsEmpty}
        </Caption>
      ) : (
        <div className="flex flex-col gap-3">
          {patients
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 4)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void navigate(`/pacientes/${p.id}`)}
                className="flex items-center gap-3 text-left hover:bg-n-25 -mx-1 px-1 py-1 rounded transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-n-900 truncate">
                    {p.firstName} {p.lastName}
                  </div>
                  <Caption tone="neutral" size="sm" as="div" className="mt-1">
                    {p.documentNumber ?? dashboardStrings.recentPatientsNoDocument} ·{' '}
                    {new Date(p.createdAt).toLocaleDateString('es-DO', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Caption>
                </div>
                <i className="ph ph-caret-right text-[12px] text-n-300" />
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
