import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WeeklySummaryScheduler } from '../weekly-summary.scheduler.js'

const mockWeeklySummary = { sendWeeklySummaries: vi.fn() }

describe('WeeklySummaryScheduler', () => {
  let scheduler: WeeklySummaryScheduler

  beforeEach(() => {
    vi.clearAllMocks()
    scheduler = new WeeklySummaryScheduler(mockWeeklySummary as never)
  })

  it('handleWeeklySummary delegates to weeklySummary.sendWeeklySummaries', async () => {
    mockWeeklySummary.sendWeeklySummaries.mockResolvedValue(undefined)
    await scheduler.handleWeeklySummary()
    expect(mockWeeklySummary.sendWeeklySummaries).toHaveBeenCalledOnce()
  })

  it('propagates errors from sendWeeklySummaries', async () => {
    mockWeeklySummary.sendWeeklySummaries.mockRejectedValue(new Error('smtp error'))
    await expect(scheduler.handleWeeklySummary()).rejects.toThrow('smtp error')
  })
})
