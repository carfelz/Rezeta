import { describe, it, expect } from 'vitest'
import { PdfService } from '../pdf.service.js'
import type { ExpedientePdfData } from '../pdf.service.js'

const entry = {
  record: {
    kind: 'evolution' as const,
    status: 'signed' as const,
    versionNumber: 1,
    generatedAt: '2026-07-06T10:42:00Z',
    signedAt: '2026-07-06T11:00:00Z',
    sections: [
      { key: 'motivo_consulta' as const, title: 'Motivo de consulta', content: 'Control.', source: 'generated' as const, required: true },
    ],
  },
  location: { name: 'Centro Médico Naco', address: null },
  startedAt: '2026-07-06T10:42:00Z',
}

const data: ExpedientePdfData = {
  patient: { firstName: 'María', lastName: 'Peña', dateOfBirth: '1972-03-15', documentNumber: '001-1234567-8', documentType: 'cedula' },
  doctor: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
  generatedAt: '2026-07-06T12:00:00Z',
  entries: [entry, { ...entry, startedAt: '2026-05-22T09:00:00Z' }],
}

describe('generateExpediente', () => {
  it('renders a multi-consultation pdf with a cover page', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateExpediente(data)
    expect(buffer.length).toBeGreaterThan(1500)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders an empty expediente (zero entries) without throwing', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateExpediente({ ...data, entries: [] })
    expect(buffer.length).toBeGreaterThan(500)
  })
})
