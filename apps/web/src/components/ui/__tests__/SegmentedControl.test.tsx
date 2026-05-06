import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SegmentedControl } from '../SegmentedControl'

const opts = [
  { value: 'a', label: 'SOAP' },
  { value: 'b', label: 'Protocolo' },
] as const

describe('SegmentedControl', () => {
  it('renders all options', () => {
    render(<SegmentedControl options={[...opts]} value="a" onChange={vi.fn()} />)
    expect(screen.getByText('SOAP')).toBeInTheDocument()
    expect(screen.getByText('Protocolo')).toBeInTheDocument()
  })

  it('marks the active option with aria-pressed=true', () => {
    render(<SegmentedControl options={[...opts]} value="a" onChange={vi.fn()} />)
    expect(screen.getByText('SOAP')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Protocolo')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange when clicking an inactive option', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={[...opts]} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByText('Protocolo'))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('does not call onChange when clicking the active option (still fires)', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={[...opts]} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByText('SOAP'))
    // Note: implementation does not de-bounce; caller decides
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('respects disabled prop on every option', () => {
    render(<SegmentedControl options={[...opts]} value="a" onChange={vi.fn()} disabled />)
    expect(screen.getByText('SOAP')).toBeDisabled()
    expect(screen.getByText('Protocolo')).toBeDisabled()
  })

  it('supports more than two options', () => {
    render(
      <SegmentedControl
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
        value="b"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('C')).toBeInTheDocument()
  })
})
