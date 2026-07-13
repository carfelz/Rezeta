import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { DOC_LABELS, formatAge } from '@/pages/Patients/helpers'
import { patientDetailStrings as s } from './strings'

export interface PageHeaderProps {
  patient: Patient
  onEdit: () => void
  onNewConsultation: () => void
}

export function PageHeader({ patient, onEdit, onNewConsultation }: PageHeaderProps): JSX.Element {
  const fullName = `${patient.firstName} ${patient.lastName}`.trim()
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()
  // Omit the type segment entirely when the document type is absent or unknown,
  // so the subtitle never interpolates a literal "null" ahead of the number.
  const docTypeLabel = patient.documentType ? DOC_LABELS[patient.documentType] : undefined
  const docLabel = patient.documentNumber
    ? [docTypeLabel, patient.documentNumber].filter(Boolean).join(' ')
    : s.noDocument

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-xs font-sans text-n-500">
          <Link to="/pacientes" className="hover:text-n-800 transition-colors">
            {s.breadcrumbPatients}
          </Link>
          <i className="ph ph-caret-right text-overline text-n-300" />
          <span className="text-n-800 font-medium">{fullName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <i className="ph ph-pencil-simple mr-2 text-base" />
            {s.editButton}
          </Button>
          <Button variant="primary" size="sm" onClick={onNewConsultation}>
            <i className="ph ph-plus mr-2 text-base" />
            {s.newConsultation}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-p-50 text-p-700 text-body-lg font-semibold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-h2 font-serif font-medium text-n-900">{fullName}</h1>
          <p className="text-xs font-sans text-n-500 mt-1">
            {patient.dateOfBirth ? `${formatAge(patient.dateOfBirth)} · ` : ''}
            {docLabel}
          </p>
        </div>
      </div>
    </>
  )
}
