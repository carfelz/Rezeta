import { describe, it, expect } from 'vitest'
import { PdfService } from '../pdf.service.js'
import type { HistoriaMedicaPdfData } from '../pdf.service.js'

const data: HistoriaMedicaPdfData = {
  record: {
    kind: 'evolution',
    status: 'signed',
    versionNumber: 1,
    generatedAt: '2026-07-06T10:42:00Z',
    signedAt: '2026-07-06T11:00:00Z',
    sections: [
      {
        key: 'ficha_identificacion',
        title: 'Ficha de identificación',
        content: 'María Peña · 54 años',
        source: 'generated',
        required: false,
      },
      {
        key: 'motivo_consulta',
        title: 'Motivo de consulta',
        content: 'Control de HTA.',
        source: 'generated',
        required: true,
      },
      {
        key: 'plan_tratamiento',
        title: 'Plan de tratamiento',
        content: 'Losartán 100 mg VO cada 24 h — 30 días',
        source: 'edited',
        required: true,
      },
    ],
  },
  doctor: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
  patient: {
    firstName: 'María',
    lastName: 'Peña',
    dateOfBirth: '1972-03-15',
    documentNumber: '001-1234567-8',
    documentType: 'cedula',
  },
  location: { name: 'Centro Médico Naco', address: 'Av. Tiradentes 45' },
  startedAt: '2026-07-06T10:42:00Z',
}

describe('generateHistoriaMedica', () => {
  it('renders a non-empty pdf buffer', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateHistoriaMedica(data)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders a draft watermark variant without throwing', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateHistoriaMedica({
      ...data,
      record: { ...data.record, status: 'draft', signedAt: null },
    })
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('renders without doctor identity, location, or document id', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateHistoriaMedica({
      ...data,
      doctor: { fullName: null, specialty: null, licenseNumber: null },
      location: null,
      patient: { ...data.patient, dateOfBirth: null, documentNumber: null, documentType: null },
      record: { ...data.record, signedAt: null },
    })
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('renders a first_visit kind and skips blank sections', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateHistoriaMedica({
      ...data,
      record: {
        ...data.record,
        kind: 'first_visit',
        sections: [
          ...data.record.sections,
          { key: 'evolucion', title: 'Evolución', content: '   ', source: 'generated', required: false },
        ],
      },
    })
    expect(buffer.length).toBeGreaterThan(1000)
  })
})
