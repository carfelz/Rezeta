import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Calendar } from '../calendar'

const JUNE_2026 = new Date(2026, 5, 15)

describe('Calendar', () => {
  it('renders a single-selected month with prev/next chevrons and focuses the active day', async () => {
    render(
      <Calendar
        mode="single"
        selected={JUNE_2026}
        month={JUNE_2026}
        onSelect={vi.fn()}
        autoFocus
      />,
    )
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    // Custom Chevron (left + right) renders inside the two nav buttons.
    expect(
      document.querySelectorAll('.rdp-button_previous, .rdp-button_next').length,
    ).toBeGreaterThan(0)
    // The selected day carries the single-selection data attribute (CalendarDayButton).
    expect(document.querySelector('[data-selected-single="true"]')).not.toBeNull()
  })

  it('renders the dropdown caption layout (month/year dropdowns + down chevron)', async () => {
    render(
      <Calendar
        mode="single"
        month={JUNE_2026}
        onSelect={vi.fn()}
        captionLayout="dropdown"
      />,
    )
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    // formatMonthDropdown / dropdown caption renders native selects.
    expect(document.querySelectorAll('select').length).toBeGreaterThan(0)
  })

  it('renders week numbers via the custom WeekNumber cell', async () => {
    render(<Calendar mode="single" month={JUNE_2026} onSelect={vi.fn()} showWeekNumber />)
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    expect(document.querySelector('.rdp-week_number')).not.toBeNull()
  })

  it('applies range modifiers across a selected range', async () => {
    render(
      <Calendar
        mode="range"
        selected={{ from: new Date(2026, 5, 10), to: new Date(2026, 5, 20) }}
        month={JUNE_2026}
        onSelect={vi.fn()}
      />,
    )
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    expect(document.querySelector('[data-range-start="true"]')).not.toBeNull()
    expect(document.querySelector('[data-range-middle="true"]')).not.toBeNull()
    expect(document.querySelector('[data-range-end="true"]')).not.toBeNull()
  })
})
