import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GroupSectionCard } from '../GroupSectionCard'

describe('GroupSectionCard', () => {
  it('renders children', () => {
    render(<GroupSectionCard>Body</GroupSectionCard>)
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders label as mono overline when provided', () => {
    render(<GroupSectionCard label="Receta">x</GroupSectionCard>)
    expect(screen.getByText('Receta')).toHaveClass('font-mono', 'uppercase')
  })

  it('omits label when not provided', () => {
    const { container } = render(<GroupSectionCard>x</GroupSectionCard>)
    expect(container.querySelector('.font-mono.uppercase')).toBeNull()
  })

  it('renders title in header row', () => {
    render(<GroupSectionCard title="Tratamiento">x</GroupSectionCard>)
    expect(screen.getByText('Tratamiento')).toBeInTheDocument()
  })

  it('does NOT render header when neither title nor headerActions provided', () => {
    const { container } = render(<GroupSectionCard label="X">body</GroupSectionCard>)
    expect(container.querySelector('.bg-n-25')).toBeNull()
  })

  it('renders headerActions on the right of header', () => {
    render(
      <GroupSectionCard title="Receta" headerActions={<span>OK</span>}>
        x
      </GroupSectionCard>,
    )
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(<GroupSectionCard footer={<button>Generar</button>}>x</GroupSectionCard>)
    expect(screen.getByText('Generar')).toBeInTheDocument()
  })

  it.each([
    ['neutral', 'border-n-200'],
    ['danger', 'border-danger-border'],
    ['warning', 'border-warning-border'],
  ] as const)('tone=%s applies %s class', (tone, expected) => {
    const { container } = render(<GroupSectionCard tone={tone}>x</GroupSectionCard>)
    const surface = container.querySelector('.rounded-md')
    expect(surface).toHaveClass(expected)
  })

  it('compact applies smaller body padding', () => {
    const { container } = render(<GroupSectionCard compact>x</GroupSectionCard>)
    expect(container.querySelector('.px-3.py-2')).toBeInTheDocument()
  })
})
