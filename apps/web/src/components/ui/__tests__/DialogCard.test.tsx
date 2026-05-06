import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DialogCard } from '../DialogCard'

describe('DialogCard', () => {
  it('renders overline + title', () => {
    render(<DialogCard overline="SALTAR PASO" title="¿Por qué saltar?" />)
    expect(screen.getByText('SALTAR PASO')).toBeInTheDocument()
    expect(screen.getByText('¿Por qué saltar?')).toBeInTheDocument()
  })

  it('renders title in an h2', () => {
    render(<DialogCard overline="X" title="Welcome" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Welcome' })).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<DialogCard overline="X" title="T" description="Descripción de prueba" />)
    expect(screen.getByText('Descripción de prueba')).toBeInTheDocument()
  })

  it('does not render description paragraph when not provided', () => {
    const { container } = render(<DialogCard overline="X" title="T" />)
    expect(container.querySelectorAll('p').length).toBe(0)
  })

  it('renders body children when provided', () => {
    render(
      <DialogCard overline="X" title="T">
        <span>body content</span>
      </DialogCard>,
    )
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(<DialogCard overline="X" title="T" footer={<button>OK</button>} />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it.each([
    ['sm', 'w-[440px]'],
    ['md', 'w-[460px]'],
    ['lg', 'w-[520px]'],
    ['xl', 'w-[540px]'],
  ] as const)('width=%s applies %s class', (width, expected) => {
    const { container } = render(<DialogCard overline="X" title="T" width={width} />)
    expect(container.firstChild).toHaveClass(expected)
  })

  it('overlineTone applies correct color class', () => {
    render(<DialogCard overline="WARN" title="T" overlineTone="warning" />)
    expect(screen.getByText('WARN')).toHaveClass('text-warning-text')
  })
})
