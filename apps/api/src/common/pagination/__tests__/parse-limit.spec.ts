import { describe, it, expect } from 'vitest'
import { parseLimit } from '../parse-limit.js'

describe('parseLimit', () => {
  it('returns the fallback when the value is absent', () => {
    expect(parseLimit(undefined)).toBe(50)
    expect(parseLimit(undefined, { fallback: 20 })).toBe(20)
  })

  it('returns the fallback for unparseable input', () => {
    expect(parseLimit('abc')).toBe(50)
    expect(parseLimit('')).toBe(50)
  })

  it('parses a valid numeric string', () => {
    expect(parseLimit('25')).toBe(25)
  })

  it('clamps to the max (DoS protection)', () => {
    expect(parseLimit('100000000')).toBe(100)
    expect(parseLimit('500', { max: 200 })).toBe(200)
  })

  it('clamps to the min', () => {
    expect(parseLimit('0')).toBe(1)
    expect(parseLimit('-5')).toBe(1)
  })

  it('accepts a number directly and truncates fractions', () => {
    expect(parseLimit(30)).toBe(30)
    expect(parseLimit(30.9)).toBe(30)
  })

  it('treats Infinity as unparseable and falls back', () => {
    expect(parseLimit(Infinity)).toBe(50)
  })
})
