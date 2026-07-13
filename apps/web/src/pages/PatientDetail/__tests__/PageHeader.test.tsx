import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PageHeader } from '../PageHeader'
import type { Patient } from '@rezeta/shared'

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'patient-1',
    tenantId: 'tenant-1',
    ownerUserId: 'doctor-1',
    firstName: 'Ana',
    lastName: 'Reyes',
    dateOfBirth: '1980-01-01',
    sex: 'female',
    documentType: 'cedula',
    documentNumber: '001-9999999-9',
    phone: null,
    email: null,
    address: null,
    bloodType: null,
    allergies: [],
    chronicConditions: [],
    notes: null,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function renderHeader(patient: Patient): void {
  render(
    <MemoryRouter>
      <PageHeader patient={patient} onEdit={vi.fn()} onNewConsultation={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('PatientDetail PageHeader — document subtitle', () => {
  it('shows the Spanish document-type label before the number when the type is present', () => {
    renderHeader(makePatient({ documentType: 'cedula', documentNumber: '001-9999999-9' }))

    expect(screen.getByText(/Cédula 001-9999999-9/)).toBeInTheDocument()
  })

  it('omits the document-type segment (no literal "null") when the type is absent', () => {
    renderHeader(makePatient({ documentType: null, documentNumber: '001-9999999-9' }))

    const subtitle = screen.getByText(/001-9999999-9/)
    expect(subtitle.textContent).not.toContain('null')
    expect(subtitle.textContent).toContain('001-9999999-9')
    expect(subtitle.textContent).not.toMatch(/Cédula|Pasaporte|RNC/)
  })

  it('falls back to the "no document" string when there is no number', () => {
    renderHeader(makePatient({ documentType: null, documentNumber: null }))

    expect(screen.getByText(/Sin documento/)).toBeInTheDocument()
  })

  it('prefixes the age when a date of birth is present and omits it otherwise', () => {
    renderHeader(makePatient({ dateOfBirth: null, documentNumber: '001-9999999-9' }))

    const subtitle = screen.getByText(/001-9999999-9/)
    expect(subtitle.textContent).not.toContain('años')
  })
})
