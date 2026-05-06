import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Caption } from '../Caption'

describe('Caption', () => {
  it('renders children', () => {
    render(<Caption>Anamnesis</Caption>)
    expect(screen.getByText('Anamnesis')).toBeInTheDocument()
  })

  it('renders as span by default', () => {
    const { container } = render(<Caption>x</Caption>)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })

  it('renders as the requested element', () => {
    const { container } = render(<Caption as="p">x</Caption>)
    expect(container.firstChild?.nodeName).toBe('P')
  })

  it.each([
    ['neutral', 'text-n-500'],
    ['muted', 'text-n-400'],
    ['strong', 'text-n-700'],
    ['primary', 'text-p-700'],
    ['warning', 'text-warning-text'],
    ['danger', 'text-danger-text'],
    ['success', 'text-success-text'],
  ] as const)('tone=%s applies %s class', (tone, expected) => {
    const { container } = render(<Caption tone={tone}>x</Caption>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it.each([
    ['xs', 'text-[11px]'],
    ['sm', 'text-[11.5px]'],
    ['md', 'text-[12px]'],
    ['lg', 'text-[12.5px]'],
  ] as const)('size=%s applies %s class', (size, expected) => {
    const { container } = render(<Caption size={size}>x</Caption>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it('always font-sans', () => {
    const { container } = render(<Caption>x</Caption>)
    expect(container.firstChild).toHaveClass('font-sans')
  })

  it('weight=semibold applies font-semibold', () => {
    const { container } = render(<Caption weight="semibold">x</Caption>)
    expect(container.firstChild).toHaveClass('font-semibold')
  })
})
