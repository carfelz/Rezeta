import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationRecordsService } from '../consultation-records.service.js'
import type { ConsultationRecordsRepository } from '../consultation-records.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../../common/audit-log/audit-context.store.js'
import type { ConsultationRecordDto, RecordSection } from '@rezeta/shared'

const now = new Date('2026-07-06T10:42:00Z')

function makeSections(overrides: Partial<RecordSection>[] = []): RecordSection[] {
  const base: RecordSection[] = [
    { key: 'ficha_identificacion', title: 'Ficha de identificación', content: 'María Peña', source: 'generated', required: false },
    { key: 'motivo_consulta', title: 'Motivo de consulta', content: 'Control.', source: 'generated', required: true },
    { key: 'examen_fisico', title: 'Examen físico', content: 'PA 148/92 mmHg', source: 'generated', required: true },
    { key: 'evolucion', title: 'Evolución', content: 'Estable.', source: 'generated', required: true },
    { key: 'diagnosticos', title: 'Diagnósticos', content: 'HTA.', source: 'generated', required: true },
    { key: 'plan_tratamiento', title: 'Plan de tratamiento', content: 'Losartán 100 mg VO cada 24 h — 30 días', source: 'generated', required: true },
  ]
  for (const o of overrides) {
    const target = base.find((s) => s.key === o.key)
    if (target) Object.assign(target, o)
  }
  return base
}

function makeRecord(overrides: Partial<ConsultationRecordDto> = {}): ConsultationRecordDto {
  return {
    id: 'rec1',
    consultationId: 'c1',
    patientId: 'p1',
    versionNumber: 1,
    kind: 'evolution',
    status: 'draft',
    sections: makeSections(),
    generatedAt: now.toISOString(),
    signedAt: null,
    signedBy: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  }
}

function makeConsultationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    tenantId: 't1',
    patientId: 'p1',
    doctorId: 'u1',
    status: 'signed',
    startedAt: now,
    signedAt: now,
    patient: {
      firstName: 'María',
      lastName: 'Peña',
      dateOfBirth: new Date('1972-03-15'),
      sex: 'female',
      documentType: 'cedula',
      documentNumber: '001-1234567-8',
      phone: null,
      address: null,
      allergies: ['penicilina'],
      chronicConditions: [],
    },
    protocolUsages: [
      {
        content: {
          blocks: [
            { id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: 'Control de HTA.' },
          ],
        },
        modifications: {},
      },
    ],
    prescriptions: [
      {
        prescriptionItems: [
          { drug: 'Losartán', dose: '100 mg', route: 'VO', frequency: 'cada 24 h', duration: '30 días' },
        ],
      },
    ],
    labOrders: [{ items: [{ testName: 'Creatinina' }] }],
    imagingOrders: [{ items: [{ studyType: 'Rx de tórax' }] }],
    amendments: [],
    ...overrides,
  }
}

const mockRepo = {
  findLatest: vi.fn(),
  create: vi.fn(),
  replaceSections: vi.fn(),
  sign: vi.fn(),
}

const mockPrisma = {
  consultation: { findFirst: vi.fn(), count: vi.fn() },
  patient: { findFirst: vi.fn() },
  consultationRecord: { findMany: vi.fn() },
}

const mockAudit = { record: vi.fn().mockResolvedValue(undefined) }

const svc = new ConsultationRecordsService(
  mockRepo as unknown as ConsultationRecordsRepository,
  mockPrisma as unknown as PrismaService,
  mockAudit as unknown as AuditLogService,
)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getLatest', () => {
  it('throws RECORD_NOT_FOUND when no record exists', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    await expect(svc.getLatest('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_NOT_FOUND' },
    })
  })
})

describe('ensureDraft', () => {
  it('returns the existing record without creating another', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    const result = await svc.ensureDraft('c1', 't1')
    expect(result.id).toBe('rec1')
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('rejects when the consultation is not signed', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow({ status: 'open', signedAt: null }))
    await expect(svc.ensureDraft('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_CONSULTATION_NOT_SIGNED' },
    })
  })

  it('creates v1 with kind=first_visit when no earlier signed consultation exists', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(0)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ kind: data.kind })))
    const result = await svc.ensureDraft('c1', 't1')
    expect(result.kind).toBe('first_visit')
    const created = mockRepo.create.mock.calls[0][0]
    expect(created.versionNumber).toBe(1)
    expect(created.sections.some((s: RecordSection) => s.key === 'motivo_consulta' && s.content === 'Control de HTA.')).toBe(true)
    expect(created.sections.some((s: RecordSection) => s.key === 'plan_tratamiento' && s.content.includes('Losartán'))).toBe(true)
  })

  it('creates kind=evolution when an earlier signed consultation exists', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(2)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ kind: data.kind })))
    const result = await svc.ensureDraft('c1', 't1')
    expect(result.kind).toBe('evolution')
    expect(mockPrisma.consultation.count).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        patientId: 'p1',
        status: { in: ['signed', 'amended'] },
        signedAt: { lt: now },
        id: { not: 'c1' },
        deletedAt: null,
      },
    })
  })
})

