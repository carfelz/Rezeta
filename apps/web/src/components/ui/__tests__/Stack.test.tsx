import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Stack } from '../Stack'

describe('Stack', () => {
  it('renders children', () => {
    const { container } = render(
      <Stack>
        <span>a</span>
        <span>b</span>
      </Stack>,
    )
    expect(container.textContent).toBe('ab')
  })

  it('always flex flex-col', () => {
    const { container } = render(<Stack>x</Stack>)
    expect(container.firstChild).toHaveClass('flex', 'flex-col')
  })

  it('default gap=3', () => {
    const { container } = render(<Stack>x</Stack>)
    expect(container.firstChild).toHaveClass('gap-3')
  })

  it.each([0, 1, 2, 3, 4, 5, 6, 8, 10, 12] as const)('gap=%s applies gap-%s class', (gap) => {
    const { container } = render(<Stack gap={gap}>x</Stack>)
    expect(container.firstChild).toHaveClass(`gap-${gap}`)
  })

  it.each([
    ['start', 'items-start'],
    ['center', 'items-center'],
    ['end', 'items-end'],
    ['stretch', 'items-stretch'],
  ] as const)('align=%s applies %s class', (align, expected) => {
    const { container } = render(<Stack align={align}>x</Stack>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it.each([
    ['start', 'justify-start'],
    ['center', 'justify-center'],
    ['end', 'justify-end'],
    ['between', 'justify-between'],
  ] as const)('justify=%s applies %s class', (justify, expected) => {
    const { container } = render(<Stack justify={justify}>x</Stack>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it('forwards className', () => {
    const { container } = render(<Stack className="mb-4">x</Stack>)
    expect(container.firstChild).toHaveClass('mb-4')
  })

  it('renders as the requested element via `as`', () => {
    const { container } = render(<Stack as="section">x</Stack>)
    expect(container.firstChild?.nodeName).toBe('SECTION')
  })
})
