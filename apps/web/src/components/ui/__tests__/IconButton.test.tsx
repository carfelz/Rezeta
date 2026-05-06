import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { IconButton } from '../IconButton'

describe('IconButton', () => {
  it('renders with the requested aria-label', () => {
    render(<IconButton icon="ph ph-x" aria-label="Cerrar" />)
    expect(screen.getByLabelText('Cerrar')).toBeInTheDocument()
  })

  it('renders the requested icon class', () => {
    render(<IconButton icon="ph ph-trash" aria-label="Eliminar" />)
    const icon = screen.getByLabelText('Eliminar').querySelector('i')
    expect(icon).toHaveClass('ph', 'ph-trash')
  })

  it('default type is button', () => {
    render(<IconButton icon="ph ph-x" aria-label="x" />)
    expect(screen.getByLabelText('x')).toHaveAttribute('type', 'button')
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(<IconButton icon="ph ph-x" aria-label="x" onClick={onClick} />)
    fireEvent.click(screen.getByLabelText('x'))
    expect(onClick).toHaveBeenCalled()
  })

  it.each(['neutral', 'danger', 'muted', 'warning'] as const)(
    'tone=%s renders without errors',
    (tone) => {
      render(<IconButton icon="ph ph-x" aria-label="x" tone={tone} />)
      expect(screen.getByLabelText('x')).toBeInTheDocument()
    },
  )

  it.each([
    ['sm', 'w-6'],
    ['md', 'w-7'],
    ['lg', 'w-8'],
  ] as const)('size=%s applies %s class', (size, expected) => {
    render(<IconButton icon="ph ph-x" aria-label="x" size={size} />)
    expect(screen.getByLabelText('x')).toHaveClass(expected)
  })

  it('respects disabled prop', () => {
    render(<IconButton icon="ph ph-x" aria-label="x" disabled />)
    expect(screen.getByLabelText('x')).toBeDisabled()
  })
})
