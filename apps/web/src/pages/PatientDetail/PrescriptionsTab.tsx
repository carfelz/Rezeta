import { Link } from 'react-router-dom'
import type { Prescription } from '@rezeta/shared'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { usePatientPrescriptions } from '@/hooks/consultations/use-consultations'
import { patientDetailStrings as s } from './strings'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface PrescriptionsTabProps {
  patientId: string
}

export function PrescriptionsTab({ patientId }: PrescriptionsTabProps): JSX.Element {
  const { data: prescriptions = [], isLoading, isError } = usePatientPrescriptions(patientId)

  if (isLoading) {
    return <TabSpinner />
  }

  if (isError) {
    return <p className="text-[13px] font-sans text-danger-text">{s.loadError}</p>
  }

  if (prescriptions.length === 0) {
    return <EmptyState icon={<i className="ph ph-pill" />} title={s.prescriptionsEmpty} />
  }

  return (
    <ul className="flex flex-col divide-y divide-n-100">
      {prescriptions.map((rx) => (
        <PrescriptionRow key={rx.id} prescription={rx} />
      ))}
    </ul>
  )
}

function PrescriptionRow({ prescription }: { prescription: Prescription }): JSX.Element {
  const first = prescription.prescriptionItems[0]
  const label =
    prescription.status === 'signed' ? s.prescriptionStatusSigned : s.prescriptionStatusDraft

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[13px] font-sans text-n-800 whitespace-nowrap">
          {formatDate(prescription.createdAt)}
        </span>
        <span className="text-[12px] font-sans text-n-600 truncate">
          {first ? first.drug : (prescription.groupTitle ?? '—')}
        </span>
        <span className="text-[12px] font-sans text-n-400 whitespace-nowrap">
          {s.prescriptionItemsCount(prescription.prescriptionItems.length)}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={prescription.status === 'signed' ? 'signed' : 'draft'}>{label}</Badge>
        {prescription.consultationId !== null && (
          <Link
            to={`/consultas/${prescription.consultationId}`}
            className="inline-flex items-center gap-1 text-[12px] font-sans text-p-500 hover:text-p-700 hover:underline underline-offset-2"
          >
            <i className="ph ph-file-text text-[14px]" />
            {s.viewConsultation}
          </Link>
        )}
      </div>
    </li>
  )
}

function TabSpinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner size="md" className="text-n-400" />
    </div>
  )
}
