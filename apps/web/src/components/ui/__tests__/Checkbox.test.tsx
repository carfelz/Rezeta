import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Checkbox } from '../Checkbox'

describe('Checkbox', () => {
  it('renders as a checkbox input', () => {
    render(<Checkbox aria-label="Accept" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('forwards checked and onChange', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} aria-label="Accept" />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalled()
  })

  it('reflects checked state', () => {
    render(<Checkbox checked readOnly aria-label="Accept" />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('tone=primary applies accent-p-500 class', () => {
    render(<Checkbox tone="primary" aria-label="Primary" />)
    expect(screen.getByRole('checkbox')).toHaveClass('accent-p-500')
  })

  it('tone=danger applies accent-danger-text class', () => {
    render(<Checkbox tone="danger" aria-label="Danger" />)
    expect(screen.getByRole('checkbox')).toHaveClass('accent-danger-text')
  })

  it('default tone is primary', () => {
    render(<Checkbox aria-label="Default" />)
    expect(screen.getByRole('checkbox')).toHaveClass('accent-p-500')
  })

  it('respects disabled prop', () => {
    render(<Checkbox disabled aria-label="Disabled" />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('forwards extra className', () => {
    render(<Checkbox className="extra-class" aria-label="Extra" />)
    expect(screen.getByRole('checkbox')).toHaveClass('extra-class')
  })
})
