import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { countBlockStats, formatRelativeTime } from '../helpers'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

describe('countBlockStats', () => {
  it('returns zeros for empty array', () => {
    expect(countBlockStats([])).toEqual({ total: 0, sections: 0 })
  })

  it('counts leaf blocks only in total', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'blk_1', type: 'text', content: 'hello' },
      { id: 'blk_2', type: 'alert', severity: 'info', content: 'note' },
    ]
    expect(countBlockStats(blocks)).toEqual({ total: 2, sections: 0 })
  })

  it('does not count sections in total', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'sec_1',
        type: 'section',
        title: 'Intro',
        blocks: [],
      },
      {
        id: 'sec_2',
        type: 'section',
        title: 'Assessment',
        blocks: [],
      },
    ]
    expect(countBlockStats(blocks)).toEqual({ total: 0, sections: 2 })
  })

  it('counts leaf blocks inside sections but not the sections themselves', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'sec_1',
        type: 'section',
        title: 'Intro',
        blocks: [
          { id: 'blk_1', type: 'text', content: 'text 1' },
          { id: 'blk_2', type: 'text', content: 'text 2' },
        ],
      },
      {
        id: 'sec_2',
        type: 'section',
        title: 'Assessment',
        blocks: [{ id: 'blk_3', type: 'alert', severity: 'warning', content: 'warn' }],
      },
    ]
    expect(countBlockStats(blocks)).toEqual({ total: 3, sections: 2 })
  })

  it('counts top-level leaves and section leaves separately', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'blk_0', type: 'text', content: 'top level' },
      {
        id: 'sec_1',
        type: 'section',
        title: 'Section',
        blocks: [{ id: 'blk_1', type: 'text', content: 'inside' }],
      },
    ]
    expect(countBlockStats(blocks)).toEqual({ total: 2, sections: 1 })
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "hace un momento" for less than 2 minutes ago', () => {
    vi.setSystemTime(new Date('2026-05-18T10:01:00Z'))
    const result = formatRelativeTime('2026-05-18T10:00:30Z')
    expect(result).toBe('hace un momento')
  })

  it('returns minutes for 2–59 minutes ago', () => {
    vi.setSystemTime(new Date('2026-05-18T10:15:00Z'))
    const result = formatRelativeTime('2026-05-18T10:00:00Z')
    expect(result).toBe('hace 15 min')
  })

  it('returns hours for 1–23 hours ago', () => {
    vi.setSystemTime(new Date('2026-05-18T13:00:00Z'))
    const result = formatRelativeTime('2026-05-18T10:00:00Z')
    expect(result).toBe('hace 3 h')
  })

  it('returns "ayer" for exactly 1 day ago', () => {
    vi.setSystemTime(new Date('2026-05-18T10:00:00Z'))
    const result = formatRelativeTime('2026-05-17T10:00:00Z')
    expect(result).toBe('ayer')
  })

  it('returns days for 2+ days ago', () => {
    vi.setSystemTime(new Date('2026-05-18T10:00:00Z'))
    const result = formatRelativeTime('2026-05-15T10:00:00Z')
    expect(result).toBe('hace 3 días')
  })
})