describe('regenerate', () => {
  it('delegates to ensureDraft when no record exists yet', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(0)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ kind: data.kind })))
    const result = await svc.regenerate('c1', 't1')
    expect(result.kind).toBe('first_visit')
    expect(mockRepo.create).toHaveBeenCalled()
  })

  it('rebuilds the draft in place (same version)', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(1)
    mockRepo.replaceSections.mockResolvedValue(makeRecord())
    await svc.regenerate('c1', 't1')
    expect(mockRepo.replaceSections).toHaveBeenCalled()
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('rejects with RECORD_NOT_DRAFT when the draft race-loses to a concurrent sign', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(1)
    mockRepo.replaceSections.mockResolvedValue(null)
    await expect(svc.regenerate('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_NOT_DRAFT' },
    })
  })

  it('creates the next version when latest is signed and consultation was amended', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed', versionNumber: 1 }))
    mockPrisma.consultation.findFirst.mockResolvedValue(
      makeConsultationRow({
        status: 'amended',
        amendments: [{ reason: 'Dosis corregida', amendedAt: now }],
      }),
    )
    mockPrisma.consultation.count.mockResolvedValue(1)
    mockRepo.create.mockImplementation((data) =>
      Promise.resolve(makeRecord({ versionNumber: data.versionNumber })),
    )
    const result = await svc.regenerate('c1', 't1')
    expect(result.versionNumber).toBe(2)
    const created = mockRepo.create.mock.calls[0][0]
    expect(created.sections.some((s: RecordSection) => s.key === 'enmiendas')).toBe(true)
  })

  it('rejects when latest is signed and there is no amendment', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed' }))
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    await expect(svc.regenerate('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_ALREADY_SIGNED' },
    })
  })
})

describe('updateSections', () => {
  it('merges edited content and flags source=edited', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockRepo.replaceSections.mockImplementation((_id, _t, sections) =>
      Promise.resolve(makeRecord({ sections })),
    )
    const result = await svc.updateSections('c1', 't1', {
      sections: [{ key: 'diagnosticos', content: 'HTA descontrolada.' }],
    })
    const dx = result.sections.find((s) => s.key === 'diagnosticos')
    expect(dx?.content).toBe('HTA descontrolada.')
    expect(dx?.source).toBe('edited')
    const untouched = result.sections.find((s) => s.key === 'motivo_consulta')
    expect(untouched?.source).toBe('generated')
  })

  it('rejects edits to ficha_identificacion', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    await expect(
      svc.updateSections('c1', 't1', { sections: [{ key: 'ficha_identificacion', content: 'x' }] }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } })
  })

  it('rejects when the latest record is signed', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed' }))
    await expect(
      svc.updateSections('c1', 't1', { sections: [{ key: 'evolucion', content: 'x' }] }),
    ).rejects.toMatchObject({ response: { code: 'RECORD_NOT_DRAFT' } })
  })

  it('rejects with RECORD_NOT_DRAFT when the draft race-loses to a concurrent sign', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockRepo.replaceSections.mockResolvedValue(null)
    await expect(
      svc.updateSections('c1', 't1', { sections: [{ key: 'evolucion', content: 'x' }] }),
    ).rejects.toMatchObject({ response: { code: 'RECORD_NOT_DRAFT' } })
  })
})

