import { describe, it, expect } from 'vitest'
import { formatDoctorName } from '../names'

describe('formatDoctorName', () => {
  it('returns Doctor(a) for null', () => {
    expect(formatDoctorName(null)).toBe('Doctor(a)')
  })

  it('returns Doctor(a) for undefined', () => {
    expect(formatDoctorName(undefined)).toBe('Doctor(a)')
  })

  it('returns Doctor(a) for empty string', () => {
    expect(formatDoctorName('')).toBe('Doctor(a)')
  })

  it('returns Doctor(a) for whitespace-only', () => {
    expect(formatDoctorName('   ')).toBe('Doctor(a)')
  })

  it('prefixes a bare name with Dr.', () => {
    expect(formatDoctorName('María González')).toBe('Dr. María González')
  })

  it('does not double the prefix when input starts with "Dr. "', () => {
    expect(formatDoctorName('Dr. Carlos Feliz')).toBe('Dr. Carlos Feliz')
  })

  it('does not double the prefix when input starts with "Dr "', () => {
    expect(formatDoctorName('Dr Carlos Feliz')).toBe('Dr. Carlos Feliz')
  })

  it('strips a leading "Dra." honorific', () => {
    expect(formatDoctorName('Dra. Ana Reyes')).toBe('Dr. Ana Reyes')
  })

  it('strips a leading "Doctora" honorific', () => {
    expect(formatDoctorName('Doctora Ana')).toBe('Dr. Ana')
  })

  it('strips a leading "Doctor" honorific', () => {
    expect(formatDoctorName('Doctor Carlos')).toBe('Dr. Carlos')
  })

  it('handles case variations of the honorific', () => {
    expect(formatDoctorName('dr. Carlos')).toBe('Dr. Carlos')
    expect(formatDoctorName('DRA. Ana')).toBe('Dr. Ana')
  })

  it('returns Doctor(a) when input is only an honorific', () => {
    expect(formatDoctorName('Dr. ')).toBe('Doctor(a)')
  })
})
