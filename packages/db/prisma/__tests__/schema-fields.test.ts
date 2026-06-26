// packages/db/prisma/__tests__/schema-fields.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const schema = readFileSync(join(__dirname, '../schema.prisma'), 'utf-8')

describe('Consultation model', () => {
  it('has open as default status', () => {
    expect(schema).toContain('"open"')
  })
  it('has doctor_id instead of user_id', () => {
    expect(schema).toMatch(/doctorId\s+String\s+@map\("doctor_id"\)/)
  })
  it('has started_at instead of consulted_at', () => {
    expect(schema).toMatch(/startedAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("started_at"\)/)
  })
  it('does not have chief_complaint column', () => {
    expect(schema).not.toContain('chief_complaint')
  })
  it('does not have subjective column', () => {
    expect(schema).not.toContain('"subjective"')
  })
  it('does not have vitals Json on Consultation', () => {
    const consultationBlock = schema.match(/model Consultation \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(consultationBlock).not.toContain('vitals')
  })
})

describe('ProtocolCategory model', () => {
  it('exists in schema', () => {
    expect(schema).toContain('model ProtocolCategory')
  })
  it('does NOT declare a full @@unique on (tenantId, name)', () => {
    // Uniqueness among live rows is enforced by a partial unique index (raw SQL),
    // so soft-deleted rows do not block reuse. A full @@unique would reintroduce the bug.
    const block = schema.match(/model ProtocolCategory \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).not.toContain('@@unique([tenantId, name])')
  })
  it('has color field', () => {
    expect(schema).toMatch(/color\s+String/)
  })
})

describe('Partial unique indexes for soft-deletable models', () => {
  const migration = readFileSync(
    join(__dirname, '../migrations/20260626000000_partial_unique_soft_delete/migration.sql'),
    'utf-8',
  )

  it('schema drops full uniques that would block reuse after soft-delete', () => {
    const invoice = schema.match(/model Invoice \{[\s\S]*?\n\}/)?.[0] ?? ''
    const version = schema.match(/model ProtocolVersion \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(invoice).not.toContain('@@unique([tenantId, invoiceNumber])')
    expect(invoice).not.toMatch(/consultationId\s+String\?\s+@unique/)
    expect(version).not.toContain('@@unique([protocolId, versionNumber])')
  })

  it('Consultation.invoice is a list (one-to-many) so consultationId need not be @unique', () => {
    const block = schema.match(/model Consultation \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toMatch(/invoices\s+Invoice\[\]/)
    expect(block).not.toMatch(/invoice\s+Invoice\?/)
  })

  it('migration creates each unique index with WHERE deleted_at IS NULL', () => {
    for (const idx of [
      'protocol_categories_tenant_id_name_key',
      'invoices_tenant_id_invoice_number_key',
      'invoices_consultation_id_key',
      'protocol_versions_protocol_id_version_number_key',
    ]) {
      const stmt = migration.match(
        new RegExp(`CREATE UNIQUE INDEX "${idx}"[\\s\\S]*?;`),
      )?.[0]
      expect(stmt, `missing partial index ${idx}`).toBeTruthy()
      expect(stmt).toContain('WHERE "deleted_at" IS NULL')
    }
  })
})

describe('ProtocolType removal', () => {
  it('ProtocolType model no longer exists', () => {
    expect(schema).not.toContain('model ProtocolType')
  })
})

describe('Protocol model', () => {
  it('has categoryId instead of typeId', () => {
    const block = schema.match(/model Protocol \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('categoryId')
    expect(block).not.toContain('typeId')
  })
})

describe('ImagingOrder normalization', () => {
  it('ImagingOrderItem model exists', () => {
    expect(schema).toContain('model ImagingOrderItem')
  })
  it('ImagingOrder no longer has study_type column', () => {
    const block = schema.match(/model ImagingOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).not.toContain('studyType')
    expect(block).not.toContain('study_type')
  })
  it('ImagingOrder status default is queued', () => {
    const block = schema.match(/model ImagingOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('"queued"')
  })
})

describe('LabOrder normalization', () => {
  it('LabOrderItem model exists', () => {
    expect(schema).toContain('model LabOrderItem')
  })
  it('LabOrder no longer has test_name column', () => {
    const block = schema.match(/model LabOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).not.toContain('testName')
    expect(block).not.toContain('test_name')
  })
  it('LabOrder status default is queued', () => {
    const block = schema.match(/model LabOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('"queued"')
  })
})

describe('Prescription model', () => {
  it('does not have legacy items Json field', () => {
    const block = schema.match(/model Prescription \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).not.toMatch(/items\s+Json/)
  })
  it('status default is queued', () => {
    const block = schema.match(/model Prescription \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('"queued"')
  })
  it('has doctorId instead of userId', () => {
    const block = schema.match(/model Prescription \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('doctorId')
    expect(block).not.toContain('"user_id"')
  })
})
