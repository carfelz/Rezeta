/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatientsController } from '../patients.controller.js'
import type { PatientsService } from '../patients.service.js'
import type { ConsultationRecordsService } from '../../consultation-records/consultation-records.service.js'
import type { PdfService, ExpedientePdfData } from '../../../lib/pdf.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../../common/audit-log/audit-context.store.js'
import type { Patient } from '@rezeta/db'
import type { AuthUser } from '@rezeta/shared'

const mockUser: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'doc@test.com',
  role: 'owner',
}
const tenantId = 'tenant-1'

function makePatient(id = 'p1'): Patient {
  return {
    id,
    tenantId,
    ownerUserId: 'user-1',
    firstName: 'Ana',
    lastName: 'Reyes',
    dateOfBirth: null,
    sex: null,
    documentType: null,
    documentNumber: null,
    phone: null,
    email: null,
    allergies: null,
    medicalHistory: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  }
}

describe('PatientsController', () => {
  let controller: PatientsController
  let service: PatientsService

  let recordsSvc: ConsultationRecordsService
  let pdf: PdfService
  let auditLog: AuditLogService

  beforeEach(() => {
    service = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    } as unknown as PatientsService
    recordsSvc = {
      getExpedienteData: vi.fn(),
    } as unknown as ConsultationRecordsService
    pdf = {
      generateExpediente: vi.fn(),
    } as unknown as PdfService
    auditLog = {
      record: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService
    controller = new PatientsController(service, recordsSvc, pdf, auditLog)
  })

  it('list delegates to service with a clamped default limit', async () => {
    vi.mocked(service.list).mockResolvedValue({ items: [makePatient()], hasMore: false })
    const result = await controller.list(tenantId, mockUser)
    expect(service.list).toHaveBeenCalledWith({ tenantId, ownerId: 'user-1', limit: 50 })
    expect(result.items).toHaveLength(1)
  })

  it('list clamps an oversized limit to the max (DoS protection)', async () => {
    vi.mocked(service.list).mockResolvedValue({ items: [], hasMore: false })
    await controller.list(tenantId, mockUser, undefined, undefined, '100000000')
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })

  it('list passes search, cursor, and limit when provided', async () => {
    vi.mocked(service.list).mockResolvedValue({ items: [], hasMore: false })
    await controller.list(tenantId, mockUser, 'Ana', 'cursor123', '25')
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Ana', cursor: 'cursor123', limit: 25 }),
    )
  })

  it('getOne delegates to service', async () => {
    vi.mocked(service.getById).mockResolvedValue(makePatient())
    const result = await controller.getOne('p1', tenantId)
    expect(service.getById).toHaveBeenCalledWith('p1', tenantId)
    expect(result.id).toBe('p1')
  })

  it('create delegates to service', async () => {
    vi.mocked(service.create).mockResolvedValue(makePatient())
    const dto = { firstName: 'Ana', lastName: 'Reyes' }
    await controller.create(dto as never, tenantId, mockUser)
    expect(service.create).toHaveBeenCalledWith(tenantId, 'user-1', dto)
  })

  it('update delegates to service', async () => {
    vi.mocked(service.update).mockResolvedValue(makePatient())
    const dto = { phone: '+1-809-555-1234' }
    await controller.update('p1', dto as never, tenantId)
    expect(service.update).toHaveBeenCalledWith('p1', tenantId, dto)
  })

  it('remove delegates to service', async () => {
    vi.mocked(service.remove).mockResolvedValue(undefined)
    await controller.remove('p1', tenantId)
    expect(service.remove).toHaveBeenCalledWith('p1', tenantId)
  })

  it('recordExport streams the generated expediente pdf buffer', async () => {
    const pdfData = { patient: { firstName: 'Ana' } } as unknown as ExpedientePdfData
    const buffer = Buffer.from('%PDF-1.4 fake')
    vi.mocked(recordsSvc.getExpedienteData).mockResolvedValue(pdfData)
    vi.mocked(pdf.generateExpediente).mockResolvedValue(buffer)
    const res = { set: vi.fn(), end: vi.fn() }

    await controller.recordExport(tenantId, 'p1', res as never)

    expect(recordsSvc.getExpedienteData).toHaveBeenCalledWith('p1', tenantId)
    expect(pdf.generateExpediente).toHaveBeenCalledWith(pdfData)
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="expediente-p1.pdf"',
      }),
    )
    expect(res.end).toHaveBeenCalledWith(buffer)
  })

  it('recordExport records a non-fatal audit event for the download (no HTTP actor context)', async () => {
    const pdfData = { patient: { firstName: 'Ana' } } as unknown as ExpedientePdfData
    vi.mocked(recordsSvc.getExpedienteData).mockResolvedValue(pdfData)
    vi.mocked(pdf.generateExpediente).mockResolvedValue(Buffer.from('%PDF-1.4 fake'))
    const res = { set: vi.fn(), end: vi.fn() }

    await controller.recordExport(tenantId, 'p1', res as never)

    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorType: 'system',
        category: 'system',
        action: 'export_generated',
        entityType: 'Patient',
        entityId: 'p1',
        status: 'success',
      }),
    )
  })

  it('recordExport attributes the audit entry to the HTTP actor when a request context is active', async () => {
    const pdfData = { patient: { firstName: 'Ana' } } as unknown as ExpedientePdfData
    vi.mocked(recordsSvc.getExpedienteData).mockResolvedValue(pdfData)
    vi.mocked(pdf.generateExpediente).mockResolvedValue(Buffer.from('%PDF-1.4 fake'))
    const res = { set: vi.fn(), end: vi.fn() }

    await httpAuditContextStore.run({ tenantId, actorUserId: 'user-1' }, () =>
      controller.recordExport(tenantId, 'p1', res as never),
    )

    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'user', actorUserId: 'user-1' }),
    )
  })
})
