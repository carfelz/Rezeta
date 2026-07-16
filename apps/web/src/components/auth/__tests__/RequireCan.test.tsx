import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireCan } from '../RequireCan'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

afterEach(() => {
  seedAuthUser(null)
})

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/protocolos"
          element={
            <RequireCan module="protocols">
              <div>Protocolos content</div>
            </RequireCan>
          }
        />
        <Route path="/dashboard" element={<div>Dashboard content</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireCan', () => {
  it('redirects to /dashboard when the user lacks view on the module', () => {
    seedAuthUser(makeAuthUser('assistant')) // assistant: protocols = none
    renderAt('/protocolos')
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(screen.queryByText('Protocolos content')).not.toBeInTheDocument()
  })

  it('renders children when the user has the required access', () => {
    seedAuthUser(makeAuthUser('doctor')) // doctor: protocols = manage (>= view)
    renderAt('/protocolos')
    expect(screen.getByText('Protocolos content')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated user', () => {
    renderAt('/protocolos')
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })
})
