import { describe, it, expect } from 'vitest'
import { computeMissingRequiredFields } from '../src/protocol/sign-validation'
import type { ConsultationProtocolUsage, ProtocolBlock } from '../src'

const okSoap = {
  chiefComplaint: 'Cefaleas',
  assessment: 'Migraña',
  diagnoses: ['Migraña'],
}

function makeUsage(
  blocks: ProtocolBlock[],
  checkedState: Record<string, boolean> = {},
): ConsultationProtocolUsage {
  return {
    id: 'u1',
    tenantId: 't1',
    consultationId: 'c1',
    protocolId: 'p1',
    protocolVersionId: 'v1',
    protocolTitle: 'Test',
    protocolTypeName: 'Diag',
    versionNumber: 1,
    status: 'in_progress',
    depth: 0,
    parentUsageId: null,
    triggerBlockId: null,
    completedAt: null,
    notes: null,
    appliedAt: new Date().toISOString(),
    modificationSummary: null,
    checkedState,
    modifications: {},
    content: { version: '1.0', blocks },
  }
}

describe('computeMissingRequiredFields — SOAP rules', () => {
  it('returns empty when all SOAP filled and no protocols', () => {
    expect(computeMissingRequiredFields(okSoap, [])).toEqual([])
  })

  it('flags missing chiefComplaint', () => {
    const r = computeMissingRequiredFields({ ...okSoap, chiefComplaint: '' }, [])
    expect(r.some((m) => m.id === 'chiefComplaint')).toBe(true)
  })

  it('flags whitespace-only chiefComplaint', () => {
    const r = computeMissingRequiredFields({ ...okSoap, chiefComplaint: '   ' }, [])
    expect(r.some((m) => m.id === 'chiefComplaint')).toBe(true)
  })

  it('flags missing assessment', () => {
    const r = computeMissingRequiredFields({ ...okSoap, assessment: '' }, [])
    expect(r.some((m) => m.id === 'assessment')).toBe(true)
  })

  it('flags empty diagnoses array', () => {
    const r = computeMissingRequiredFields({ ...okSoap, diagnoses: [] }, [])
    expect(r.some((m) => m.id === 'diagnoses')).toBe(true)
  })
})

describe('computeMissingRequiredFields — protocol-required blocks', () => {
  it('flags an unchecked required checklist', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      title: 'Vitales',
      items: [
        { id: 'i1', text: 'PA' },
        { id: 'i2', text: 'FC' },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { i1: true })])
    expect(r.some((m) => m.id === 'protocol:u1:chk1')).toBe(true)
  })

  it('passes when all checklist items checked', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { i1: true })])
    expect(r).toEqual([])
  })

  it('flags decision block with no branch selected', () => {
    const block = {
      id: 'd1',
      type: 'decision' as const,
      condition: 'PA?',
      branches: [
        { id: 'b1', label: 'Sí', action: 'x' },
        { id: 'b2', label: 'No', action: 'y' },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r.some((m) => m.id === 'protocol:u1:d1')).toBe(true)
  })

  it('passes decision block with one branch selected', () => {
    const block = {
      id: 'd1',
      type: 'decision' as const,
      condition: 'PA?',
      branches: [
        { id: 'b1', label: 'Sí', action: 'x' },
        { id: 'b2', label: 'No', action: 'y' },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { b1: true })])
    expect(r).toEqual([])
  })

  it('skips required check on optional blocks', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r).toEqual([])
  })

  it('walks into sections to find required children', () => {
    const block = {
      id: 'sec1',
      type: 'section' as const,
      title: 'Eval',
      blocks: [
        {
          id: 'chk1',
          type: 'checklist' as const,
          items: [{ id: 'i1', text: 'PA' }],
          required: true,
        },
      ],
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r.some((m) => m.id === 'protocol:u1:chk1')).toBe(true)
  })

  it('text and alert blocks always pass', () => {
    const blocks = [
      { id: 't1', type: 'text', content: 'foo', required: true },
      { id: 'a1', type: 'alert', severity: 'info', content: 'bar', required: true },
    ] as unknown as ProtocolBlock[]
    const r = computeMissingRequiredFields(okSoap, [makeUsage(blocks)])
    expect(r).toEqual([])
  })

  it('skips usages with status switched/abandoned', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      required: true,
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    usage.status = 'switched'
    const r = computeMissingRequiredFields(okSoap, [usage])
    expect(r).toEqual([])
  })

  it('combines SOAP + protocol missing fields', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields({ ...okSoap, chiefComplaint: '' }, [makeUsage([block])])
    expect(r.length).toBe(2)
    expect(r.map((m) => m.id)).toEqual(['chiefComplaint', 'protocol:u1:chk1'])
  })
})
