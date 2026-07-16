import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  useCreateInstitution: vi.fn(),
  mutateAsync: vi.fn(),
}))
vi.mock('@/hooks/staff/use-create-institution', () => ({
  useCreateInstitution: mocks.useCreateInstitution,
}))

import { NewInstitution } from '../NewInstitution'

describe('NewInstitution', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({
      tenantId: 't1',
      userId: 'u1',
      email: 'ana@clinica.com',
    })
    mocks.useCreateInstitution.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    })
  })

  it('renders the English form', () => {
    render(<NewInstitution />)
    expect(screen.getByRole('heading', { name: /new institution/i })).toBeInTheDocument()
  })

  it('submits the payload to the mutation', async () => {
    render(<NewInstitution />)
    fireEvent.change(screen.getByLabelText(/institution name/i), {
      target: { value: 'Clínica Norte' },
    })
    fireEvent.change(screen.getByLabelText(/admin name/i), { target: { value: 'Dra. Ana' } })
    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: 'ana@clinica.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create institution/i }))

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionName: 'Clínica Norte',
          adminFullName: 'Dra. Ana',
          adminEmail: 'ana@clinica.com',
        }),
      )
    })
    expect(await screen.findByText(/created/i)).toBeInTheDocument()
  })

  it('shows an error callout when the mutation rejects', async () => {
    mocks.mutateAsync.mockReset().mockRejectedValue(new Error('boom'))
    render(<NewInstitution />)
    fireEvent.change(screen.getByLabelText(/institution name/i), {
      target: { value: 'Clínica Norte' },
    })
    fireEvent.change(screen.getByLabelText(/admin name/i), { target: { value: 'Dra. Ana' } })
    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: 'ana@clinica.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create institution/i }))

    expect(await screen.findByText(/could not create the institution/i)).toBeInTheDocument()
  })

  it('disables submit until the required fields are filled', () => {
    render(<NewInstitution />)
    expect(screen.getByRole('button', { name: /create institution/i })).toBeDisabled()
  })
})
