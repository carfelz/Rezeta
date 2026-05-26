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
  const ts = new Date().toISOString()
  const checklistItems = Object.entries(checkedState).map(([item_id, checked]) => ({
    item_id,
    checked,
    timestamp: ts,
  }))
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
    appliedAt: ts,
    modificationSummary: null,
    modifications: checklistItems.length > 0 ? { checklist_items: checklistItems } : {},
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

  it('flags required steps block when not all steps checked', () => {
    const block = {
      id: 'stp1',
      type: 'steps' as const,
      title: 'Pasos',
      steps: [
        { id: 's1', order: 1, title: 'A' },
        { id: 's2', order: 2, title: 'B' },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { s1: true })])
    expect(r.some((m) => m.id === 'protocol:u1:stp1')).toBe(true)
  })

  it('passes required steps block when all steps checked', () => {
    const block = {
      id: 'stp1',
      type: 'steps' as const,
      steps: [{ id: 's1', order: 1, title: 'A' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { s1: true })])
    expect(r).toEqual([])
  })

  it('flags required dosage_table with no rows checked', () => {
    const block = {
      id: 'dt1',
      type: 'dosage_table' as const,
      title: 'Meds',
      columns: ['drug', 'dose', 'route', 'frequency', 'notes'],
      rows: [
        { id: 'r1', drug: 'A', dose: '1', route: 'PO', frequency: 'qd', notes: '' },
        { id: 'r2', drug: 'B', dose: '2', route: 'IV', frequency: 'bid', notes: '' },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r.some((m) => m.id === 'protocol:u1:dt1')).toBe(true)
  })

  it('passes required dosage_table when at least one row checked', () => {
    const block = {
      id: 'dt1',
      type: 'dosage_table' as const,
      columns: ['drug', 'dose', 'route', 'frequency', 'notes'],
      rows: [{ id: 'r1', drug: 'A', dose: '1', route: 'PO', frequency: 'qd', notes: '' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { r1: true })])
    expect(r).toEqual([])
  })

  it('flags required imaging_order with no orders checked', () => {
    const block = {
      id: 'img1',
      type: 'imaging_order' as const,
      title: 'Imágenes',
      orders: [
        {
          id: 'o1',
          study_type: 'TAC',
          indication: 'x',
          urgency: 'routine',
          contrast: false,
          fasting_required: false,
        },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r.some((m) => m.id === 'protocol:u1:img1')).toBe(true)
  })

  it('passes required imaging_order when an order is checked', () => {
    const block = {
      id: 'img1',
      type: 'imaging_order' as const,
      orders: [
        {
          id: 'o1',
          study_type: 'TAC',
          indication: 'x',
          urgency: 'routine',
          contrast: false,
          fasting_required: false,
        },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { o1: true })])
    expect(r).toEqual([])
  })

  it('flags required lab_order with no orders checked', () => {
    const block = {
      id: 'lab1',
      type: 'lab_order' as const,
      orders: [
        {
          id: 'o1',
          test_name: 'CBC',
          indication: 'x',
          urgency: 'routine',
          fasting_required: false,
          sample_type: 'blood',
        },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r.some((m) => m.id === 'protocol:u1:lab1')).toBe(true)
  })

  it('passes required lab_order when an order is checked', () => {
    const block = {
      id: 'lab1',
      type: 'lab_order' as const,
      orders: [
        {
          id: 'o1',
          test_name: 'CBC',
          indication: 'x',
          urgency: 'routine',
          fasting_required: false,
          sample_type: 'blood',
        },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { o1: true })])
    expect(r).toEqual([])
  })

  it('unknown block type defaults to completed (passes required check)', () => {
    const block = {
      id: 'unk1',
      type: 'mystery_block',
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r).toEqual([])
  })

  it('section with all required children completed passes', () => {
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
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block], { i1: true })])
    expect(r).toEqual([])
  })

  it('section with optional non-required child skips completion check', () => {
    const block = {
      id: 'sec1',
      type: 'section' as const,
      title: 'Eval',
      blocks: [
        {
          id: 'chk1',
          type: 'checklist' as const,
          items: [{ id: 'i1', text: 'PA' }],
        },
      ],
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    expect(r).toEqual([])
  })

  it('uses fallback "Bloque {id}" label when required block has no title or condition', () => {
    const block = {
      id: 'chk_no_title',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'X' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    const entry = r.find((m) => m.id === 'protocol:u1:chk_no_title')
    expect(entry?.label).toBe('Bloque chk_no_title')
  })

  it('uses decision condition as label when no title set', () => {
    const block = {
      id: 'd1',
      type: 'decision' as const,
      condition: '¿Hay fiebre?',
      branches: [
        { id: 'b1', label: 'Sí', action: 'x' },
        { id: 'b2', label: 'No', action: 'y' },
      ],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields(okSoap, [makeUsage([block])])
    const entry = r.find((m) => m.id === 'protocol:u1:d1')
    expect(entry?.label).toBe('¿Hay fiebre?')
  })

  it('skips usages with status completed-but-not-in-progress NOT — completed is included', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      required: true,
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    usage.status = 'completed'
    const r = computeMissingRequiredFields(okSoap, [usage])
    expect(r.some((m) => m.id === 'protocol:u1:chk1')).toBe(true)
  })

  it('handles usage with null content (no blocks)', () => {
    const usage = makeUsage([])
    usage.content = null
    const r = computeMissingRequiredFields(okSoap, [usage])
    expect(r).toEqual([])
  })

  it('handles usage with empty modifications (no checklist_items)', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      required: true,
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    usage.modifications = {}
    const r = computeMissingRequiredFields(okSoap, [usage])
    expect(r.some((m) => m.id === 'protocol:u1:chk1')).toBe(true)
  })
})
