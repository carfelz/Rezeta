import type { Vitals } from '@rezeta/shared'

/**
 * Local string-based representation of vitals used while editing
 * (numeric inputs work better with strings than nullable numbers).
 */
export interface LocalVitals {
  bpSys: string
  bpDia: string
  hr: string
  temp: string
  spo2: string
  weight: string
  height: string
  resp: string
}

export function toNum(s: string): number | undefined {
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

export function vitalsToLocal(v: Vitals | null): LocalVitals {
  return {
    bpSys: v?.bloodPressureSystolic?.toString() ?? '',
    bpDia: v?.bloodPressureDiastolic?.toString() ?? '',
    hr: v?.heartRate?.toString() ?? '',
    temp: v?.temperatureCelsius?.toString() ?? '',
    spo2: v?.oxygenSaturation?.toString() ?? '',
    weight: v?.weightKg?.toString() ?? '',
    height: v?.heightCm?.toString() ?? '',
    resp: v?.respiratoryRate?.toString() ?? '',
  }
}

export function localToVitals(v: LocalVitals): Vitals {
  const raw: Record<string, number | undefined> = {
    bloodPressureSystolic: toNum(v.bpSys),
    bloodPressureDiastolic: toNum(v.bpDia),
    heartRate: toNum(v.hr),
    temperatureCelsius: toNum(v.temp),
    oxygenSaturation: toNum(v.spo2),
    weightKg: toNum(v.weight),
    heightCm: toNum(v.height),
    respiratoryRate: toNum(v.resp),
  }
  return Object.fromEntries(Object.entries(raw).filter(([, val]) => val !== undefined)) as Vitals
}

export function computeBMI(v: LocalVitals): string {
  const w = toNum(v.weight)
  const h = toNum(v.height)
  if (!w || !h) return '—'
  const bmi = w / Math.pow(h / 100, 2)
  return bmi.toFixed(1)
}

export const EMPTY_LOCAL_VITALS: LocalVitals = {
  bpSys: '',
  bpDia: '',
  hr: '',
  temp: '',
  spo2: '',
  weight: '',
  height: '',
  resp: '',
}
