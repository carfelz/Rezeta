import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TimePicker } from '../TimePicker'

describe('TimePicker', () => {
  it('renders placeholder when no value', () => {
    render(<TimePicker onChange={vi.fn()} placeholder="Choose time" />)
    expect(screen.getByRole('button', { name: /choose time/i })).toBeInTheDocument()
  })

  it('renders formatted value', () => {
    render(<TimePicker value="14:30" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /2:30 p\.m\./i })).toBeInTheDocument()
  })

  it('opens slot list on click and selects a slot', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <TimePicker
        value="09:00"
        onChange={onChange}
        intervalMin={30}
        minTime="09:00"
        maxTime="11:00"
      />,
    )
    await user.click(screen.getByRole('button'))
    const slot = await screen.findByRole('button', { name: /10:00 a\.m\./i })
    await user.click(slot)
    expect(onChange).toHaveBeenCalledWith('10:00')
  })

  it('honors intervalMin when generating slots', async () => {
    const user = userEvent.setup()
    render(
      <TimePicker
        onChange={vi.fn()}
        intervalMin={60}
        minTime="08:00"
        maxTime="10:00"
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(await screen.findByRole('button', { name: /8:00 a\.m\./i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /9:00 a\.m\./i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /8:30 a\.m\./i })).not.toBeInTheDocument()
  })
})
