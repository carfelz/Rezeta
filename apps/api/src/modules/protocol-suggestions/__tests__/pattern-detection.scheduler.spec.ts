import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatternDetectionScheduler } from '../pattern-detection.scheduler.js'

const mockPatternDetection = {
  runWeeklyDetection: vi.fn(),
}

describe('PatternDetectionScheduler', () => {
  let scheduler: PatternDetectionScheduler

  beforeEach(() => {
    vi.clearAllMocks()
    scheduler = new PatternDetectionScheduler(mockPatternDetection as never)
  })

  it('handleWeeklyDetection delegates to patternDetection.runWeeklyDetection', async () => {
    mockPatternDetection.runWeeklyDetection.mockResolvedValue(undefined)
    await scheduler.handleWeeklyDetection()
    expect(mockPatternDetection.runWeeklyDetection).toHaveBeenCalledOnce()
  })

  it('propagates errors from runWeeklyDetection', async () => {
    mockPatternDetection.runWeeklyDetection.mockRejectedValue(new Error('detection failed'))
    await expect(scheduler.handleWeeklyDetection()).rejects.toThrow('detection failed')
  })
})
