import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Chip } from '../Chip'

describe('Chip', () => {
  it('renders children', () => {
    render(<Chip>En curso</Chip>)
    expect(screen.getByText('En curso')).toBeInTheDocument()
  })

  it('renders as span by default', () => {
    const { container } = render(<Chip>x</Chip>)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })

  it('renders as button when asButton=true', () => {
    const { container } = render(<Chip asButton>x</Chip>)
    expect(container.firstChild?.nodeName).toBe('BUTTON')
  })

  it('forwards onClick when asButton', () => {
    const onClick = vi.fn()
    render(
      <Chip asButton onClick={onClick}>
        x
      </Chip>,
    )
    fireEvent.click(screen.getByText('x'))
    expect(onClick).toHaveBeenCalled()
  })

  it.each([
    ['primary', 'text-p-700'],
    ['primarySolid', 'bg-p-50'],
    ['warning', 'text-warning-text'],
    ['danger', 'text-danger-text'],
    ['success', 'text-success-text'],
    ['neutral', 'text-n-600'],
  ] as const)('tone=%s applies %s class', (tone, expected) => {
    const { container } = render(<Chip tone={tone}>x</Chip>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it.each([
    ['xs', 'text-[9.5px]'],
    ['sm', 'text-[10px]'],
    ['md', 'text-[11px]'],
  ] as const)('size=%s applies %s class', (size, expected) => {
    const { container } = render(<Chip size={size}>x</Chip>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it('default style applies font-mono and uppercase', () => {
    const { container } = render(<Chip>x</Chip>)
    expect(container.firstChild).toHaveClass('font-mono', 'uppercase')
  })

  it('format=sentence applies font-sans and normal-case', () => {
    const { container } = render(<Chip format="sentence">x</Chip>)
    expect(container.firstChild).toHaveClass('font-sans', 'normal-case')
  })

  it('asButton has type=button', () => {
    render(<Chip asButton>x</Chip>)
    expect(screen.getByText('x')).toHaveAttribute('type', 'button')
  })
})
