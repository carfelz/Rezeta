import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchInput } from '../SearchInput'

describe('SearchInput', () => {
  it('renders the placeholder', () => {
    render(<SearchInput placeholder="Buscar…" />)
    expect(screen.getByPlaceholderText('Buscar…')).toBeInTheDocument()
  })

  it('has type=search', () => {
    render(<SearchInput placeholder="x" />)
    expect(screen.getByPlaceholderText('x')).toHaveAttribute('type', 'search')
  })

  it('renders the magnifying-glass icon', () => {
    const { container } = render(<SearchInput placeholder="x" />)
    expect(container.querySelector('.ph-magnifying-glass')).toBeInTheDocument()
  })

  it('forwards onChange', () => {
    const onChange = vi.fn()
    render(<SearchInput placeholder="x" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: 'HTA' } })
    expect(onChange).toHaveBeenCalled()
  })

  it.each([
    ['sm', 'h-input-md'],
    ['md', 'h-btn-lg'],
  ] as const)('size=%s applies %s class', (size, expected) => {
    render(<SearchInput placeholder="x" size={size} />)
    expect(screen.getByPlaceholderText('x')).toHaveClass(expected)
  })

  it('respects disabled', () => {
    render(<SearchInput placeholder="x" disabled />)
    expect(screen.getByPlaceholderText('x')).toBeDisabled()
  })

  it('renders defaultValue', () => {
    render(<SearchInput placeholder="x" defaultValue="HTA" />)
    expect(screen.getByPlaceholderText('x')).toHaveValue('HTA')
  })
})
