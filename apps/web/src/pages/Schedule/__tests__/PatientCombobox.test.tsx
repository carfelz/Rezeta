import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/patients/use-patients', () => ({
  usePatients: () => ({
    data: {
      items: [{ id: 'p1', firstName: 'Ana', lastName: 'Reyes', documentNumber: '001' }],
    },
  }),
  useCreatePatient: () => ({ mutateAsync: mocks.createMutateAsync, isPending: false }),
  useUpdatePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/locations/use-locations', () => ({
  useLocations: () => ({ data: [{ id: 'loc1', name: 'Consultorio', isOwned: true }] }),
}))

vi.mock('@/store/ui.store', () => ({
  useUiStore: (selector: (s: { activeLocationId: string | null }) => unknown) =>
    selector({ activeLocationId: 'loc1' }),
}))

import { PatientCombobox } from '../PatientCombobox'

describe('PatientCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the dropdown when the input is clicked', async () => {
    const user = userEvent.setup()
    render(<PatientCombobox value="" onChange={vi.fn()} />)
    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    expect(await screen.findByText(/ana reyes/i)).toBeInTheDocument()
  })

  // Regression: clicking outside the combobox must only dismiss the dropdown. It
  // previously fired a clear callback that reset the whole appointment form, so a
  // date/time selection was wiped the moment the user clicked any other field.
  it('does not clear the selection when clicking outside', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <div>
        <PatientCombobox value="p1" onChange={onChange} />
        <button type="button">outside</button>
      </div>,
    )
    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    expect(await screen.findByText(/ana reyes/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'outside' }))

    // Dropdown dismissed…
    expect(screen.queryByText(/ana reyes/i)).not.toBeInTheDocument()
    // …but no clear was emitted.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders the fixed "Nuevo paciente" option with search results', async () => {
    const user = userEvent.setup()
    render(<PatientCombobox value="" onChange={vi.fn()} />)
    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    expect(await screen.findByText(/ana reyes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuevo paciente/i })).toBeInTheDocument()
  })

  it('renders the fixed "Nuevo paciente" option with zero search results', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PatientCombobox value="" onChange={vi.fn()} />)
    void rerender
    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    await user.type(screen.getByPlaceholderText(/buscar paciente/i), 'zzz-no-match')
    expect(screen.getByRole('button', { name: /nuevo paciente/i })).toBeInTheDocument()
  })

  it('opens the creation modal when "Nuevo paciente" is clicked', async () => {
    const user = userEvent.setup()
    render(<PatientCombobox value="" onChange={vi.fn()} />)
    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }))
    expect(screen.getByRole('heading', { name: 'Registrar paciente' })).toBeInTheDocument()
  })

  it('selects the newly created patient and closes the modal on success', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    mocks.createMutateAsync.mockResolvedValue({
      id: 'new-1',
      firstName: 'Luis',
      lastName: 'Pérez',
    })
    render(<PatientCombobox value="" onChange={onChange} />)
    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }))

    await user.type(screen.getByPlaceholderText('Ej. Ana María Reyes'), 'Luis Pérez')
    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }))

    expect(onChange).toHaveBeenCalledWith('new-1', 'Luis Pérez')
    expect(
      screen.queryByRole('heading', { name: 'Registrar paciente' }),
    ).not.toBeInTheDocument()
  })

  it('leaves the selection unchanged when the creation modal is cancelled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PatientCombobox value="" onChange={onChange} />)
    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }))
    expect(screen.getByRole('heading', { name: 'Registrar paciente' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('heading', { name: 'Registrar paciente' })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
