import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  download: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: mocks.get,
    download: mocks.download,
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryFn }: { queryFn: () => unknown }) => ({
    data: undefined,
    isLoading: true,
    isError: false,
    _queryFn: queryFn,
  })),
}))

import { downloadAuditLogCsv } from '../use-audit-logs'

describe('downloadAuditLogCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.download.mockResolvedValue(new Blob(['csv data'], { type: 'text/csv' }))
  })

  it('calls download with no params when empty', async () => {
    await downloadAuditLogCsv({})
    expect(mocks.download).toHaveBeenCalledWith('/v1/audit-logs/export.csv')
  })

  it('includes dateFrom in query string', async () => {
    await downloadAuditLogCsv({ dateFrom: '2026-01-01' })
    expect(mocks.download).toHaveBeenCalledWith(expect.stringContaining('dateFrom=2026-01-01'))
  })

  it('includes dateTo in query string', async () => {
    await downloadAuditLogCsv({ dateTo: '2026-12-31' })
    expect(mocks.download).toHaveBeenCalledWith(expect.stringContaining('dateTo=2026-12-31'))
  })

  it('includes category in query string', async () => {
    await downloadAuditLogCsv({ category: 'auth' })
    expect(mocks.download).toHaveBeenCalledWith(expect.stringContaining('category=auth'))
  })

  it('includes action in query string', async () => {
    await downloadAuditLogCsv({ action: 'login' })
    expect(mocks.download).toHaveBeenCalledWith(expect.stringContaining('action=login'))
  })

  it('includes status in query string', async () => {
    await downloadAuditLogCsv({ status: 'failed' })
    expect(mocks.download).toHaveBeenCalledWith(expect.stringContaining('status=failed'))
  })

  it('includes multiple params in query string', async () => {
    await downloadAuditLogCsv({ category: 'entity', status: 'success' })
    const url = mocks.download.mock.calls[0][0] as string
    expect(url).toContain('category=entity')
    expect(url).toContain('status=success')
  })

  it('returns blob from download', async () => {
    const blob = new Blob(['data'], { type: 'text/csv' })
    mocks.download.mockResolvedValue(blob)
    const result = await downloadAuditLogCsv({})
    expect(result).toBe(blob)
  })
})
