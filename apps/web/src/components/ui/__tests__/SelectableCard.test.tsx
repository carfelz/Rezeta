import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SelectableCard } from '../SelectableCard'

describe('SelectableCard', () => {
  it('renders children', () => {
    render(<SelectableCard>Card body</SelectableCard>)
    expect(screen.getByText('Card body')).toBeInTheDocument()
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(<SelectableCard onClick={onClick}>x</SelectableCard>)
    fireEvent.click(screen.getByText('x'))
    expect(onClick).toHaveBeenCalled()
  })

  it('always type=button', () => {
    render(<SelectableCard>x</SelectableCard>)
    expect(screen.getByText('x')).toHaveAttribute('type', 'button')
  })

  it.each([
    ['default', 'border-n-200'],
    ['selected', 'border-p-500'],
    ['primary', 'border-p-500'],
  ] as const)('state=%s applies %s class', (state, expected) => {
    render(<SelectableCard state={state}>x</SelectableCard>)
    expect(screen.getByText('x')).toHaveClass(expected)
  })

  it.each([
    ['compact', 'px-3'],
    ['standard', 'px-4'],
    ['large', 'rounded-md'],
  ] as const)('density=%s applies %s class', (density, expected) => {
    render(<SelectableCard density={density}>x</SelectableCard>)
    expect(screen.getByText('x')).toHaveClass(expected)
  })

  it('respects disabled', () => {
    render(<SelectableCard disabled>x</SelectableCard>)
    expect(screen.getByText('x')).toBeDisabled()
  })
})
