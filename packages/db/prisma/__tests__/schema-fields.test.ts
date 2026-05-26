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
  it('has unique tenant+name constraint', () => {
    const block = schema.match(/model ProtocolCategory \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('@@unique([tenantId, name])')
  })
  it('has color field', () => {
    expect(schema).toMatch(/color\s+String/)
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
