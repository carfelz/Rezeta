import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePatient } from '@/hooks/patients/use-patients'
import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { AppointmentsTab } from './AppointmentsTab'
import { DemographicsBlock } from './DemographicsBlock'
import { EditModal } from './EditModal'
import { HistoriaTab } from './HistoriaTab'
import { InvoicesTab } from './InvoicesTab'
import { MedicalInfoBlock } from './MedicalInfoBlock'
import { PageHeader } from './PageHeader'
import { PrescriptionsTab } from './PrescriptionsTab'
import { patientDetailStrings as s } from './strings'

export function PatientDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
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
        <Spinner size="lg" className="text-n-400" />
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

      <Tabs defaultValue="historia">
        <TabsList>
          <TabsTrigger value="historia">{s.tabHistory}</TabsTrigger>
          <TabsTrigger value="citas">{s.tabAppointments}</TabsTrigger>
          <TabsTrigger value="recetas">{s.tabPrescriptions}</TabsTrigger>
          <TabsTrigger value="facturas">{s.tabInvoices}</TabsTrigger>
        </TabsList>

        <div className="border border-n-200 rounded-md bg-n-0 p-5 mt-4">
          <TabsContent value="historia">
            <HistoriaTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="citas">
            <AppointmentsTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="recetas">
            <PrescriptionsTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="facturas">
            <InvoicesTab patientId={patient.id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
