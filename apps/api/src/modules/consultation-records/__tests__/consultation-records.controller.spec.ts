import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationRecordsController } from '../consultation-records.controller.js'
import type { ConsultationRecordsService } from '../consultation-records.service.js'
import type { PdfService } from '../../../lib/pdf.service.js'
import type { AuthUser } from '@rezeta/shared'

const mockSvc = {
  getLatest: vi.fn(),
  ensureDraft: vi.fn(),
  regenerate: vi.fn(),
  updateSections: vi.fn(),
  sign: vi.fn(),
}
const mockPdf = {}

const mockUser: AuthUser = {
  id: 'u1',
  tenantId: 't1',
  email: 'doc@test.com',
  role: 'owner',
}

const controller = new ConsultationRecordsController(
  mockSvc as unknown as ConsultationRecordsService,
  mockPdf as unknown as PdfService,
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
})
