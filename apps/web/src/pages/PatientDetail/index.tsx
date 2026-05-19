import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePatient } from '@/hooks/patients/use-patients'
import { useUiStore } from '@/store/ui.store'
import { ClinicalHistory } from '@/pages/Patients/ClinicalHistory'
import { DemographicsBlock } from './DemographicsBlock'
import { EditModal } from './EditModal'
import { MedicalInfoBlock } from './MedicalInfoBlock'
import { PageHeader } from './PageHeader'

export function PatientDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const activeLocationId = useUiStore((s) => s.activeLocationId)
  const navigate = useNavigate()
  const [showEdit, setShowEdit] = useState(false)

  const { data: patient, isLoading, isError } = usePatient(id ?? '')

  if (!id) {
    void navigate('/pacientes', { replace: true })
    return <></>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[256px]">
        <i className="ph ph-spinner animate-spin text-[32px] text-n-400" />
      </div>
    )
  }

  if (isError || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-[256px] gap-4">
        <p className="text-[14px] font-sans text-n-600">Paciente no encontrado.</p>
        <Link to="/pacientes" className="text-[13px] font-sans text-p-500 hover:text-p-700">
          ← Volver a pacientes
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[800px] m-auto">
      {showEdit && <EditModal patient={patient} onClose={() => setShowEdit(false)} />}

      <PageHeader patient={patient} onEdit={() => setShowEdit(true)} />
      <DemographicsBlock patient={patient} />
      <MedicalInfoBlock patient={patient} />

      <div className="border border-n-200 rounded-md bg-n-0 p-5">
        <ClinicalHistory
          patientId={patient.id}
          {...(activeLocationId ? { locationId: activeLocationId } : {})}
        />
      </div>
    </div>
  )
}
