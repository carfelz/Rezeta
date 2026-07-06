import { describe, it, expect } from 'vitest'
import { UpdateRecordSectionsSchema } from '../consultation-record.js'

describe('UpdateRecordSectionsSchema', () => {
  it('accepts a valid section edit', () => {
    const result = UpdateRecordSectionsSchema.safeParse({
      sections: [{ key: 'motivo_consulta', content: 'Control de HTA.' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown section key', () => {
    const result = UpdateRecordSectionsSchema.safeParse({
      sections: [{ key: 'notas_libres', content: 'x' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty sections array', () => {
    const result = UpdateRecordSectionsSchema.safeParse({ sections: [] })
    expect(result.success).toBe(false)
  })

  it('rejects content over 20000 chars', () => {
    const result = UpdateRecordSectionsSchema.safeParse({
      sections: [{ key: 'evolucion', content: 'x'.repeat(20_001) }],
    })
    expect(result.success).toBe(false)
  })
})
