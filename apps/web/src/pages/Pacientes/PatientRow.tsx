import type { MouseEvent } from 'react'
import { Badge, IconButton, Row } from '@/components/ui'
import type { Patient } from '@rezeta/shared'
import { formatAge } from './helpers'

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
      aria-label={`Abrir paciente ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onView()
        }
      }}
    >
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <div className="flex items-center gap-2">
          <div className="w-[30px] h-[30px] rounded-full bg-p-50 text-p-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-semibold text-n-800">{name}</div>
            {patient.phone && <div className="text-[12px] text-n-500">{patient.phone}</div>}
          </div>
        </div>
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100 font-mono text-[12px] text-n-600">
        {patient.documentNumber ?? '—'}
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100 text-n-600">
        {formatAge(patient.dateOfBirth)}
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <Badge variant="active">Activo</Badge>
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <Row gap={1} justify="end">
          <IconButton
            icon="ph ph-eye"
            aria-label="Ver paciente"
            tone="neutral"
            size="md"
            onClick={onView}
          />
          <IconButton
            icon="ph ph-pencil-simple"
            aria-label="Editar paciente"
            tone="neutral"
            size="md"
            onClick={onEdit}
          />
          <IconButton
            icon="ph ph-trash"
            aria-label="Eliminar paciente"
            tone="danger"
            size="md"
            onClick={onDelete}
          />
        </Row>
      </td>
    </tr>
  )
}
