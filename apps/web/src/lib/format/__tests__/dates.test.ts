import { describe, it, expect } from 'vitest'
import {
  formatDateLong,
  formatBreadcrumbDate,
  formatConsultationOverline,
  formatDateNumeric,
  formatRelativeMinutes,
  formatTimeShort,
  parseDateOnly,
} from '../dates'

describe('formatTimeShort coverage of all branches', () => {
  it('formats AM time', () => {
    expect(formatTimeShort(new Date(2026, 4, 7, 8, 5))).toBe('8:05 A.M.')
  })

  it('formats single-digit minutes', () => {
    expect(formatTimeShort(new Date(2026, 4, 7, 14, 9))).toBe('2:09 P.M.')
  })

  it('handles midnight (12 AM)', () => {
    expect(formatTimeShort(new Date(2026, 4, 7, 0, 0))).toBe('12:00 A.M.')
  })

  it('handles noon (12 PM)', () => {
    expect(formatTimeShort(new Date(2026, 4, 7, 12, 0))).toBe('12:00 P.M.')
  })
})

const D = new Date(2026, 4, 7, 14, 40) // 7 May 2026 14:40 (Thursday)

describe('formatDateLong', () => {
  it('formats lowercase Spanish long date', () => {
    expect(formatDateLong(D)).toBe('jueves, 7 de mayo de 2026')
  })
})

describe('formatBreadcrumbDate', () => {
  it('formats short Spanish month with year', () => {
    expect(formatBreadcrumbDate(D)).toBe('7 may de 2026')
  })
})

describe('formatConsultationOverline', () => {
  it('uppercases day, month, location and joins with bullets', () => {
    expect(formatConsultationOverline(D, 'Consultorio Privado')).toBe(
      'JUEVES, 7 DE MAYO DE 2026 · 2:40 P.M. · CONSULTORIO PRIVADO',
    )
  })

  it('omits location separator when name is empty', () => {
    expect(formatConsultationOverline(D, '')).toBe('JUEVES, 7 DE MAYO DE 2026 · 2:40 P.M.')
  })

  it('formats AM hours', () => {
    const morning = new Date(2026, 4, 7, 2, 40)
    expect(formatConsultationOverline(morning, '')).toContain('2:40 A.M.')
  })

  it('handles midnight (12 AM)', () => {
    const midnight = new Date(2026, 4, 7, 0, 0)
    expect(formatConsultationOverline(midnight, '')).toContain('12:00 A.M.')
  })

  it('handles noon (12 PM)', () => {
    const noon = new Date(2026, 4, 7, 12, 0)
    expect(formatConsultationOverline(noon, '')).toContain('12:00 P.M.')
  })
})

describe('formatTimeShort', () => {
  it('returns 12-hour Spanish time', () => {
    expect(formatTimeShort(D)).toBe('2:40 P.M.')
  })
})

describe('formatDateNumeric', () => {
  it('pads single-digit day and month with leading zeros', () => {
    expect(formatDateNumeric(new Date(2026, 4, 7))).toBe('07/05/2026')
  })

  it('preserves two-digit day and month', () => {
    expect(formatDateNumeric(new Date(2026, 11, 25))).toBe('25/12/2026')
  })
})

describe('parseDateOnly', () => {
  it('parses a date-only string as local midnight, not UTC midnight', () => {
    const parsed = parseDateOnly('1972-03-15')
    expect(parsed.getFullYear()).toBe(1972)
    expect(parsed.getMonth()).toBe(2)
    expect(parsed.getDate()).toBe(15)
  })

  it('ignores a time suffix and still parses the date part as local midnight', () => {
    const parsed = parseDateOnly('1972-03-15T00:00:00.000Z')
    expect(parsed.getFullYear()).toBe(1972)
    expect(parsed.getMonth()).toBe(2)
    expect(parsed.getDate()).toBe(15)
  })

  it('round-trips through formatDateLong without an off-by-one day', () => {
    expect(formatDateLong(parseDateOnly('1972-03-15'))).toBe('miércoles, 15 de marzo de 1972')
  })
})

describe('formatRelativeMinutes', () => {
  it('formats minutes when under an hour', () => {
    expect(formatRelativeMinutes(35)).toMatch(/35 minutos/)
  })

  it('formats hours when under a day', () => {
    expect(formatRelativeMinutes(120)).toMatch(/2 horas/)
  })

  it('formats days for multi-day spans (audit case: 4226 min ≈ 3 días)', () => {
    expect(formatRelativeMinutes(4226)).toMatch(/3 días/)
  })

  it('rounds large hour spans up to days', () => {
    expect(formatRelativeMinutes(60 * 24)).toMatch(/(1 día|ayer)/)
  })

  it('clamps negative values to zero', () => {
    // Intl.RelativeTimeFormat with numeric:auto renders 0 minutes as "este minuto" in es-DO.
    expect(formatRelativeMinutes(-5)).toMatch(/(este minuto|0 minutos|ahora)/)
  })
})
