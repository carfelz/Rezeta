import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Row } from '../Row'

describe('Row', () => {
  it('renders children', () => {
    const { container } = render(
      <Row>
        <span>a</span>
        <span>b</span>
      </Row>,
    )
    expect(container.textContent).toBe('ab')
  })

  it('always flex flex-row', () => {
    const { container } = render(<Row>x</Row>)
    expect(container.firstChild).toHaveClass('flex', 'flex-row')
  })

  it('default gap=2 align=center wrap=false', () => {
    const { container } = render(<Row>x</Row>)
    expect(container.firstChild).toHaveClass('gap-2', 'items-center', 'flex-nowrap')
  })

  it.each([0, 1, 2, 3, 4, 5, 6, 8, 10, 12] as const)('gap=%s applies gap-%s', (gap) => {
    const { container } = render(<Row gap={gap}>x</Row>)
    expect(container.firstChild).toHaveClass(`gap-${gap}`)
  })

  it('wrap=true applies flex-wrap', () => {
    const { container } = render(<Row wrap>x</Row>)
    expect(container.firstChild).toHaveClass('flex-wrap')
  })

  it.each([
    ['start', 'items-start'],
    ['baseline', 'items-baseline'],
  ] as const)('align=%s applies %s', (align, expected) => {
    const { container } = render(<Row align={align}>x</Row>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it.each([
    ['between', 'justify-between'],
    ['around', 'justify-around'],
  ] as const)('justify=%s applies %s', (justify, expected) => {
    const { container } = render(<Row justify={justify}>x</Row>)
    expect(container.firstChild).toHaveClass(expected)
  })

  it('renders as the requested element via `as`', () => {
    const { container } = render(<Row as="section">x</Row>)
    expect(container.firstChild?.nodeName).toBe('SECTION')
  })
})
