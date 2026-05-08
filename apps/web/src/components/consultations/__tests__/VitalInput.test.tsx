import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VitalInput } from '../VitalInput'

describe('VitalInput', () => {
  it('renders label, value, and unit', () => {
    render(<VitalInput label="HR" value="70" onChange={vi.fn()} unit="lpm" />)
    expect(screen.getByText('HR')).toBeInTheDocument()
    expect(screen.getByDisplayValue('70')).toBeInTheDocument()
    expect(screen.getByText('lpm')).toBeInTheDocument()
  })

  it('calls onChange when input changes', () => {
    const onChange = vi.fn()
    render(<VitalInput label="HR" value="" onChange={onChange} unit="lpm" />)
    const input = screen.getByDisplayValue('')
    fireEvent.change(input, { target: { value: '80' } })
    expect(onChange).toHaveBeenCalledWith('80')
  })

  it('respects readOnly', () => {
    render(<VitalInput label="HR" value="70" onChange={vi.fn()} unit="lpm" readOnly />)
    const input = screen.getByDisplayValue('70')
    expect(input.readOnly).toBe(true)
  })

  it('respects disabled', () => {
    render(<VitalInput label="HR" value="" onChange={vi.fn()} unit="lpm" disabled />)
    const input = screen.getByDisplayValue('')
    expect(input.disabled).toBe(true)
  })
})
