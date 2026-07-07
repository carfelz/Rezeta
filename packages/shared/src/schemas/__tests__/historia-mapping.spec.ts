import { describe, it, expect } from 'vitest'
import { HistoriaMappingSchema } from '../protocol.js'

describe('HistoriaMappingSchema', () => {
  it('accepts a valid mapping', () => {
    const result = HistoriaMappingSchema.safeParse({
      blk_1: { section: 'examen_fisico', label: 'Hallazgos cardiovasculares' },
      blk_2: { include: false },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown section key', () => {
    const result = HistoriaMappingSchema.safeParse({ blk_1: { section: 'notas' } })
    expect(result.success).toBe(false)
  })

  it('accepts an empty mapping object', () => {
    const result = HistoriaMappingSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects a label longer than 200 characters', () => {
    const result = HistoriaMappingSchema.safeParse({ blk_1: { label: 'x'.repeat(201) } })
    expect(result.success).toBe(false)
  })

  it('accepts an entry with only include set to true', () => {
    const result = HistoriaMappingSchema.safeParse({ blk_1: { include: true } })
    expect(result.success).toBe(true)
  })

  it('rejects ficha_identificacion as a mapping destination (system-managed, never selectable)', () => {
    const result = HistoriaMappingSchema.safeParse({ blk_1: { section: 'ficha_identificacion' } })
    expect(result.success).toBe(false)
  })

  it('rejects enmiendas as a mapping destination (system-managed, never selectable)', () => {
    const result = HistoriaMappingSchema.safeParse({ blk_1: { section: 'enmiendas' } })
    expect(result.success).toBe(false)
  })

  it('rejects plan_tratamiento as a mapping destination (populated only from signed orders)', () => {
    const result = HistoriaMappingSchema.safeParse({ blk_1: { section: 'plan_tratamiento' } })
    expect(result.success).toBe(false)
  })

  it('accepts every other section key as a valid mapping destination', () => {
    const selectable = ['motivo_consulta', 'antecedentes', 'enfermedad_actual', 'examen_fisico', 'evolucion', 'resultados_estudios', 'diagnosticos']
    for (const section of selectable) {
      expect(HistoriaMappingSchema.safeParse({ blk_1: { section } }).success).toBe(true)
    }
  })
})
