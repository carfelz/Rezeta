import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VitalsSection } from '../VitalsSection'
import { EMPTY_LOCAL_VITALS } from '@/lib/consultation/vitals'

describe('VitalsSection', () => {
  it('renders all vital fields when not disabled', () => {
    render(<VitalsSection vitals={EMPTY_LOCAL_VITALS} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByText('Frec. cardíaca')).toBeInTheDocument()
    expect(screen.getByText('Temperatura')).toBeInTheDocument()
    expect(screen.getByText('Presión arterial')).toBeInTheDocument()
    expect(screen.getByText('IMC · calculado')).toBeInTheDocument()
  })

  it('emits onChange with new value when an input changes', () => {
    const onChange = vi.fn()
    render(<VitalsSection vitals={EMPTY_LOCAL_VITALS} onChange={onChange} disabled={false} />)
    const inputs = screen.getAllByPlaceholderText('—')
    fireEvent.change(inputs[0]!, { target: { value: '120' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bpSys: '120' }))
  })

  it('renders em-dash when disabled with empty vitals', () => {
    render(<VitalsSection vitals={EMPTY_LOCAL_VITALS} onChange={vi.fn()} disabled />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders fields disabled when disabled and has data', () => {
    render(
      <VitalsSection vitals={{ ...EMPTY_LOCAL_VITALS, hr: '70' }} onChange={vi.fn()} disabled />,
    )
    const hr = screen.getByDisplayValue<HTMLInputElement>('70')
    expect(hr.disabled).toBe(true)
  })
})
