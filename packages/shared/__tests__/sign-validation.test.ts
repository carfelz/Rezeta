import { describe, it, expect } from 'vitest'
import { computeMissingRequiredFields } from '../src/protocol/sign-validation.js'
import type { ConsultationProtocolUsage, ProtocolBlock, MissingRequiredField } from '../src/index.js'

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
    updatedAt: ts,
    modificationSummary: null,
    modifications: checklistItems.length > 0 ? { checklist_items: checklistItems } : {},
    content: { version: '1.0', blocks },
  }
}

describe('computeMissingRequiredFields — protocol-required blocks', () => {
  it('returns empty when no protocols', () => {
    expect(computeMissingRequiredFields([])).toEqual([])
  })

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
    const r = computeMissingRequiredFields([makeUsage([block], { i1: true })])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:chk1')).toBe(true)
  })

  it('passes when all checklist items checked', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block], { i1: true })])
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
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:d1')).toBe(true)
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
    const r = computeMissingRequiredFields([makeUsage([block], { b1: true })])
    expect(r).toEqual([])
  })

  it('skips required check on optional blocks', () => {
    const block = {
      id: 'chk1',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block])])
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
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:chk1')).toBe(true)
  })

  it('text and alert blocks always pass', () => {
    const blocks = [
      { id: 't1', type: 'text', content: 'foo', required: true },
      { id: 'a1', type: 'alert', severity: 'info', content: 'bar', required: true },
    ] as unknown as ProtocolBlock[]
    const r = computeMissingRequiredFields([makeUsage(blocks)])
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
    const r = computeMissingRequiredFields([usage])
    expect(r).toEqual([])
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
    const r = computeMissingRequiredFields([makeUsage([block], { s1: true })])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:stp1')).toBe(true)
  })

  it('passes required steps block when all steps checked', () => {
    const block = {
      id: 'stp1',
      type: 'steps' as const,
      steps: [{ id: 's1', order: 1, title: 'A' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block], { s1: true })])
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
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:dt1')).toBe(true)
  })

  it('passes required dosage_table when at least one row checked', () => {
    const block = {
      id: 'dt1',
      type: 'dosage_table' as const,
      columns: ['drug', 'dose', 'route', 'frequency', 'notes'],
      rows: [{ id: 'r1', drug: 'A', dose: '1', route: 'PO', frequency: 'qd', notes: '' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block], { r1: true })])
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
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:img1')).toBe(true)
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
    const r = computeMissingRequiredFields([makeUsage([block], { o1: true })])
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
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:lab1')).toBe(true)
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
    const r = computeMissingRequiredFields([makeUsage([block], { o1: true })])
    expect(r).toEqual([])
  })

  it('unknown block type defaults to completed (passes required check)', () => {
    const block = {
      id: 'unk1',
      type: 'mystery_block',
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block])])
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
    const r = computeMissingRequiredFields([makeUsage([block], { i1: true })])
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
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r).toEqual([])
  })

  it('uses fallback "Bloque {id}" label when required block has no title or condition', () => {
    const block = {
      id: 'chk_no_title',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'X' }],
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block])])
    const entry = r.find((m: MissingRequiredField) => m.id === 'protocol:u1:chk_no_title')
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
    const r = computeMissingRequiredFields([makeUsage([block])])
    const entry = r.find((m: MissingRequiredField) => m.id === 'protocol:u1:d1')
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
    const r = computeMissingRequiredFields([usage])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:chk1')).toBe(true)
  })

  it('handles usage with null content (no blocks)', () => {
    const usage = makeUsage([])
    usage.content = null as unknown as ConsultationProtocolUsage['content']
    const r = computeMissingRequiredFields([usage])
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
    const r = computeMissingRequiredFields([usage])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:chk1')).toBe(true)
  })

  it('vitals block is incomplete when no values entered', () => {
    const block = {
      id: 'blk1',
      type: 'vitals' as const,
      fields: [],
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toContain('blk1')
  })

  it('vitals block is complete when at least one value entered', () => {
    const block = {
      id: 'blk1',
      type: 'vitals' as const,
      fields: [],
      values: { bp: '120/80' },
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(0)
  })

  it('clinical_notes block is incomplete when content is empty', () => {
    const block = {
      id: 'blk2',
      type: 'clinical_notes' as const,
      label: 'Nota',
      content: '',
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toContain('blk2')
  })

  it('clinical_notes block is complete when content is non-empty', () => {
    const block = {
      id: 'blk2',
      type: 'clinical_notes' as const,
      label: 'Nota',
      content: 'Paciente refiere dolor',
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(0)
  })

  it('decision block with undefined branches defaults to empty array (incomplete)', () => {
    const block = {
      id: 'd2',
      type: 'decision' as const,
      condition: '¿Dolor?',
      branches: undefined,
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:d2')).toBe(true)
  })

  it('dosage_table with undefined rows defaults to empty array (incomplete)', () => {
    const block = {
      id: 'dt2',
      type: 'dosage_table' as const,
      columns: [],
      rows: undefined,
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:dt2')).toBe(true)
  })

  it('imaging_order with undefined orders defaults to empty array (incomplete)', () => {
    const block = {
      id: 'img2',
      type: 'imaging_order' as const,
      orders: undefined,
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:img2')).toBe(true)
  })

  it('lab_order with undefined orders defaults to empty array (incomplete)', () => {
    const block = {
      id: 'lab2',
      type: 'lab_order' as const,
      orders: undefined,
      required: true,
    } as unknown as ProtocolBlock
    const r = computeMissingRequiredFields([makeUsage([block])])
    expect(r.some((m: MissingRequiredField) => m.id === 'protocol:u1:lab2')).toBe(true)
  })

  it('vitals block is incomplete when all present values are empty strings', () => {
    const block = {
      id: 'blk5',
      type: 'vitals' as const,
      fields: [],
      values: { weight: '', height: '' },
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toContain('blk5')
  })

  it('vitals block is complete when at least one value is non-empty after trimming', () => {
    const block = {
      id: 'blk6',
      type: 'vitals' as const,
      fields: [],
      values: { weight: '', height: '  ', temp: '36.5' },
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(0)
  })

  it('vitals block with undefined values defaults to empty object (incomplete)', () => {
    const block = {
      id: 'blk3',
      type: 'vitals' as const,
      fields: [],
      values: undefined,
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toContain('blk3')
  })

  it('clinical_notes block with undefined content defaults to empty string (incomplete)', () => {
    const block = {
      id: 'blk4',
      type: 'clinical_notes' as const,
      label: 'Nota',
      content: undefined,
      required: true,
    } as unknown as ProtocolBlock
    const result = computeMissingRequiredFields([makeUsage([block])])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toContain('blk4')
  })
})