describe('sign', () => {
  it('rejects when a required section is empty', async () => {
    mockRepo.findLatest.mockResolvedValue(
      makeRecord({ sections: makeSections([{ key: 'diagnosticos', content: '' }]) }),
    )
    await expect(svc.sign('c1', 't1', 'u1')).rejects.toMatchObject({
      response: { code: 'RECORD_REQUIRED_SECTIONS_MISSING', details: { missing: ['diagnosticos'] } },
    })
    expect(mockRepo.sign).not.toHaveBeenCalled()
  })

  it('signs a complete draft and audits it', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockRepo.sign.mockResolvedValue(makeRecord({ status: 'signed', signedBy: 'u1' }))
    const result = await svc.sign('c1', 't1', 'u1')
    expect(result.status).toBe('signed')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'ConsultationRecord', action: 'update' }),
    )
  })

  it('attributes the audit entry to the HTTP actor when a request context is active', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockRepo.sign.mockResolvedValue(makeRecord({ status: 'signed', signedBy: 'u1' }))
    await httpAuditContextStore.run({ tenantId: 't1', actorUserId: 'u1' }, () => svc.sign('c1', 't1', 'u1'))
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'user', actorUserId: 'u1' }),
    )
  })

  it('rejects when already signed', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed' }))
    await expect(svc.sign('c1', 't1', 'u1')).rejects.toMatchObject({
      response: { code: 'RECORD_ALREADY_SIGNED' },
    })
  })

  it('rejects with RECORD_ALREADY_SIGNED when the draft race-loses to a concurrent sign', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockRepo.sign.mockResolvedValue(null)
    await expect(svc.sign('c1', 't1', 'u1')).rejects.toMatchObject({
      response: { code: 'RECORD_ALREADY_SIGNED' },
    })
  })
})

describe('getPdfData', () => {
  it('throws RECORD_NOT_FOUND when no record exists', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    await expect(svc.getPdfData('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_NOT_FOUND' },
    })
  })

  it('throws CONSULTATION_NOT_FOUND when the consultation row is missing', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockPrisma.consultation.findFirst.mockResolvedValue(null)
    await expect(svc.getPdfData('c1', 't1')).rejects.toMatchObject({
      response: { code: 'CONSULTATION_NOT_FOUND' },
    })
  })

  it('assembles doctor, patient, and location data for the pdf', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockPrisma.consultation.findFirst.mockResolvedValue({
      ...makeConsultationRow(),
      doctor: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
      location: { name: 'Centro Médico Naco', address: 'Av. Tiradentes 45' },
    })
    const result = await svc.getPdfData('c1', 't1')
    expect(result.record.id).toBe('rec1')
    expect(result.doctor).toEqual({
      fullName: 'Ana Herrera',
      specialty: 'Cardiología',
      licenseNumber: '145-23',
    })
    expect(result.patient).toEqual({
      firstName: 'María',
      lastName: 'Peña',
      dateOfBirth: new Date('1972-03-15').toISOString(),
      documentNumber: '001-1234567-8',
      documentType: 'cedula',
    })
    expect(result.location).toEqual({ name: 'Centro Médico Naco', address: 'Av. Tiradentes 45' })
    expect(result.startedAt).toBe(now.toISOString())
  })

  it('defaults location to null and dateOfBirth to null when absent', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockPrisma.consultation.findFirst.mockResolvedValue({
      ...makeConsultationRow(),
      doctor: { fullName: null, specialty: null, licenseNumber: null },
      location: null,
      patient: { ...makeConsultationRow().patient, dateOfBirth: null },
    })
    const result = await svc.getPdfData('c1', 't1')
    expect(result.location).toBeNull()
    expect(result.patient.dateOfBirth).toBeNull()
  })
})

describe('buildGenerationInput (via ensureDraft)', () => {
  it('passes historia_mapping from usage content into the generator', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(
      makeConsultationRow({
        protocolUsages: [
          {
            content: {
              blocks: [{ id: 'b1', type: 'clinical_notes', label: 'Notas', content: 'Dirigido.' }],
              historia_mapping: { b1: { section: 'examen_fisico' } },
            },
            modifications: {},
          },
        ],
      }),
    )
    mockPrisma.consultation.count.mockResolvedValue(1)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ sections: data.sections })))
    const result = await svc.ensureDraft('c1', 't1')
    const examen = result.sections.find((s) => s.key === 'examen_fisico')
    expect(examen?.content).toContain('Dirigido.')
  })

  it('throws CONSULTATION_NOT_FOUND when the consultation row does not exist', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(null)
    await expect(svc.ensureDraft('c1', 't1')).rejects.toMatchObject({
      response: { code: 'CONSULTATION_NOT_FOUND' },
    })
  })

  it('falls back to now() for signedAt and defaults null/empty patient fields', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(
      makeConsultationRow({
        signedAt: null,
        patient: {
          firstName: 'Juan',
          lastName: 'Pérez',
          dateOfBirth: null,
          sex: null,
          documentType: null,
          documentNumber: null,
          phone: null,
          address: null,
          allergies: null,
          chronicConditions: null,
        },
        protocolUsages: [{ content: null, modifications: null }],
      }),
    )
    mockPrisma.consultation.count.mockResolvedValue(0)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ kind: data.kind })))
    const result = await svc.ensureDraft('c1', 't1')
    expect(result.kind).toBe('first_visit')
    expect(mockPrisma.consultation.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ signedAt: { lt: expect.any(Date) } }) }),
    )
  })
})

