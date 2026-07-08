import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationRecordsController } from '../consultation-records.controller.js'
import type { ConsultationRecordsService } from '../consultation-records.service.js'
import type { PdfService } from '../../../lib/pdf.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../../common/audit-log/audit-context.store.js'
import type { AuthUser } from '@rezeta/shared'

const mockSvc = {
  getLatest: vi.fn(),
  ensureDraft: vi.fn(),
  regenerate: vi.fn(),
  updateSections: vi.fn(),
  sign: vi.fn(),
  getPdfData: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
}
const mockPdf = {
  generateHistoriaMedica: vi.fn(),
}
const mockAudit = { record: vi.fn().mockResolvedValue(undefined) }

const mockUser: AuthUser = {
  id: 'u1',
  tenantId: 't1',
  email: 'doc@test.com',
  role: 'owner',
}

const controller = new ConsultationRecordsController(
  mockSvc as unknown as ConsultationRecordsService,
  mockPdf as unknown as PdfService,
  mockAudit as unknown as AuditLogService,
)

beforeEach(() => vi.clearAllMocks())

describe('ConsultationRecordsController', () => {
  it('GET delegates to getLatest with tenant scope', async () => {
    mockSvc.getLatest.mockResolvedValue({ id: 'rec1' })
    const result = await controller.get('t1', 'c1')
    expect(mockSvc.getLatest).toHaveBeenCalledWith('c1', 't1')
    expect(result).toEqual({ id: 'rec1' })
  })

  it('POST delegates to ensureDraft', async () => {
    mockSvc.ensureDraft.mockResolvedValue({ id: 'rec1' })
    const result = await controller.create('t1', 'c1')
    expect(mockSvc.ensureDraft).toHaveBeenCalledWith('c1', 't1')
    expect(result).toEqual({ id: 'rec1' })
  })

  it('PATCH delegates to updateSections with the parsed dto', async () => {
    mockSvc.updateSections.mockResolvedValue({ id: 'rec1' })
    const dto = { sections: [{ key: 'evolucion' as const, content: 'x' }] }
    const result = await controller.update('t1', 'c1', dto)
    expect(mockSvc.updateSections).toHaveBeenCalledWith('c1', 't1', dto)
    expect(result).toEqual({ id: 'rec1' })
  })

  it('POST regenerate delegates', async () => {
    mockSvc.regenerate.mockResolvedValue({ id: 'rec1' })
    const result = await controller.regenerate('t1', 'c1')
    expect(mockSvc.regenerate).toHaveBeenCalledWith('c1', 't1')
    expect(result).toEqual({ id: 'rec1' })
  })

  it('POST sign passes the acting user', async () => {
    mockSvc.sign.mockResolvedValue({ id: 'rec1', status: 'signed' })
    const result = await controller.sign('t1', mockUser, 'c1')
    expect(mockSvc.sign).toHaveBeenCalledWith('c1', 't1', 'u1')
    expect(result).toEqual({ id: 'rec1', status: 'signed' })
  })

  it('GET pdf streams the generated pdf buffer', async () => {
    const pdfData = { record: { id: 'rec1' } }
    const buffer = Buffer.from('%PDF-1.4 fake')
    mockSvc.getPdfData.mockResolvedValue(pdfData)
    mockPdf.generateHistoriaMedica.mockResolvedValue(buffer)
    const res = { set: vi.fn(), end: vi.fn() }

    await controller.pdfDownload('t1', 'c1', undefined, res as never)

    expect(mockSvc.getPdfData).toHaveBeenCalledWith('c1', 't1', undefined)
    expect(mockPdf.generateHistoriaMedica).toHaveBeenCalledWith(pdfData)
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="historia-c1.pdf"',
      }),
    )
    expect(res.end).toHaveBeenCalledWith(buffer)
  })

  it('GET pdf passes the version query param through and versions the filename', async () => {
    const pdfData = { record: { id: 'rec1', versionNumber: 2 } }
    const buffer = Buffer.from('%PDF-1.4 fake')
    mockSvc.getPdfData.mockResolvedValue(pdfData)
    mockPdf.generateHistoriaMedica.mockResolvedValue(buffer)
    const res = { set: vi.fn(), end: vi.fn() }

    await controller.pdfDownload('t1', 'c1', 2, res as never)

    expect(mockSvc.getPdfData).toHaveBeenCalledWith('c1', 't1', 2)
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Disposition': 'attachment; filename="historia-c1-v2.pdf"',
      }),
    )
  })

  it('GET versions delegates to listVersions', async () => {
    const summaries = [{ id: 'rec1', versionNumber: 1 }]
    mockSvc.listVersions.mockResolvedValue(summaries)
    const result = await controller.getVersions('t1', 'c1')
    expect(mockSvc.listVersions).toHaveBeenCalledWith('c1', 't1')
    expect(result).toEqual(summaries)
  })

  it('GET versions/:versionNumber delegates to getVersion', async () => {
    mockSvc.getVersion.mockResolvedValue({ id: 'rec1', versionNumber: 2 })
    const result = await controller.getVersion('t1', 'c1', 2)
    expect(mockSvc.getVersion).toHaveBeenCalledWith('c1', 't1', 2)
    expect(result).toEqual({ id: 'rec1', versionNumber: 2 })
  })

  it('GET pdf records a non-fatal audit event for the download (no HTTP actor context)', async () => {
    mockSvc.getPdfData.mockResolvedValue({ record: { id: 'rec1' } })
    mockPdf.generateHistoriaMedica.mockResolvedValue(Buffer.from('%PDF-1.4 fake'))
    const res = { set: vi.fn(), end: vi.fn() }

    await controller.pdfDownload('t1', 'c1', undefined, res as never)

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        actorType: 'system',
        category: 'communication',
        action: 'pdf_generated',
        entityType: 'ConsultationRecord',
        entityId: 'c1',
        status: 'success',
      }),
    )
  })

  it('GET pdf attributes the audit entry to the HTTP actor when a request context is active', async () => {
    mockSvc.getPdfData.mockResolvedValue({ record: { id: 'rec1' } })
    mockPdf.generateHistoriaMedica.mockResolvedValue(Buffer.from('%PDF-1.4 fake'))
    const res = { set: vi.fn(), end: vi.fn() }

    await httpAuditContextStore.run({ tenantId: 't1', actorUserId: 'u1' }, () =>
      controller.pdfDownload('t1', 'c1', undefined, res as never),
    )

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'user', actorUserId: 'u1' }),
    )
  })
})
