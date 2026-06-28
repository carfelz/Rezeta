import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DatePicker } from '../DatePicker'

describe('DatePicker', () => {
  it('renders placeholder when no value', () => {
    render(<DatePicker onChange={vi.fn()} placeholder="Pick a date" />)
    expect(screen.getByRole('button', { name: /pick a date/i })).toBeInTheDocument()
  })

  it('falls back to the default placeholder when none is provided', () => {
    render(<DatePicker onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /seleccionar fecha/i })).toBeInTheDocument()
  })

  it('treats an unparseable value as no selection', () => {
    render(<DatePicker value="not-a-date" onChange={vi.fn()} placeholder="Pick a date" />)
    expect(screen.getByRole('button', { name: /pick a date/i })).toBeInTheDocument()
  })

  it('renders the selected date in display format', () => {
    render(<DatePicker value="2026-06-17" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /17 de junio de 2026/i })).toBeInTheDocument()
  })

  it('opens the calendar when clicked', async () => {
    const user = userEvent.setup()
    render(<DatePicker value="2026-06-17" onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /17 de junio de 2026/i }))
    expect(await screen.findByRole('grid')).toBeInTheDocument()
  })

  it('selecting a day calls onChange with an ISO date and closes the popover', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker value="2026-06-17" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /17 de junio de 2026/i }))
    const grid = await screen.findByRole('grid')
    const day = within(grid)
      .getAllByRole('button')
      .find((b) => !b.hasAttribute('disabled') && b.getAttribute('aria-disabled') !== 'true')
    await user.click(day as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('disables dates outside the minDate/maxDate range', async () => {
    const user = userEvent.setup()
    render(
      <DatePicker
        value="2026-06-17"
        onChange={vi.fn()}
        minDate={new Date(2026, 5, 10)}
        maxDate={new Date(2026, 5, 20)}
      />,
    )
    await user.click(screen.getByRole('button', { name: /17 de junio de 2026/i }))
    const grid = await screen.findByRole('grid')
    const hasDisabledDay = within(grid)
      .getAllByRole('button')
      .some((b) => b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true')
    expect(hasDisabledDay).toBe(true)
  })

  it('renders disabled and error states', () => {
    render(<DatePicker onChange={vi.fn()} disabled error className="extra-class" />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
