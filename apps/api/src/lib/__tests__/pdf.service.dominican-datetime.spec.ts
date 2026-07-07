import { describe, it, expect } from 'vitest'
import { formatDominicanDateTime } from '../pdf.service.js'

describe('formatDominicanDateTime', () => {
  it('renders a UTC instant in America/Santo_Domingo (AST, UTC-4) regardless of server timezone', () => {
    // 2026-07-06T14:42:00Z is 10:42 in Santo Domingo (UTC-4, no DST).
    const { date, hour } = formatDominicanDateTime('2026-07-06T14:42:00.000Z')
    expect(date).toBe('6 de julio de 2026')
    expect(hour).toBe('10:42')
  })

  it('rolls the calendar date backwards across the UTC day boundary', () => {
    // 2026-07-06T02:30:00Z is still 2026-07-05 22:30 AST — a case that a
    // server-local (non-timezone-aware) formatter would get wrong whenever
    // the host process isn't itself running in AST.
    const { date, hour } = formatDominicanDateTime('2026-07-06T02:30:00.000Z')
    expect(date).toBe('5 de julio de 2026')
    expect(hour).toBe('22:30')
  })

  it('pads single-digit hour and minute values to two digits (24h clock)', () => {
    // 2026-01-15T05:07:00Z is 01:07 AST.
    const { hour } = formatDominicanDateTime('2026-01-15T05:07:00.000Z')
    expect(hour).toBe('01:07')
  })
})
