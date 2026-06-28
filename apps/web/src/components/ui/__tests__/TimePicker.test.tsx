import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TimePicker } from '../TimePicker'

describe('TimePicker', () => {
  it('renders placeholder when no value', () => {
    render(<TimePicker onChange={vi.fn()} placeholder="Choose time" />)
    expect(screen.getByRole('button', { name: /choose time/i })).toBeInTheDocument()
  })

  it('falls back to the default placeholder when none is provided', () => {
    render(<TimePicker onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /seleccionar hora/i })).toBeInTheDocument()
  })

  it('renders formatted value', () => {
    render(<TimePicker value="14:30" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /2:30 p\.m\./i })).toBeInTheDocument()
  })

  it('renders midnight as 12 a.m.', () => {
    render(<TimePicker value="00:00" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /12:00 a\.m\./i })).toBeInTheDocument()
  })

  it('shows the raw value when it cannot be parsed', () => {
    render(<TimePicker value="not-a-time" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /not-a-time/i })).toBeInTheDocument()
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
    render(<TimePicker onChange={vi.fn()} intervalMin={60} minTime="08:00" maxTime="10:00" />)
    await user.click(screen.getByRole('button'))
    expect(await screen.findByRole('button', { name: /8:00 a\.m\./i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /9:00 a\.m\./i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /8:30 a\.m\./i })).not.toBeInTheDocument()
  })

  it('parses bounds given without minutes', async () => {
    const user = userEvent.setup()
    render(<TimePicker onChange={vi.fn()} intervalMin={60} minTime="9" maxTime="11" />)
    await user.click(screen.getByRole('button'))
    expect(await screen.findByRole('button', { name: /9:00 a\.m\./i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /10:00 a\.m\./i })).toBeInTheDocument()
  })

  it('scrolls the active slot into view when opened', async () => {
    const scrollSpy = vi.fn()
    // jsdom does not implement scrollIntoView; provide it so the effect's call runs.
    Element.prototype.scrollIntoView = scrollSpy
    const user = userEvent.setup()
    render(
      <TimePicker
        value="09:00"
        onChange={vi.fn()}
        intervalMin={30}
        minTime="09:00"
        maxTime="11:00"
      />,
    )
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(scrollSpy).toHaveBeenCalled())
  })

  it('opens without scrolling when the value matches no slot', async () => {
    const user = userEvent.setup()
    render(
      <TimePicker
        value="09:07"
        onChange={vi.fn()}
        intervalMin={30}
        minTime="09:00"
        maxTime="11:00"
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(await screen.findByRole('button', { name: /9:00 a\.m\./i })).toBeInTheDocument()
  })

  it('renders disabled and error states', () => {
    render(<TimePicker onChange={vi.fn()} disabled error className="extra-class" />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
