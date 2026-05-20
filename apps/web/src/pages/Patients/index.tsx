import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Callout, Card, EmptyState, Input, InputGroup, InputIcon } from '@/components/ui'
import { usePatients, useDeletePatient } from '@/hooks/patients/use-patients'
import type { Patient } from '@rezeta/shared'
import { PatientModal, type PatientModalMode } from './PatientModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { PatientRow } from './PatientRow'
import { patientsPageStrings } from './strings'

export function Patients(): JSX.Element {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modalMode, setModalMode] = useState<PatientModalMode | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  const { data, isLoading, isError } = usePatients(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  )
  const deleteMutation = useDeletePatient()

  function handleSearch(value: string): void {
    setSearch(value)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setDebouncedSearch(value), 300)
  }

  function openCreate(): void {
    setSelectedPatient(null)
    setModalMode('create')
  }

  function openView(patient: Patient): void {
    void navigate(`/pacientes/${patient.id}`)
  }

  function openEdit(patient: Patient): void {
    setSelectedPatient(patient)
    setModalMode('edit')
  }

  function openDelete(patient: Patient): void {
    setDeleteError(null)
    setDeletingPatient(patient)
  }

  function closeModal(): void {
    setModalMode(null)
    setSelectedPatient(null)
  }

  async function handleDelete(): Promise<void> {
    if (!deletingPatient) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync(deletingPatient.id)
      setDeletingPatient(null)
    } catch {
      setDeleteError(patientsPageStrings.deleteError)
    }
  }

  return (
    <div>
      {modalMode && selectedPatient && (
        <PatientModal mode={modalMode} patient={selectedPatient} onClose={closeModal} />
      )}

      {deletingPatient && (
        <DeleteConfirmModal
          patient={deletingPatient}
          onConfirm={() => {
            void handleDelete()
          }}
          onClose={() => {
            setDeletingPatient(null)
            setDeleteError(null)
          }}
          isDeleting={deleteMutation.isPending}
          error={deleteError}
        />
      )}

      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">{patientsPageStrings.pageTitle}</h1>
        <Button variant="primary" onClick={openCreate}>
          <i className="ph ph-plus mr-2" />
          {patientsPageStrings.registerButton}
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center p-4 border-b border-n-100">
          <InputGroup className="max-w-[320px]">
            <InputIcon side="left">
              <i className="ph ph-magnifying-glass text-[16px]" />
            </InputIcon>
            <Input
              type="search"
              placeholder={patientsPageStrings.searchPlaceholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </InputGroup>
        </div>

        {isLoading && (
          <div className="p-8 text-center text-n-400">{patientsPageStrings.loading}</div>
        )}

        {isError && (
          <div className="m-4">
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              {patientsPageStrings.loadError}
            </Callout>
          </div>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={<i className="ph ph-user" />}
            title={patientsPageStrings.emptyTitle}
            description={patientsPageStrings.emptyDescription}
            action={
              <Button variant="primary" onClick={openCreate}>
                {patientsPageStrings.registerButton}
              </Button>
            }
            className="rounded-none border-0"
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {patientsPageStrings.tableHeaderPatient}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {patientsPageStrings.tableHeaderDocument}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {patientsPageStrings.tableHeaderAge}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {patientsPageStrings.tableHeaderStatus}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  onView={() => openView(patient)}
                  onEdit={() => openEdit(patient)}
                  onDelete={() => openDelete(patient)}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
