import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
