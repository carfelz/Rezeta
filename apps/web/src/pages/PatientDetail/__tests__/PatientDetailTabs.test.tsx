import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  AppointmentWithDetails,
  InvoiceWithDetails,
  Patient,
  Prescription,
} from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  usePatient: vi.fn(),
  useAppointments: vi.fn(),
  usePatientPrescriptions: vi.fn(),
  useInvoices: vi.fn(),
  useStartConsultation: vi.fn(),
  useUiStore: vi.fn(),
}))

vi.mock('@/hooks/patients/use-patients', () => ({ usePatient: mocks.usePatient }))
vi.mock('@/hooks/appointments/use-appointments', () => ({
  useAppointments: mocks.useAppointments,
}))
vi.mock('@/hooks/consultations/use-consultations', () => ({
  usePatientPrescriptions: mocks.usePatientPrescriptions,
}))
vi.mock('@/hooks/invoices/use-invoices', () => ({ useInvoices: mocks.useInvoices }))
vi.mock('@/hooks/consultations/use-start-consultation', () => ({
  useStartConsultation: mocks.useStartConsultation,
}))
vi.mock('@/store/ui.store', () => ({ useUiStore: mocks.useUiStore }))
vi.mock('@/pages/Patients/ClinicalHistory', () => ({
  ClinicalHistory: () => <div data-testid="clinical-history">Historia</div>,
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

const inProgressAppt: AppointmentWithDetails = {
  id: 'a1',
  tenantId: 't1',
  patientId: 'p1',
  doctorUserId: 'u1',
  locationId: 'l1',
  status: 'in_progress',
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
  consultationId: 'c1',
  consultationStatus: 'open',
}

const scheduledAppt: AppointmentWithDetails = {
  ...inProgressAppt,
  id: 'a2',
  status: 'scheduled',
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
  prescriptionItems: [
    {
      id: 'i1',
      prescriptionId: 'rx1',
      drug: 'Amoxicilina',
      dose: '500mg',
      route: 'oral',
      frequency: 'c/8h',
      duration: '7 días',
      notes: null,
      source: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  ],
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

function setup(
  overrides: {
    appointments?: AppointmentWithDetails[]
    prescriptions?: Prescription[]
    invoices?: InvoiceWithDetails[]
  } = {},
): void {
  mocks.usePatient.mockReturnValue({ data: patient, isLoading: false, isError: false })
  mocks.useAppointments.mockReturnValue({
    data: overrides.appointments ?? [inProgressAppt, scheduledAppt],
    isLoading: false,
    isError: false,
  })
  mocks.usePatientPrescriptions.mockReturnValue({
    data: overrides.prescriptions ?? [prescription],
    isLoading: false,
    isError: false,
  })
  mocks.useInvoices.mockReturnValue({
    data: { items: overrides.invoices ?? [invoice], hasMore: false },
    isLoading: false,
    isError: false,
  })
  mocks.useStartConsultation.mockReturnValue({ start: vi.fn(), isStarting: false })
  mocks.useUiStore.mockReturnValue(null)
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

describe('PatientDetail tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  it('renders the four tabs with Historia clínica active by default', () => {
    renderPage()
    for (const t of ['Historia clínica', 'Citas', 'Recetas', 'Facturas']) {
      expect(screen.getByRole('tab', { name: t })).toBeInTheDocument()
    }
    expect(screen.getByTestId('clinical-history')).toBeInTheDocument()
  })

  it('fetches appointments by patientId only (no active-location filter)', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Citas' }))
    expect(mocks.useAppointments).toHaveBeenCalledWith({ patientId: 'p1' })
  })

  it('Citas tab lists appointments with status badges and consultation links', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Citas' }))
    expect(screen.getByText('En consulta')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /ver consulta/i })
    expect(link).toHaveAttribute('href', '/consultas/c1')
  })

  it('Citas tab shows Iniciar consulta for scheduled rows', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Citas' }))
    expect(screen.getByText('Iniciar consulta')).toBeInTheDocument()
  })

  it('Recetas tab lists prescriptions with drug and consultation link', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Recetas' }))
    expect(screen.getByText(/Amoxicilina/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver consulta/i })).toHaveAttribute(
      'href',
      '/consultas/c1',
    )
  })

  it('Facturas tab lists invoices with totals and billing link', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Facturas' }))
    expect(screen.getByText(/1,?500/)).toBeInTheDocument()
    expect(screen.getByText('F-0001')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver en facturación/i })).toHaveAttribute(
      'href',
      '/facturacion',
    )
  })

  it('shows an empty state on the Recetas tab with no records', async () => {
    setup({ prescriptions: [] })
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Recetas' }))
    expect(screen.getByText('Sin recetas registradas')).toBeInTheDocument()
  })

  it('shows an empty state on the Citas tab with no records', async () => {
    setup({ appointments: [] })
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Citas' }))
    expect(screen.getByText('Sin citas registradas')).toBeInTheDocument()
  })

  it('shows an empty state on the Facturas tab with no records', async () => {
    setup({ invoices: [] })
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Facturas' }))
    expect(screen.getByText('Sin facturas registradas')).toBeInTheDocument()
  })
})
