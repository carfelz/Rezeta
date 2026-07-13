import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Overline } from '../Overline'

describe('Overline', () => {
  it('renders the children content', () => {
    render(<Overline>Paso 1 de 2</Overline>)
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument()
  })

  it('renders as div by default', () => {
    const { container } = render(<Overline>x</Overline>)
    expect(container.firstChild?.nodeName).toBe('DIV')
  })

  it('renders as the requested element when `as` is set', () => {
    const { container } = render(<Overline as="span">x</Overline>)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })

  it.each([
    ['neutral', 'text-n-400'],
    ['muted', 'text-n-500'],
    ['primary', 'text-p-700'],
    ['warning', 'text-warning-text'],
    ['danger', 'text-danger-text'],
    ['success', 'text-success-text'],
  ] as const)('applies tone=%s class', (tone, expected) => {
    const { container } = render(<Overline tone={tone}>x</Overline>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it.each([
    ['xs', 'text-2xs'],
    ['sm', 'text-2xs'],
    ['md', 'text-2xs'],
    ['lg', 'text-overline'],
  ] as const)('applies size=%s class', (size, expected) => {
    const { container } = render(<Overline size={size}>x</Overline>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it('applies weight=semibold class', () => {
    const { container } = render(<Overline weight="semibold">x</Overline>)
    expect(container.firstChild).toHaveClass('font-semibold')
  })

  it('passes through arbitrary className', () => {
    const { container } = render(<Overline className="mb-2">x</Overline>)
    expect(container.firstChild).toHaveClass('mb-2')
  })

  it('always applies font-mono and uppercase', () => {
    const { container } = render(<Overline>x</Overline>)
    expect(container.firstChild).toHaveClass('font-mono', 'uppercase')
  })
})
