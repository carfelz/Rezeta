import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  useLocations: vi.fn(),
  useUiStore: vi.fn(),
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/locations/use-locations', () => ({ useLocations: mocks.useLocations }))
vi.mock('@/store/ui.store', () => ({
  useUiStore: (selector: (s: { activeLocationId: string | null; setActiveLocation: () => void }) => unknown) =>
    mocks.useUiStore(selector),
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: mocks.useAuth }))

import { Topbar } from '../Topbar'

function renderTopbar(): void {
  render(
    <MemoryRouter>
      <Topbar onMenuClick={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('Topbar location selector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useUiStore.mockImplementation(
      (selector: (s: { activeLocationId: string | null; setActiveLocation: () => void }) => unknown) =>
        selector({ activeLocationId: null, setActiveLocation: vi.fn() }),
    )
    mocks.useAuth.mockReturnValue({ user: null })
  })

  it('shows an empty state with a link to locations settings when the tenant has zero locations', async () => {
    mocks.useLocations.mockReturnValue({ data: [] })
    const user = userEvent.setup()
    renderTopbar()

    await user.click(screen.getByText('Seleccionar ubicación'))

    expect(screen.getByText('Sin ubicaciones configuradas')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Añadir ubicación' })
    expect(link).toHaveAttribute('href', '/ajustes/ubicaciones')
  })

  it('still lists locations normally when the tenant has locations', async () => {
    mocks.useLocations.mockReturnValue({
      data: [{ id: 'loc1', name: 'Consultorio', city: 'Santo Domingo' }],
    })
    const user = userEvent.setup()
    renderTopbar()

    await user.click(screen.getByText('Consultorio'))

    expect(screen.queryByText('Sin ubicaciones configuradas')).not.toBeInTheDocument()
  })
})
