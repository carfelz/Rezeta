import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DashedButton } from '../DashedButton'

describe('DashedButton', () => {
  it('renders children', () => {
    render(<DashedButton>+ Añadir</DashedButton>)
    expect(screen.getByText('+ Añadir')).toBeInTheDocument()
  })

  it('default type is button', () => {
    render(<DashedButton>x</DashedButton>)
    expect(screen.getByText('x')).toHaveAttribute('type', 'button')
  })

  it('applies dashed border', () => {
    render(<DashedButton>x</DashedButton>)
    expect(screen.getByText('x')).toHaveClass('border-dashed')
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(<DashedButton onClick={onClick}>x</DashedButton>)
    fireEvent.click(screen.getByText('x'))
    expect(onClick).toHaveBeenCalled()
  })

  it.each([
    ['neutral', 'text-n-500'],
    ['subtle', 'text-n-400'],
    ['warning', 'text-n-600'],
  ] as const)('tone=%s applies %s class', (tone, expected) => {
    render(<DashedButton tone={tone}>x</DashedButton>)
    expect(screen.getByText('x')).toHaveClass(expected)
  })

  it('respects disabled', () => {
    render(<DashedButton disabled>x</DashedButton>)
    expect(screen.getByText('x')).toBeDisabled()
  })
})
