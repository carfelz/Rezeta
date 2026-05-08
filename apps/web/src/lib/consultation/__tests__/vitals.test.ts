import { describe, it, expect } from 'vitest'
import {
  toNum,
  vitalsToLocal,
  localToVitals,
  computeBMI,
  EMPTY_LOCAL_VITALS,
  type LocalVitals,
} from '../vitals'

describe('toNum', () => {
  it('parses numeric strings', () => {
    expect(toNum('42')).toBe(42)
    expect(toNum('98.6')).toBe(98.6)
  })

  it('returns undefined for empty or non-numeric', () => {
    expect(toNum('')).toBeUndefined()
    expect(toNum('abc')).toBeUndefined()
  })
})

describe('vitalsToLocal', () => {
  it('returns empty strings for null vitals', () => {
    expect(vitalsToLocal(null)).toEqual(EMPTY_LOCAL_VITALS)
  })

  it('maps Vitals fields to local strings', () => {
    const result = vitalsToLocal({
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      heartRate: 70,
      temperatureCelsius: 37.0,
      oxygenSaturation: 98,
      weightKg: 70,
      heightCm: 170,
      respiratoryRate: 14,
    })
    expect(result.bpSys).toBe('120')
    expect(result.bpDia).toBe('80')
    expect(result.hr).toBe('70')
    expect(result.weight).toBe('70')
  })
})

describe('localToVitals', () => {
  it('only includes fields with parseable numeric values', () => {
    const local: LocalVitals = {
      bpSys: '120',
      bpDia: '',
      hr: '70',
      temp: 'abc',
      spo2: '',
      weight: '',
      height: '',
      resp: '',
    }
    expect(localToVitals(local)).toEqual({
      bloodPressureSystolic: 120,
      heartRate: 70,
    })
  })
})

describe('computeBMI', () => {
  it('returns "—" when weight or height is missing', () => {
    expect(computeBMI(EMPTY_LOCAL_VITALS)).toBe('—')
    expect(computeBMI({ ...EMPTY_LOCAL_VITALS, weight: '70' })).toBe('—')
  })

  it('computes BMI to 1 decimal', () => {
    const v = { ...EMPTY_LOCAL_VITALS, weight: '70', height: '170' }
    expect(computeBMI(v)).toBe('24.2')
  })
})
