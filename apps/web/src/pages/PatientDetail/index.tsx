import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePatient } from '@/hooks/patients/use-patients'
import { Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { NewConsultationDialog } from '@/components/consultations/NewConsultationDialog'
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
  const [showNewConsultation, setShowNewConsultation] = useState(false)

  const { data: patient, isLoading, isError } = usePatient(id ?? '')

  if (!id) {
    void navigate('/pacientes', { replace: true })
    return <></>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-256">
        <Spinner size="lg" className="text-n-400" />
      </div>
    )
  }

  if (isError || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-256 gap-4">
        <p className="text-base font-sans text-n-600">Paciente no encontrado.</p>
        <Link to="/pacientes" className="text-sm font-sans text-p-500 hover:text-p-700">
          ← Volver a pacientes
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-800 m-auto">
      {showEdit && <EditModal patient={patient} onClose={() => setShowEdit(false)} />}

      {showNewConsultation && (
        <NewConsultationDialog
          open={showNewConsultation}
          onClose={() => setShowNewConsultation(false)}
          initialPatient={{
            id: patient.id,
            fullName: `${patient.firstName} ${patient.lastName}`.trim(),
          }}
        />
      )}

      <PageHeader
        patient={patient}
        onEdit={() => setShowEdit(true)}
        onNewConsultation={() => setShowNewConsultation(true)}
      />
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
