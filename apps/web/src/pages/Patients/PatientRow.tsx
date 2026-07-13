import type { MouseEvent } from 'react'
import { Badge, IconButton, Row } from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { DOC_LABELS_UPPER, formatAge, resolveDocumentType } from './helpers'
import { patientRowStrings } from './strings'

export interface PatientRowProps {
  patient: Patient
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PatientRow({ patient, onView, onEdit, onDelete }: PatientRowProps): JSX.Element {
  const name = `${patient.firstName} ${patient.lastName}`
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()

  const handleRowClick = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('button')) return
    onView()
  }

  return (
    <tr
      className="hover:bg-n-25 cursor-pointer"
      onClick={handleRowClick}
      role="link"
      tabIndex={0}
      aria-label={patientRowStrings.openPatientLabel(name)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onView()
        }
      }}
    >
      <td className="text-sm px-4 py-3 border-b border-n-100">
        <div className="flex items-center gap-2">
          <div className="w-[30px] h-[30px] rounded-full bg-p-50 text-p-700 text-overline font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-semibold text-n-800">{name}</div>
            {patient.phone && <div className="text-xs text-n-500">{patient.phone}</div>}
          </div>
        </div>
      </td>
      <td className="text-sm px-4 py-3 border-b border-n-100">
        {patient.documentNumber ? (
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-xs text-n-600">{patient.documentNumber}</span>
            {(() => {
              const docType = resolveDocumentType(patient.documentType, patient.documentNumber)
              if (!docType) return null
              return (
                <span className="font-mono text-2xs uppercase tracking-[0.08em] text-n-400 mt-0.5">
                  {DOC_LABELS_UPPER[docType]}
                </span>
              )
            })()}
          </div>
        ) : (
          <span className="font-mono text-xs text-n-600">—</span>
        )}
      </td>
      <td className="text-sm px-4 py-3 border-b border-n-100 text-n-600">
        {formatAge(patient.dateOfBirth)}
      </td>
      <td className="text-sm px-4 py-3 border-b border-n-100">
        <Badge variant="active">{patientRowStrings.statusActive}</Badge>
      </td>
      <td className="text-sm px-4 py-3 border-b border-n-100">
        <Row gap={1} justify="end">
          <IconButton
            icon="ph ph-eye"
            aria-label={patientRowStrings.viewLabel}
            tone="neutral"
            size="md"
            onClick={onView}
          />
          <IconButton
            icon="ph ph-pencil-simple"
            aria-label={patientRowStrings.editLabel}
            tone="neutral"
            size="md"
            onClick={onEdit}
          />
          <IconButton
            icon="ph ph-trash"
            aria-label={patientRowStrings.deleteLabel}
            tone="danger"
            size="md"
            onClick={onDelete}
          />
        </Row>
      </td>
    </tr>
  )
}
