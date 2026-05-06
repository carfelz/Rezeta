import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RadioCard } from '../RadioCard'

describe('RadioCard', () => {
  it('renders children', () => {
    render(<RadioCard selected={false}>Option A</RadioCard>)
    expect(screen.getByText('Option A')).toBeInTheDocument()
  })

  it('has role=radio', () => {
    render(<RadioCard selected={false}>x</RadioCard>)
    expect(screen.getByRole('radio')).toBeInTheDocument()
  })

  it('aria-checked reflects selected state', () => {
    const { rerender } = render(<RadioCard selected={false}>x</RadioCard>)
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false')
    rerender(<RadioCard selected>x</RadioCard>)
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'true')
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(
      <RadioCard selected={false} onClick={onClick}>
        x
      </RadioCard>,
    )
    fireEvent.click(screen.getByRole('radio'))
    expect(onClick).toHaveBeenCalled()
  })

  it('selected applies p-500 border', () => {
    render(<RadioCard selected>x</RadioCard>)
    expect(screen.getByRole('radio')).toHaveClass('border-p-500')
  })

  it('renders dot indicator when selected', () => {
    const { container } = render(<RadioCard selected>x</RadioCard>)
    const dots = container.querySelectorAll('.bg-p-500')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('respects disabled', () => {
    render(
      <RadioCard selected={false} disabled>
        x
      </RadioCard>,
    )
    expect(screen.getByRole('radio')).toBeDisabled()
  })
})
