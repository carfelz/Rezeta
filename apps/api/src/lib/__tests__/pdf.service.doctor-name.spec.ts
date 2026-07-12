import { describe, it, expect } from 'vitest'
import { formatDoctorName } from '../pdf.service.js'

// Every PDF (prescription, imaging/lab order, historia, expediente) prints the
// treating doctor's name. The templates used to hard-prepend "Dr. ", so a doctor
// whose fullName already carried an honorific — common, since doctors type
// "Dr. Juan García" / "Dra. María Pérez" at signup — rendered as "Dr. Dr. …".
describe('formatDoctorName', () => {
  it('prepends "Dr. " to a bare name', () => {
    expect(formatDoctorName('Test García')).toBe('Dr. Test García')
  })

  it('does not double an existing "Dr." honorific', () => {
    expect(formatDoctorName('Dr. Test García')).toBe('Dr. Test García')
  })

  it('preserves a "Dra." honorific instead of forcing "Dr."', () => {
    expect(formatDoctorName('Dra. María Pérez')).toBe('Dra. María Pérez')
  })

  it('detects the honorific case-insensitively and without the period', () => {
    expect(formatDoctorName('DR. JUAN')).toBe('DR. JUAN')
    expect(formatDoctorName('dra maría')).toBe('dra maría')
  })

  it('does not false-positive on a name that merely starts with "Dr"', () => {
    expect(formatDoctorName('Drew Barrymore')).toBe('Dr. Drew Barrymore')
    expect(formatDoctorName('Drake Smith')).toBe('Dr. Drake Smith')
  })

  it('trims surrounding whitespace before deciding', () => {
    expect(formatDoctorName('  Dr. Ana  ')).toBe('Dr. Ana')
    expect(formatDoctorName('  Ana  ')).toBe('Dr. Ana')
  })

  it('falls back to "Médico" (no bare "Dr.") when the name is missing', () => {
    expect(formatDoctorName(null)).toBe('Médico')
    expect(formatDoctorName(undefined)).toBe('Médico')
    expect(formatDoctorName('   ')).toBe('Médico')
  })
})
