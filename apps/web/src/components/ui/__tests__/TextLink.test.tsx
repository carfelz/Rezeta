import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TextLink } from '../TextLink'

describe('TextLink', () => {
  it('renders children', () => {
    render(<TextLink>Editar</TextLink>)
    expect(screen.getByText('Editar')).toBeInTheDocument()
  })

  it('default type is button', () => {
    render(<TextLink>x</TextLink>)
    expect(screen.getByText('x')).toHaveAttribute('type', 'button')
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(<TextLink onClick={onClick}>x</TextLink>)
    fireEvent.click(screen.getByText('x'))
    expect(onClick).toHaveBeenCalled()
  })

  it.each([
    ['neutral', 'text-n-500'],
    ['primary', 'text-p-500'],
    ['warning', 'text-warning-text'],
    ['danger', 'text-danger-text'],
  ] as const)('tone=%s applies %s class', (tone, expected) => {
    render(<TextLink tone={tone}>x</TextLink>)
    expect(screen.getByText('x')).toHaveClass(expected)
  })

  it.each([
    ['xs', 'text-[11px]'],
    ['sm', 'text-[11.5px]'],
    ['md', 'text-[12px]'],
    ['lg', 'text-[12.5px]'],
  ] as const)('size=%s applies %s class', (size, expected) => {
    render(<TextLink size={size}>x</TextLink>)
    expect(screen.getByText('x')).toHaveClass(expected)
  })

  it('underline=always applies underline', () => {
    render(<TextLink underline="always">x</TextLink>)
    expect(screen.getByText('x')).toHaveClass('underline')
  })

  it('respects disabled prop', () => {
    render(<TextLink disabled>x</TextLink>)
    expect(screen.getByText('x')).toBeDisabled()
  })

  it('weight=semibold applies font-semibold class', () => {
    render(<TextLink weight="semibold">x</TextLink>)
    expect(screen.getByText('x')).toHaveClass('font-semibold')
  })
})
