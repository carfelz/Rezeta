import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '../Spinner'

describe('Spinner', () => {
  it('renders a status role with the default Spanish label', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-label', 'Cargando')
    expect(el.className).toContain('ph-spinner')
    expect(el.className).toContain('animate-spin')
  })

  it('applies size variants', () => {
    render(<Spinner size="lg" />)
    expect(screen.getByRole('status').className).toContain('text-[32px]')
  })

  it('defaults to md', () => {
    render(<Spinner />)
    expect(screen.getByRole('status').className).toContain('text-[20px]')
  })

  it('accepts a custom label and className', () => {
    render(<Spinner aria-label="Guardando" className="text-p-500" />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-label', 'Guardando')
    expect(el.className).toContain('text-p-500')
  })
})
