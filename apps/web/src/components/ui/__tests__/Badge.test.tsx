import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Activo</Badge>)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('renders dot by default', () => {
    const { container } = render(<Badge>Draft</Badge>)
    const dot = container.querySelector('.w-\\[6px\\]')
    expect(dot).toBeInTheDocument()
  })

  it('hides dot when showDot is false', () => {
    const { container } = render(<Badge showDot={false}>Draft</Badge>)
    const dot = container.querySelector('.w-\\[6px\\]')
    expect(dot).not.toBeInTheDocument()
  })

  it('applies draft variant by default', () => {
    render(<Badge>Draft</Badge>)
    const badge = screen.getByText('Draft').closest('span')!
    expect(badge.className).toContain('bg-n-50')
  })

  it.each([
    ['active', 'bg-success-bg'],
    ['signed', 'bg-p-50'],
    ['review', 'bg-warning-bg'],
    ['archived', 'bg-n-50'],
    ['paid', 'bg-success-bg'],
    ['overdue', 'bg-danger-bg'],
  ] as const)('renders %s variant with correct bg', (variant, expectedClass) => {
    render(<Badge variant={variant}>{variant}</Badge>)
    const badge = screen.getByText(variant).closest('span')!
    expect(badge.className).toContain(expectedClass)
  })

  it('applies custom className', () => {
    render(<Badge className="custom">Test</Badge>)
    const badge = screen.getByText('Test').closest('span')!
    expect(badge.className).toContain('custom')
  })
})
