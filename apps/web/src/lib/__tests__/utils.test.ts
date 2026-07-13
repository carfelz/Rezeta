import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn (tailwind-merge with custom tokens)', () => {
  it('keeps a custom font-size token alongside a text color', () => {
    // Regression: twMerge treated `text-overline` as a text-COLOR and stripped it
    // against `text-success-text`, so badges lost their size and inherited 16px.
    const result = cn('text-overline', 'text-success-text')
    expect(result).toContain('text-overline')
    expect(result).toContain('text-success-text')
  })

  it.each([
    'text-2xs',
    'text-overline',
    'text-caption',
    'text-body-sm',
    'text-body',
    'text-body-lg',
    'text-h3',
    'text-h2',
    'text-h1',
    'text-display',
  ])('keeps custom font-size %s when merged with a color class', (size) => {
    const result = cn(size, 'text-n-500')
    expect(result.split(' ')).toContain(size)
    expect(result).toContain('text-n-500')
  })

  it('still dedupes conflicting font sizes, last one wins', () => {
    expect(cn('text-sm', 'text-h1')).toBe('text-h1')
    expect(cn('text-overline', 'text-body-lg')).toBe('text-body-lg')
  })

  it('still resolves the custom font-weight tokens (reg regression guard)', () => {
    // font-sans and font-regular must not be treated as the same group.
    const result = cn('font-sans', 'font-regular')
    expect(result).toContain('font-sans')
    expect(result).toContain('font-regular')
  })

  it('merges plain conflicting utilities normally', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
