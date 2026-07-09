import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { redactForAudit } from '../redact.js'

/**
 * Guardrail: every Patient column that carries a national identifier (cédula /
 * passport / RNC) MUST be masked by the audit redactor. This is what caught the
 * `documentNumber` mismatch — the redaction rules keyed on `cedula`/`rnc` but
 * the real column is `documentNumber`, so full IDs were stored in the clear.
 *
 * If you add a new identifier column to the Patient model, add it here and to
 * `FIELD_REDACT_RULES.Patient` (redact.ts) — this test will fail until you do.
 */
const PATIENT_IDENTIFIER_COLUMNS = ['documentNumber']

const schemaPath = resolve(process.cwd(), '../../packages/db/prisma/schema.prisma')

function patientModelBlock(): string {
  const schema = readFileSync(schemaPath, 'utf8')
  const match = schema.match(/model Patient \{([\s\S]*?)\n\}/)
  if (!match) throw new Error('Patient model not found in schema.prisma')
  return match[1] ?? ''
}

describe('audit redaction coverage for Patient identifiers', () => {
  it('each curated identifier column still exists on the Patient model', () => {
    const block = patientModelBlock()
    for (const column of PATIENT_IDENTIFIER_COLUMNS) {
      expect(block, `Patient.${column} missing from schema — update the guardrail`).toContain(
        column,
      )
    }
  })

  it('redactForAudit masks every curated Patient identifier column', () => {
    for (const column of PATIENT_IDENTIFIER_COLUMNS) {
      const result = redactForAudit('Patient', { [column]: '001-1234567-8' })
      expect(result[column], `Patient.${column} is not redacted in audit rows`).toBe('**** 67-8')
    }
  })
})