describe('getExpedienteData', () => {
  it('collects signed records newest-first with their consultation context', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'p1',
      firstName: 'María',
      lastName: 'Peña',
      dateOfBirth: new Date('1972-03-15'),
      documentType: 'cedula',
      documentNumber: '001-1234567-8',
      owner: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
    })
    mockPrisma.consultationRecord.findMany.mockResolvedValue([
      {
        ...makeRecordRowForExport('rec2', '2026-07-06T10:42:00Z'),
        consultation: { startedAt: new Date('2026-07-06T10:42:00Z'), location: { name: 'Naco', address: null } },
      },
      {
        ...makeRecordRowForExport('rec1', '2026-05-22T09:00:00Z'),
        consultation: { startedAt: new Date('2026-05-22T09:00:00Z'), location: { name: 'Naco', address: null } },
      },
    ])
    const data = await svc.getExpedienteData('p1', 't1')
    expect(mockPrisma.consultationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', patientId: 'p1', status: 'signed', deletedAt: null }),
      }),
    )
    expect(data.entries).toHaveLength(2)
    expect(data.patient.firstName).toBe('María')
    expect(data.doctor.fullName).toBe('Ana Herrera')
    expect(data.entries[0].startedAt).toBe('2026-07-06T10:42:00.000Z')
    expect(data.entries[1].startedAt).toBe('2026-05-22T09:00:00.000Z')
    expect(data.entries[0].location).toEqual({ name: 'Naco', address: null })
  })

  it('keeps only the latest version per consultation', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'p1',
      firstName: 'María',
      lastName: 'Peña',
      dateOfBirth: new Date('1972-03-15'),
      documentType: 'cedula',
      documentNumber: '001-1234567-8',
      owner: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
    })
    mockPrisma.consultationRecord.findMany.mockResolvedValue([
      {
        ...makeRecordRowForExport('rec2-v2', '2026-07-06T10:42:00Z'),
        consultationId: 'c-rec2',
        versionNumber: 2,
        consultation: { startedAt: new Date('2026-07-06T10:42:00Z'), location: null },
      },
      {
        ...makeRecordRowForExport('rec2-v1', '2026-07-01T10:00:00Z'),
        consultationId: 'c-rec2',
        versionNumber: 1,
        consultation: { startedAt: new Date('2026-07-01T10:00:00Z'), location: null },
      },
    ])
    const data = await svc.getExpedienteData('p1', 't1')
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].record.versionNumber).toBe(2)
    expect(data.entries[0].location).toBeNull()
  })

  it('defaults dateOfBirth and signedAt to null when absent', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'p1',
      firstName: 'Juan',
      lastName: 'Pérez',
      dateOfBirth: null,
      documentType: null,
      documentNumber: null,
      owner: { fullName: null, specialty: null, licenseNumber: null },
    })
    mockPrisma.consultationRecord.findMany.mockResolvedValue([
      {
        ...makeRecordRowForExport('rec1', '2026-07-06T10:42:00Z'),
        signedAt: null,
        consultation: { startedAt: new Date('2026-07-06T10:42:00Z'), location: null },
      },
    ])
    const data = await svc.getExpedienteData('p1', 't1')
    expect(data.patient.dateOfBirth).toBeNull()
    expect(data.entries[0].record.signedAt).toBeNull()
    expect(data.entries[0].location).toBeNull()
  })

  it('throws PATIENT_NOT_FOUND for a missing patient', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null)
    await expect(svc.getExpedienteData('p1', 't1')).rejects.toMatchObject({
      response: { code: 'PATIENT_NOT_FOUND' },
    })
  })
})

function makeRecordRowForExport(id: string, signedAt: string) {
  return {
    id,
    consultationId: 'c-' + id,
    patientId: 'p1',
    versionNumber: 1,
    kind: 'evolution',
    status: 'signed',
    sections: [],
    generatedAt: new Date(signedAt),
    signedAt: new Date(signedAt),
    signedBy: 'u1',
    createdAt: new Date(signedAt),
    updatedAt: new Date(signedAt),
    deletedAt: null,
  }
}
