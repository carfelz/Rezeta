import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/hooks/patients/use-patients', () => ({
  usePatients: () => ({
    data: {
      items: [{ id: 'p1', firstName: 'Ana', lastName: 'Reyes', documentNumber: '001' }],
    },
  }),
}))

import { PatientCombobox } from '../PatientCombobox'

describe('PatientCombobox', () => {
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
})
