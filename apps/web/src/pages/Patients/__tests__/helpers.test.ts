import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDate, formatAge, resolveDocumentType } from '../helpers'

describe('formatDate', () => {
  it('returns an em dash for a null date', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('renders a date-only string as local time, without the UTC off-by-one', () => {
    expect(formatDate('1972-03-15')).toBe('15 de marzo de 1972')
  })

  it('renders a date-only string with a time suffix the same way', () => {
    expect(formatDate('1972-03-15T00:00:00.000Z')).toBe('15 de marzo de 1972')
  })
})

describe('formatAge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an em dash for a null date of birth', () => {
    expect(formatAge(null)).toBe('—')
  })

  it('computes age for a known date of birth without a timezone off-by-one', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 7))
    expect(formatAge('1972-03-15')).toBe('54 años')
  })
})

describe('resolveDocumentType', () => {
  it('trusts a stored documentType when present', () => {
    expect(resolveDocumentType('passport', '12345')).toBe('passport')
  })

  it('infers passport from a leading letter', () => {
    expect(resolveDocumentType(undefined, 'A1234567')).toBe('passport')
  })

  it('infers rnc from a leading 4', () => {
    expect(resolveDocumentType(undefined, '401234567')).toBe('rnc')
  })

  it('infers cedula otherwise', () => {
    expect(resolveDocumentType(undefined, '00112345678')).toBe('cedula')
  })

  it('returns null when there is no document number', () => {
    expect(resolveDocumentType(undefined, undefined)).toBeNull()
  })
})
