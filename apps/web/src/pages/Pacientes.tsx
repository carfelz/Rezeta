import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePatients } from '@/hooks/patients/use-patients'
import type { Patient } from '@rezeta/shared'

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
    <tr>
      <td>
        <div className="row gap-2">
          <div className="avatar avatar--sm">{initials}</div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-n-800)' }}>{name}</div>
            {patient.phone && (
              <div style={{ fontSize: 12, color: 'var(--color-n-500)' }}>{patient.phone}</div>
            )}
          </div>
        </div>
      </td>
      <td className="table td--mono">
        {patient.documentNumber ?? '—'}
      </td>
      <td>{formatAge(patient.dateOfBirth)}</td>
      <td>
        <span className="badge badge--active">
          <span className="badge__dot" />
          Activo
        </span>
      </td>
      <td>
        <Link
          to={`/pacientes/${patient.id}`}
          className="btn btn--ghost btn--sm"
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
      <div className="row" style={{ marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <h1 className="text-h1" style={{ flex: 1 }}>Pacientes</h1>
        <button className="btn btn--primary">
          <i className="ph ph-plus" />
          Registrar paciente
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="row"
          style={{ padding: 'var(--space-4)', borderBottom: 'var(--border-soft)' }}
        >
          <div className="input-group" style={{ maxWidth: 320 }}>
            <span className="input-icon input-icon--leading">
              <i className="ph ph-magnifying-glass" />
            </span>
            <input
              className="input"
              type="search"
              placeholder="Buscar por nombre, cédula, teléfono..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading && (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-n-400)' }}>
            Cargando pacientes...
          </div>
        )}

        {isError && (
          <div className="callout callout--danger" style={{ margin: 'var(--space-4)' }}>
            <i className="ph ph-warning-circle" />
            <div className="callout__body">No se pudo cargar la lista de pacientes.</div>
          </div>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <div className="empty-state" style={{ borderRadius: 0, border: 'none' }}>
            <div className="empty-state__icon">
              <i className="ph ph-user" />
            </div>
            <h3 className="empty-state__title">Aún no hay pacientes registrados</h3>
            <p className="empty-state__description">
              Registra a tu primer paciente para empezar a gestionar citas, consultas y
              prescripciones desde un solo lugar.
            </p>
            <button className="btn btn--primary">Registrar paciente</button>
          </div>
        )}

        {!isLoading && data && data.items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Cédula / Documento</th>
                <th>Edad</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((patient) => (
                <PatientRow key={patient.id} patient={patient} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

