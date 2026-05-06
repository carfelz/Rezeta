import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { ConsultHeader } from '../ConsultHeader'

function renderHeader(props: Partial<Parameters<typeof ConsultHeader>[0]> = {}): void {
  render(
    <MemoryRouter>
      <ConsultHeader
        breadcrumbs={[
          { label: 'Pacientes', to: '/pacientes' },
          { label: 'Isabel Cristina Cruz', to: '/pacientes/p1' },
          { label: 'Consulta · 2 may de 2026' },
        ]}
        datetimeOverline="SÁBADO, 2 DE MAYO DE 2026 · 02:29 A.M. · CONSULTORIO PRIVADO DR. GARCÍA"
        title="Nueva consulta"
        subtitle="Isabel Cristina Cruz · Dr. Test García"
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('ConsultHeader', () => {
  it('renders the title', () => {
    renderHeader()
    expect(screen.getByRole('heading', { name: 'Nueva consulta' })).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    renderHeader()
    expect(screen.getByText('Isabel Cristina Cruz · Dr. Test García')).toBeInTheDocument()
  })

  it('renders the datetime overline', () => {
    renderHeader()
    expect(
      screen.getByText('SÁBADO, 2 DE MAYO DE 2026 · 02:29 A.M. · CONSULTORIO PRIVADO DR. GARCÍA'),
    ).toBeInTheDocument()
  })

  it('renders breadcrumb labels', () => {
    renderHeader()
    expect(screen.getByText('Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Isabel Cristina Cruz')).toBeInTheDocument()
    expect(screen.getByText('Consulta · 2 may de 2026')).toBeInTheDocument()
  })

  it('renders intermediate breadcrumbs as links', () => {
    renderHeader()
    const link = screen.getByRole('link', { name: 'Pacientes' })
    expect(link).toHaveAttribute('href', '/pacientes')
  })

  it('renders the last breadcrumb as plain text (not a link)', () => {
    renderHeader()
    expect(screen.queryByRole('link', { name: 'Consulta · 2 may de 2026' })).toBeNull()
  })

  it('renders the right slot content', () => {
    renderHeader({
      rightSlot: <button type="button">Acción</button>,
    })
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    renderHeader({ subtitle: undefined })
    expect(screen.queryByText('Isabel Cristina Cruz · Dr. Test García')).toBeNull()
  })
})
