import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { Breadcrumbs } from '../Breadcrumbs'

function renderBC(items: Parameters<typeof Breadcrumbs>[0]['items']): void {
  render(
    <MemoryRouter>
      <Breadcrumbs items={items} />
    </MemoryRouter>,
  )
}

describe('Breadcrumbs', () => {
  it('renders all labels', () => {
    renderBC([
      { label: 'Pacientes', to: '/p' },
      { label: 'Isabel', to: '/p/1' },
      { label: 'Consulta' },
    ])
    expect(screen.getByText('Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Isabel')).toBeInTheDocument()
    expect(screen.getByText('Consulta')).toBeInTheDocument()
  })

  it('intermediate items render as links', () => {
    renderBC([{ label: 'Pacientes', to: '/p' }, { label: 'Isabel' }])
    expect(screen.getByRole('link', { name: 'Pacientes' })).toHaveAttribute('href', '/p')
  })

  it('last item never renders as link even when given to', () => {
    renderBC([
      { label: 'Pacientes', to: '/p' },
      { label: 'Isabel', to: '/p/1' },
    ])
    expect(screen.queryByRole('link', { name: 'Isabel' })).toBeNull()
  })

  it('intermediate item without to renders as plain text', () => {
    renderBC([{ label: 'Pacientes' }, { label: 'Isabel' }])
    expect(screen.queryByRole('link', { name: 'Pacientes' })).toBeNull()
  })

  it('renders nav with aria-label=Breadcrumb', () => {
    renderBC([{ label: 'a' }])
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
  })

  it('renders caret separators between items (one less than items count)', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'a' }, { label: 'b' }, { label: 'c' }]} />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('.ph-caret-right').length).toBe(2)
  })
})
