import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { DOC_LABELS, formatAge } from '@/pages/Patients/helpers'

export interface PageHeaderProps {
  patient: Patient
  onEdit: () => void
}

export function PageHeader({ patient, onEdit }: PageHeaderProps): JSX.Element {
  const fullName = `${patient.firstName} ${patient.lastName}`.trim()
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()
  const docLabel = patient.documentNumber
    ? `${DOC_LABELS[patient.documentType ?? ''] ?? patient.documentType} ${patient.documentNumber}`
    : 'Sin documento'

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-[12.5px] font-sans text-n-500">
          <Link to="/pacientes" className="hover:text-n-800 transition-colors">
            Pacientes
          </Link>
          <i className="ph ph-caret-right text-[11px] text-n-300" />
          <span className="text-n-800 font-medium">{fullName}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <i className="ph ph-pencil-simple mr-2 text-[14px]" />
          Editar
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-p-50 text-p-700 text-[16px] font-semibold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-h2 font-serif font-medium text-n-900">{fullName}</h1>
          <p className="text-[12.5px] font-sans text-n-500 mt-1">
            {patient.dateOfBirth ? `${formatAge(patient.dateOfBirth)} · ` : ''}
            {docLabel}
          </p>
        </div>
      </div>
    </>
  )
}
