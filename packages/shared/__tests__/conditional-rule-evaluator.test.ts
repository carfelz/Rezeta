import { describe, it, expect } from 'vitest'
import { evaluateConditionalRule, resolveField } from '../src/protocol/conditional-rule-evaluator.js'
import type { ConditionalRule } from '../src/types/protocol.js'
import type { Vitals } from '../src/types/consultation.js'

const vitals: Vitals = {
  bloodPressureSystolic: 165,
  bloodPressureDiastolic: 95,
  heartRate: 78,
  respiratoryRate: 16,
  temperatureCelsius: 36.8,
  oxygenSaturation: 98,
  weightKg: 74.2,
  heightCm: 168,
}

describe('resolveField', () => {
  it('resolves nested vitals path', () => {
    expect(resolveField({ vitals }, 'vitals.bloodPressureSystolic')).toBe(165)
  })

  it('resolves top-level string path', () => {
    expect(resolveField({ chiefComplaint: 'Cefalea' }, 'chiefComplaint')).toBe('Cefalea')
  })

  it('returns undefined for missing path', () => {
    expect(resolveField({ vitals }, 'vitals.nonExistent')).toBeUndefined()
  })

  it('returns undefined when intermediate is null', () => {
    expect(resolveField({ vitals: null }, 'vitals.heartRate')).toBeUndefined()
  })

  it('returns undefined when context value is undefined', () => {
    expect(resolveField({}, 'vitals.bloodPressureSystolic')).toBeUndefined()
  })

  it('returns undefined for non-primitive nested values', () => {
    expect(resolveField({ vitals }, 'vitals')).toBeUndefined()
  })
})

describe('evaluateConditionalRule', () => {
  describe('cmp', () => {
    it('matches >= when value exceeds threshold', () => {
      const rule: ConditionalRule = {
        kind: 'cmp',
        field: 'vitals.bloodPressureSystolic',
        op: '>=',
        value: 160,
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(true)
    })

    it('does not match >= when value below threshold', () => {
      const rule: ConditionalRule = {
        kind: 'cmp',
        field: 'vitals.heartRate',
        op: '>=',
        value: 100,
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(false)
    })

    it('returns false when field missing', () => {
      const rule: ConditionalRule = {
        kind: 'cmp',
        field: 'vitals.bloodPressureSystolic',
        op: '>=',
        value: 160,
      }
      expect(evaluateConditionalRule(rule, {})).toBe(false)
    })

    it('returns false on type mismatch (number vs string)', () => {
      const rule: ConditionalRule = {
        kind: 'cmp',
        field: 'vitals.heartRate',
        op: '==',
        value: '78' as unknown as number,
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(false)
    })

    it.each([
      ['<', 100, true],
      ['<=', 78, true],
      ['>', 78, false],
      ['>=', 78, true],
      ['==', 78, true],
      ['!=', 78, false],
    ] as const)('op %s with right=%s evaluates to %s', (op, right, expected) => {
      const rule: ConditionalRule = {
        kind: 'cmp',
        field: 'vitals.heartRate',
        op,
        value: right,
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(expected)
    })
  })

  describe('and', () => {
    it('matches when all sub-rules match', () => {
      const rule: ConditionalRule = {
        kind: 'and',
        rules: [
          { kind: 'cmp', field: 'vitals.bloodPressureSystolic', op: '>=', value: 160 },
          { kind: 'cmp', field: 'vitals.bloodPressureDiastolic', op: '>=', value: 90 },
        ],
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(true)
    })

    it('does not match if any sub-rule fails', () => {
      const rule: ConditionalRule = {
        kind: 'and',
        rules: [
          { kind: 'cmp', field: 'vitals.bloodPressureSystolic', op: '>=', value: 160 },
          { kind: 'cmp', field: 'vitals.heartRate', op: '>=', value: 100 },
        ],
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(false)
    })
  })

  describe('or', () => {
    it('matches if any sub-rule matches', () => {
      const rule: ConditionalRule = {
        kind: 'or',
        rules: [
          { kind: 'cmp', field: 'vitals.heartRate', op: '>=', value: 100 },
          { kind: 'cmp', field: 'vitals.bloodPressureSystolic', op: '>=', value: 160 },
        ],
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(true)
    })

    it('does not match if all sub-rules fail', () => {
      const rule: ConditionalRule = {
        kind: 'or',
        rules: [
          { kind: 'cmp', field: 'vitals.heartRate', op: '>=', value: 100 },
          { kind: 'cmp', field: 'vitals.bloodPressureSystolic', op: '>=', value: 200 },
        ],
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(false)
    })
  })

  describe('not', () => {
    it('inverts the inner rule', () => {
      const rule: ConditionalRule = {
        kind: 'not',
        rule: { kind: 'cmp', field: 'vitals.heartRate', op: '>=', value: 100 },
      }
      expect(evaluateConditionalRule(rule, { vitals })).toBe(true)
    })
  })

  describe('nested expressions', () => {
    it('evaluates (BP >= 160 AND HR > 100) OR T >= 39', () => {
      const rule: ConditionalRule = {
        kind: 'or',
        rules: [
          {
            kind: 'and',
            rules: [
              { kind: 'cmp', field: 'vitals.bloodPressureSystolic', op: '>=', value: 160 },
              { kind: 'cmp', field: 'vitals.heartRate', op: '>', value: 100 },
            ],
          },
          { kind: 'cmp', field: 'vitals.temperatureCelsius', op: '>=', value: 39 },
        ],
      }
      // Mock vitals: BP 165 (yes), HR 78 (no), T 36.8 (no) → AND fails, OR fails → false
      expect(evaluateConditionalRule(rule, { vitals })).toBe(false)
    })
  })
})
