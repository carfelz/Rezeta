import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

afterEach(() => {
  seedAuthUser(null)
})

function renderSidebar(): void {
  render(
    <MemoryRouter>
      <Sidebar open={false} onClose={() => undefined} />
    </MemoryRouter>,
  )
}

describe('Sidebar permission filtering', () => {
  it('hides Protocolos and Ajustes for an assistant', () => {
    seedAuthUser(makeAuthUser('assistant'))
    renderSidebar()
    // assistant: protocols = none, all admin modules = none
    expect(screen.queryByText('Protocolos')).not.toBeInTheDocument()
    expect(screen.queryByText('Ajustes')).not.toBeInTheDocument()
    // sanity: modules the assistant retains are still shown
    expect(screen.getByText('Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Facturación')).toBeInTheDocument()
  })

  it('shows Protocolos and Ajustes for a doctor', () => {
    seedAuthUser(makeAuthUser('doctor'))
    renderSidebar()
    expect(screen.getByText('Protocolos')).toBeInTheDocument()
    // "Ajustes" appears only in the nav here — the user-menu copy of it lives
    // inside a closed Radix dropdown that is not rendered until opened.
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
  })

  it('hides the avatar dropdown "Ajustes" link for an assistant (templates = none)', async () => {
    seedAuthUser(makeAuthUser('assistant'))
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    // Only the nav copy would have matched before opening the dropdown; once
    // opened, the assistant should still see no "Ajustes" anywhere.
    expect(screen.queryByText('Ajustes')).not.toBeInTheDocument()
  })

  it('shows the avatar dropdown "Ajustes" link for a doctor (templates = manage)', async () => {
    seedAuthUser(makeAuthUser('doctor'))
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    // Now two matches exist: the main nav item and the dropdown item.
    expect(screen.getAllByText('Ajustes').length).toBe(2)
  })

  it('shows Ajustes for an admin-like user with templates: none but users: manage', () => {
    seedAuthUser(
      makeAuthUser('admin', {
        capabilities: {
          ...makeAuthUser('admin').capabilities,
          templates: 'none',
          users: 'manage',
        },
      }),
    )
    renderSidebar()
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
  })

  it('shows the avatar dropdown "Ajustes" link for that same admin-like user', async () => {
    seedAuthUser(
      makeAuthUser('admin', {
        capabilities: {
          ...makeAuthUser('admin').capabilities,
          templates: 'none',
          users: 'manage',
        },
      }),
    )
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    expect(screen.getAllByText('Ajustes').length).toBe(2)
  })

  it('hides Ajustes when every admin-section module is none (assistant defaults)', () => {
    seedAuthUser(makeAuthUser('assistant'))
    renderSidebar()
    expect(screen.queryByText('Ajustes')).not.toBeInTheDocument()
  })
})
