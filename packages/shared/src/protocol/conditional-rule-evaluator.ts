import type { ConditionalRule, ComparisonOp } from '../types/protocol.js'
import type { Vitals } from '../types/consultation.js'

/**
 * Snapshot of consultation state used for rule evaluation.
 * Adding new fields here expands what rules can target.
 */
export interface RuleEvaluationContext {
  vitals?: Vitals | null
  chiefComplaint?: string | null
  subjective?: string | null
  objective?: string | null
  assessment?: string | null
  plan?: string | null
}

/**
 * Resolves a dotted field path against the evaluation context.
 * Supported paths in v1:
 *   vitals.bloodPressureSystolic, vitals.bloodPressureDiastolic, vitals.heartRate,
 *   vitals.respiratoryRate, vitals.temperatureCelsius, vitals.oxygenSaturation,
 *   vitals.weightKg, vitals.heightCm, chiefComplaint, subjective, objective,
 *   assessment, plan
 * Returns undefined when the path doesn't resolve or the value is null/missing.
 */
export function resolveField(
  ctx: RuleEvaluationContext,
  path: string,
): number | string | boolean | undefined {
  const parts = path.split('.')
  let cursor: unknown = ctx
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  if (cursor == null) return undefined
  if (typeof cursor === 'number' || typeof cursor === 'string' || typeof cursor === 'boolean') {
    return cursor
  }
  return undefined
}

function compare(
  left: number | string | boolean | undefined,
  op: ComparisonOp,
  right: number | string | boolean,
): boolean {
  if (left === undefined) return false
  if (typeof left !== typeof right) return false
  switch (op) {
    case '<':
      return (left as number) < (right as number)
    case '<=':
      return (left as number) <= (right as number)
    case '>':
      return (left as number) > (right as number)
    case '>=':
      return (left as number) >= (right as number)
    case '==':
      return left === right
    case '!=':
      return left !== right
    /* v8 ignore start -- exhaustiveness check, statically unreachable */
    default: {
      const _exhaustive: never = op
      return _exhaustive
    }
    /* v8 ignore stop */
  }
}

/**
 * Evaluates a conditional rule expression tree against a context.
 * Returns true iff the rule matches. Missing fields evaluate any leaf cmp to false.
 */
export function evaluateConditionalRule(
  rule: ConditionalRule,
  ctx: RuleEvaluationContext,
): boolean {
  switch (rule.kind) {
    case 'cmp':
      return compare(resolveField(ctx, rule.field), rule.op, rule.value)
    case 'and':
      return rule.rules.every((r: ConditionalRule) => evaluateConditionalRule(r, ctx))
    case 'or':
      return rule.rules.some((r: ConditionalRule) => evaluateConditionalRule(r, ctx))
    case 'not':
      return !evaluateConditionalRule(rule.rule, ctx)
    /* v8 ignore start -- exhaustiveness check, statically unreachable */
    default: {
      const _exhaustive: never = rule
      return _exhaustive
    }
    /* v8 ignore stop */
  }
}
