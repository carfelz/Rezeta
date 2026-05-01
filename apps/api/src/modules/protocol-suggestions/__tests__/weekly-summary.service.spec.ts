import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WeeklySummaryService } from '../weekly-summary.service.js'

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({}),
    })),
  },
}))

const baseUser = { id: 'user-1', email: 'doc@test.com', fullName: 'Dr. Test', tenantId: 'tenant-1' }

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    protocolSuggestion: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    protocol: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  }
}

describe('WeeklySummaryService', () => {
  let service: WeeklySummaryService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = makePrisma()
    service = new WeeklySummaryService(prisma as never)
  })

  describe('sendWeeklySummaries', () => {
    it('skips when SMTP_HOST is not configured', async () => {
      delete process.env.SMTP_HOST
      await service.sendWeeklySummaries()
      expect(prisma.protocolSuggestion.findMany).not.toHaveBeenCalled()
    })

    it('sends no emails when no users have pending suggestions', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      prisma.protocolSuggestion.findMany.mockResolvedValue([])
      await service.sendWeeklySummaries()
      expect(prisma.protocolSuggestion.findMany).toHaveBeenCalledOnce()
      delete process.env.SMTP_HOST
    })

    it('sends summary email for users with pending suggestions', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      process.env.SMTP_PORT = '587'

      const suggestion = {
        protocol: { creator: { ...baseUser } },
      }
      prisma.protocolSuggestion.findMany
        .mockResolvedValueOnce([suggestion]) // getUsersWithPendingSuggestions
        .mockResolvedValueOnce([
          {
            id: 'sug-1',
            impactSummary: 'Dose adjustment',
            occurrenceCount: 8,
            totalUses: 10,
            occurrencePercentage: { toString: () => '80' },
            protocol: { id: 'proto-1', title: 'Test Protocol' },
          },
        ])
      prisma.protocol.findMany.mockResolvedValue([])

      await service.sendWeeklySummaries()

      delete process.env.SMTP_HOST
      delete process.env.SMTP_PORT
    })

    it('deduplicate users with multiple suggestions', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'

      const suggestion1 = { protocol: { creator: { ...baseUser } } }
      const suggestion2 = { protocol: { creator: { ...baseUser } } } // same user
      prisma.protocolSuggestion.findMany
        .mockResolvedValueOnce([suggestion1, suggestion2])
        .mockResolvedValue([])
      prisma.protocol.findMany.mockResolvedValue([])

      await service.sendWeeklySummaries()
      // Only one email sent (deduplicated)
      expect(prisma.protocolSuggestion.findMany).toHaveBeenCalledTimes(2) // once for users, once for that user's suggestions

      delete process.env.SMTP_HOST
    })

    it('continues on email send failure and logs error', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      const nodemailer = await import('nodemailer')
      const failingTransport = { sendMail: vi.fn().mockRejectedValue(new Error('send failed')) }
      vi.mocked(nodemailer.default.createTransport).mockReturnValueOnce(failingTransport as never)

      prisma.protocolSuggestion.findMany
        .mockResolvedValueOnce([{ protocol: { creator: { ...baseUser } } }])
        .mockResolvedValue([])
      prisma.protocol.findMany.mockResolvedValue([])

      // Should not throw — errors are caught per-user
      await expect(service.sendWeeklySummaries()).resolves.not.toThrow()

      delete process.env.SMTP_HOST
    })

    it('skips email when no suggestions and no variants for user', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      const nodemailer = await import('nodemailer')
      const mockSendMail = vi.fn()
      vi.mocked(nodemailer.default.createTransport).mockReturnValueOnce({
        sendMail: mockSendMail,
      } as never)

      prisma.protocolSuggestion.findMany
        .mockResolvedValueOnce([{ protocol: { creator: { ...baseUser } } }])
        .mockResolvedValueOnce([]) // no suggestions for this user
      prisma.protocol.findMany.mockResolvedValue([]) // no variants

      await service.sendWeeklySummaries()
      expect(mockSendMail).not.toHaveBeenCalled()

      delete process.env.SMTP_HOST
    })

    it('sends email with auto-generated variants', async () => {
      process.env.SMTP_HOST = 'smtp.test.com'
      const nodemailer = await import('nodemailer')
      const mockSendMail = vi.fn().mockResolvedValue({})
      vi.mocked(nodemailer.default.createTransport).mockReturnValueOnce({
        sendMail: mockSendMail,
      } as never)

      prisma.protocolSuggestion.findMany
        .mockResolvedValueOnce([{ protocol: { creator: { ...baseUser } } }])
        .mockResolvedValueOnce([]) // no pending suggestions
      prisma.protocol.findMany.mockResolvedValue([
        {
          id: 'variant-1',
          title: 'Protocol - Variante Optimizada',
          metadata: { autoGenerated: true },
          createdAt: new Date(),
        },
      ])

      await service.sendWeeklySummaries()
      expect(mockSendMail).toHaveBeenCalledOnce()

      delete process.env.SMTP_HOST
    })
  })
})
