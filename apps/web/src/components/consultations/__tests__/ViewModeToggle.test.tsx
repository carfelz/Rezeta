import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ViewModeToggle } from '../ViewModeToggle'

describe('ViewModeToggle', () => {
  it('renders both mode buttons', () => {
    render(<ViewModeToggle value="soap" onChange={vi.fn()} />)
    expect(screen.getByText('SOAP')).toBeInTheDocument()
    expect(screen.getByText('Protocolo')).toBeInTheDocument()
  })

  it('marks soap button as pressed when value is soap', () => {
    render(<ViewModeToggle value="soap" onChange={vi.fn()} />)
    expect(screen.getByText('SOAP').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Protocolo').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks canvas button as pressed when value is canvas', () => {
    render(<ViewModeToggle value="canvas" onChange={vi.fn()} />)
    expect(screen.getByText('SOAP').closest('button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Protocolo').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange with soap when SOAP clicked', () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="canvas" onChange={onChange} />)
    fireEvent.click(screen.getByText('SOAP'))
    expect(onChange).toHaveBeenCalledWith('soap')
  })

  it('calls onChange with canvas when Protocolo clicked', () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="soap" onChange={onChange} />)
    fireEvent.click(screen.getByText('Protocolo'))
    expect(onChange).toHaveBeenCalledWith('canvas')
  })

  it('applies active style to soap when selected', () => {
    render(<ViewModeToggle value="soap" onChange={vi.fn()} />)
    const soapBtn = screen.getByText('SOAP').closest('button')
    expect(soapBtn?.className).toContain('bg-n-0')
  })

  it('applies active style to canvas when selected', () => {
    render(<ViewModeToggle value="canvas" onChange={vi.fn()} />)
    const canvasBtn = screen.getByText('Protocolo').closest('button')
    expect(canvasBtn?.className).toContain('bg-n-0')
  })
})
