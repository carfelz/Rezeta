import { Link, useNavigate } from 'react-router-dom'
import { TextLink } from '@/components/ui'
import { formatDate } from './helpers'

export interface BreadcrumbProps {
  patientName: string
  consultedAt: string
}

export function Breadcrumb({ patientName, consultedAt }: BreadcrumbProps): JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-2 text-[12.5px] font-sans text-n-500 mb-5">
      <Link to="/pacientes" className="hover:text-n-800 transition-colors">
        Pacientes
      </Link>
      <i className="ph ph-caret-right text-[11px] text-n-300" />
      <TextLink tone="neutral" size="lg" onClick={() => void navigate(-1)}>
        {patientName}
      </TextLink>
      <i className="ph ph-caret-right text-[11px] text-n-300" />
      <span className="text-n-800 font-medium">Consulta · {formatDate(consultedAt)}</span>
    </div>
  )
}
