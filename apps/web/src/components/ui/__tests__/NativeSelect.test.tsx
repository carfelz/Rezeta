import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NativeSelect } from '../NativeSelect'

describe('NativeSelect', () => {
  it('renders a select element', () => {
    render(
      <NativeSelect data-testid="sel">
        <option value="a">A</option>
      </NativeSelect>,
    )
    expect(screen.getByTestId('sel').tagName).toBe('SELECT')
  })

  it('renders children options', () => {
    render(
      <NativeSelect>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('reflects controlled value', () => {
    render(
      <NativeSelect value="b" onChange={() => {}}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>,
    )
    const el = screen.getByRole('combobox')
    expect((el as HTMLSelectElement).value).toBe('b')
  })

  it('fires onChange', () => {
    const onChange = vi.fn()
    render(
      <NativeSelect onChange={onChange}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>,
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('applies disabled state', () => {
    render(
      <NativeSelect disabled>
        <option value="a">Alpha</option>
      </NativeSelect>,
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('applies error styling', () => {
    render(
      <NativeSelect error data-testid="sel">
        <option value="a">Alpha</option>
      </NativeSelect>,
    )
    expect(screen.getByTestId('sel')).toHaveClass('border-danger-solid')
  })

  it('applies extra className', () => {
    render(
      <NativeSelect className="my-class" data-testid="sel">
        <option value="a">A</option>
      </NativeSelect>,
    )
    expect(screen.getByTestId('sel')).toHaveClass('my-class')
  })
})
