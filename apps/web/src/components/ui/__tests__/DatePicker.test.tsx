import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DatePicker } from '../DatePicker'

describe('DatePicker', () => {
  it('renders placeholder when no value', () => {
    render(<DatePicker onChange={vi.fn()} placeholder="Pick a date" />)
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
})
