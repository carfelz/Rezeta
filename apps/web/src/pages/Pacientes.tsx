import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePatients } from '@/hooks/patients/use-patients'
import type { Patient } from '@rezeta/shared'
import {
  Button,
  Badge,
  EmptyState,
  Callout,
  Card,
  InputGroup,
  InputIcon,
  Input,
} from '@/components/ui'

function formatAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—'
  const years = Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  )
  return `${years} años`
}

function PatientRow({ patient }: { patient: Patient }) {
  const name = `${patient.firstName} ${patient.lastName}`
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()

  return (
    <tr className="hover:bg-n-25">
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
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        {formatAge(patient.dateOfBirth)}
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <Badge variant="active">Activo</Badge>
      </td>
      <td className="text-[13px] px-4 py-3 border-b border-n-100">
        <Link
          to={`/pacientes/${patient.id}`}
          className="inline-flex items-center justify-center h-btn-sm px-3 rounded-sm text-[12.5px] font-medium text-n-700 hover:bg-n-100 transition-colors duration-[100ms]"
        >
          Ver
        </Link>
      </td>
    </tr>
  )
}

export function Pacientes(): JSX.Element {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const timerRef = useRef<number | undefined>(undefined)

  const { data, isLoading, isError } = usePatients(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  )

  function handleSearch(value: string) {
    setSearch(value)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setDebouncedSearch(value), 300)
  }

  return (
    <div>
      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">Pacientes</h1>
        <Button variant="primary">
          <i className="ph ph-plus mr-1.5" />
          Registrar paciente
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
              placeholder="Buscar por nombre, cédula, teléfono..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </InputGroup>
        </div>

        {isLoading && <div className="p-8 text-center text-n-400">Cargando pacientes...</div>}

        {isError && (
          <div className="m-4">
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              No se pudo cargar la lista de pacientes.
            </Callout>
          </div>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={<i className="ph ph-user" />}
            title="Aún no hay pacientes registrados"
            description="Registra a tu primer paciente para empezar a gestionar citas, consultas y prescripciones desde un solo lugar."
            action={<Button variant="primary">Registrar paciente</Button>}
            className="rounded-none border-0"
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Paciente
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Cédula / Documento
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Edad
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((patient) => (
                <PatientRow key={patient.id} patient={patient} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
