import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SoapTextarea } from '../SoapTextarea'

describe('SoapTextarea', () => {
  it('renders textarea with value when not disabled', () => {
    const onChange = vi.fn()
    render(
      <SoapTextarea value="hello" onChange={onChange} placeholder="ph" rows={3} disabled={false} />,
    )
    const ta = screen.getByPlaceholderText('ph')
    expect(ta.value).toBe('hello')
    fireEvent.change(ta, { target: { value: 'new' } })
    expect(onChange).toHaveBeenCalledWith('new')
  })

  it('renders read-only paragraph when disabled', () => {
    render(<SoapTextarea value="hello" onChange={vi.fn()} placeholder="ph" rows={3} disabled />)
    expect(screen.queryByPlaceholderText('ph')).toBeNull()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('renders em-dash placeholder when disabled with empty value', () => {
    render(<SoapTextarea value="" onChange={vi.fn()} placeholder="ph" rows={3} disabled />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
