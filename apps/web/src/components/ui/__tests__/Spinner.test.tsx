import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '../Spinner'

describe('Spinner', () => {
  it('renders a status role with the default Spanish label', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('Cargando')
    const glyph = el.querySelector('i')
    expect(glyph?.className).toContain('ph-spinner')
    expect(glyph?.className).toContain('animate-spin')
  })

  it('exposes an sr-only label so screen readers have real text content', () => {
    render(<Spinner />)
    const srLabel = screen.getByText('Cargando')
    expect(srLabel.className).toContain('sr-only')
  })

  it('applies size variants', () => {
    render(<Spinner size="lg" />)
    const glyph = screen.getByRole('status').querySelector('i')
    expect(glyph?.className).toContain('text-[32px]')
  })

  it('defaults to md', () => {
    render(<Spinner />)
    const glyph = screen.getByRole('status').querySelector('i')
    expect(glyph?.className).toContain('text-[20px]')
  })

  it('accepts a custom label and className', () => {
    render(<Spinner aria-label="Guardando" className="text-p-500" />)
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('Guardando')
    const glyph = el.querySelector('i')
    expect(glyph?.className).toContain('text-p-500')
  })

  it('in decorative mode is aria-hidden with no status role or label', () => {
    const { container } = render(<Spinner decorative />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const glyph = container.querySelector('i')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    expect(glyph).not.toHaveAttribute('aria-label')
    expect(glyph?.className).toContain('ph-spinner')
  })
})
