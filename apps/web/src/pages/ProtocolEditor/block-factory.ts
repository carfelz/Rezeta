import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

export const PALETTE_ITEMS = [
  { type: 'text', icon: 'ph-text-align-left', label: 'Texto', active: true },
  { type: 'section', icon: 'ph-heading', label: 'Sección', active: true },
  { type: 'checklist', icon: 'ph-list-checks', label: 'Checklist', active: true },
  { type: 'dosage_table', icon: 'ph-table', label: 'Tabla de dosis', active: true },
  { type: 'decision', icon: 'ph-tree-structure', label: 'Árbol de decisión', active: true },
  { type: 'alert', icon: 'ph-warning-octagon', label: 'Alerta clínica', active: true },
  { type: 'steps', icon: 'ph-list-numbers', label: 'Pasos', active: true },
  { type: 'imaging_order', icon: 'ph-scan', label: 'Orden de imagen', active: true },
  { type: 'lab_order', icon: 'ph-test-tube', label: 'Orden de laboratorio', active: true },
] as const

function makeid(): string {
  return `blk_${crypto.randomUUID().slice(0, 8)}`
}

export function makeBlock(type: string): ProtocolBlock | null {
  if (type === 'text') return { id: makeid(), type: 'text', content: '' }
  if (type === 'alert') return { id: makeid(), type: 'alert', severity: 'info', content: '' }
  if (type === 'checklist') {
    return {
      id: makeid(),
      type: 'checklist',
      items: [{ id: `itm_${crypto.randomUUID().slice(0, 8)}`, text: '' }],
    }
  }
  if (type === 'steps') {
    return {
      id: makeid(),
      type: 'steps',
      steps: [{ id: `stp_${crypto.randomUUID().slice(0, 8)}`, order: 1, title: '' }],
    }
  }
  if (type === 'decision') {
    return {
      id: makeid(),
      type: 'decision',
      condition: '',
      branches: [
        { id: `brn_${crypto.randomUUID().slice(0, 8)}`, label: 'Sí', action: '' },
        { id: `brn_${crypto.randomUUID().slice(0, 8)}`, label: 'No', action: '' },
      ],
    }
  }
  if (type === 'dosage_table') {
    return {
      id: makeid(),
      type: 'dosage_table',
      columns: ['drug', 'dose', 'route', 'frequency', 'notes'],
      rows: [
        {
          id: `row_${crypto.randomUUID().slice(0, 8)}`,
          drug: '',
          dose: '',
          route: '',
          frequency: '',
          notes: '',
        },
      ],
    }
  }
  if (type === 'imaging_order') {
    return {
      id: makeid(),
      type: 'imaging_order',
      orders: [
        {
          id: `img_${crypto.randomUUID().slice(0, 8)}`,
          study_type: '',
          indication: '',
          urgency: 'routine' as const,
          contrast: false,
          fasting_required: false,
        },
      ],
    }
  }
  if (type === 'lab_order') {
    return {
      id: makeid(),
      type: 'lab_order',
      orders: [
        {
          id: `lab_${crypto.randomUUID().slice(0, 8)}`,
          test_name: '',
          indication: '',
          urgency: 'routine' as const,
          fasting_required: false,
          sample_type: 'blood' as const,
        },
      ],
    }
  }
  return null
}

export function makeSectionBlock(): ProtocolBlock {
  return {
    id: `sec_${crypto.randomUUID().slice(0, 8)}`,
    type: 'section',
    title: '',
    blocks: [],
  }
}
