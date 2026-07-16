import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AppointmentWithDetails, InvoiceWithDetails, Patient, Prescription } from '@rezeta/shared'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

const mocks = vi.hoisted(() => ({
  usePatient: vi.fn(),
  useAppointments: vi.fn(),
  usePatientPrescriptions: vi.fn(),
  useCreateConsultation: vi.fn(),
  useInvoices: vi.fn(),
  useStartConsultation: vi.fn(),
  useUiStore: vi.fn(),
  useLocations: vi.fn(),
}))

vi.mock('@/hooks/patients/use-patients', () => ({
  usePatient: mocks.usePatient,
  // PatientCombobox (rendered inside NewConsultationDialog) consumes usePatients
  // for its search dropdown.
  usePatients: () => ({ data: { items: [] } }),
}))
vi.mock('@/hooks/appointments/use-appointments', () => ({
  useAppointments: mocks.useAppointments,
}))
vi.mock('@/hooks/consultations/use-consultations', () => ({
  usePatientPrescriptions: mocks.usePatientPrescriptions,
  useCreateConsultation: mocks.useCreateConsultation,
}))
vi.mock('@/hooks/invoices/use-invoices', () => ({ useInvoices: mocks.useInvoices }))
vi.mock('@/hooks/consultations/use-start-consultation', () => ({
  useStartConsultation: mocks.useStartConsultation,
}))
vi.mock('@/hooks/locations/use-locations', () => ({ useLocations: mocks.useLocations }))
vi.mock('@/store/ui.store', () => ({ useUiStore: mocks.useUiStore }))
vi.mock('../HistoriaTab', () => ({
  HistoriaTab: () => <div data-testid="historia-tab">Historia</div>,
}))

import { PatientDetail } from '../index'

const patient: Patient = {
  id: 'p1',
  tenantId: 't1',
  ownerUserId: 'u1',
  firstName: 'Ana',
  lastName: 'Reyes',
  sex: 'female',
  dateOfBirth: '1990-01-01',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: null,
  email: null,
  allergies: [],
  chronicConditions: [],
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
} as unknown as Patient

const appt: AppointmentWithDetails = {
  id: 'a1',
  tenantId: 't1',
  patientId: 'p1',
  doctorUserId: 'u1',
  locationId: 'l1',
  status: 'scheduled',
  startsAt: '2026-07-02T14:00:00.000Z',
  endsAt: '2026-07-02T14:30:00.000Z',
  reason: null,
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: null,
  patientName: 'Ana Reyes',
  patientDocumentNumber: '001',
  locationName: 'Clínica Central',
  consultationId: null,
  consultationStatus: null,
}

const prescription: Prescription = {
  id: 'rx1',
  tenantId: 't1',
  patientId: 'p1',
  doctorUserId: 'u1',
  consultationId: 'c1',
  groupTitle: 'Antibióticos',
  groupOrder: 1,
  status: 'signed',
  prescriptionItems: [],
  pdfUrl: null,
  signedAt: '2026-07-01T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: null,
}

const invoice: InvoiceWithDetails = {
  id: 'inv1',
  tenantId: 't1',
  patientId: 'p1',
  doctorUserId: 'u1',
  locationId: 'l1',
  consultationId: 'c1',
  invoiceNumber: 'F-0001',
  status: 'issued',
  currency: 'DOP',
  subtotal: 1500,
  tax: 0,
  commissionAmount: 0,
  commissionPercent: 0,
  netToDoctor: 1500,
  total: 1500,
  paymentMethod: null,
  issuedAt: '2026-07-01T00:00:00.000Z',
  paidAt: null,
  dueDate: null,
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: null,
  items: [],
  patientName: 'Ana Reyes',
  locationName: 'Clínica Central',
}

function setup(): void {
  mocks.usePatient.mockReturnValue({ data: patient, isLoading: false, isError: false })
  mocks.useAppointments.mockReturnValue({ data: [appt], isLoading: false, isError: false })
  mocks.usePatientPrescriptions.mockReturnValue({
    data: [prescription],
    isLoading: false,
    isError: false,
  })
  mocks.useInvoices.mockReturnValue({
    data: { items: [invoice], hasMore: false },
    isLoading: false,
    isError: false,
  })
  mocks.useStartConsultation.mockReturnValue({ start: vi.fn(), isStarting: false })
  mocks.useUiStore.mockReturnValue(null)
  mocks.useCreateConsultation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mocks.useLocations.mockReturnValue({
    data: [{ id: 'loc1', name: 'Consultorio', city: 'Santo Domingo' }],
  })
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/pacientes/p1']}>
      <Routes>
        <Route path="/pacientes/:id" element={<PatientDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PatientDetail read-only gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  afterEach(() => {
    seedAuthUser(null)
  })

  it('hides "Editar" and "Nueva consulta" controls for a view-only assistant', () => {
    seedAuthUser(makeAuthUser('assistant')) // patients = view, consultations = view
    renderPage()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva consulta/ })).not.toBeInTheDocument()
  })

  it('shows "Editar" and "Nueva consulta" controls for a doctor', () => {
    seedAuthUser(makeAuthUser('doctor')) // patients = manage, consultations = manage
    renderPage()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nueva consulta/ })).toBeInTheDocument()
  })
})
