import { describe, it, expect } from 'vitest'
import { getStarterFixtures } from '../index.js'

describe('starter fixtures (2 templates)', () => {
  for (const locale of ['es', 'en'] as const) {
    it(`${locale}: has exactly 2 fixtures each naming a category`, () => {
      const fixtures = getStarterFixtures(locale)
      expect(fixtures).toHaveLength(2)
      for (const f of fixtures) {
        expect(typeof f.categoryName).toBe('string')
        expect(f.categoryName.length).toBeGreaterThan(0)
      }
    })
  }

  it('es maps emergency->Emergencias, diagnostic->Diagnóstico', () => {
    const byKey = Object.fromEntries(getStarterFixtures('es').map((f) => [f.key, f.categoryName]))
    expect(byKey.emergency).toBe('Emergencias')
    expect(byKey.diagnostic).toBe('Diagnóstico')
  })

  it('en maps emergency->Emergencies, diagnostic->Diagnosis', () => {
    const byKey = Object.fromEntries(getStarterFixtures('en').map((f) => [f.key, f.categoryName]))
    expect(byKey.emergency).toBe('Emergencies')
    expect(byKey.diagnostic).toBe('Diagnosis')
  })

  it('es fixtures have non-empty names and schemas', () => {
    const fixtures = getStarterFixtures('es')
    for (const f of fixtures) {
      expect(f.name.length).toBeGreaterThan(0)
      expect(f.key.length).toBeGreaterThan(0)
      expect(f.schema).toBeDefined()
    }
  })

  it('en fixtures have non-empty names and schemas', () => {
    const fixtures = getStarterFixtures('en')
    for (const f of fixtures) {
      expect(f.name.length).toBeGreaterThan(0)
      expect(f.key.length).toBeGreaterThan(0)
      expect(f.schema).toBeDefined()
    }
  })
})
