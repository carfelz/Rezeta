import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Callout } from '../Callout'

describe('Callout', () => {
  it('renders children', () => {
    render(<Callout>Some message</Callout>)
    expect(screen.getByText('Some message')).toBeInTheDocument()
  })

  it('renders with title', () => {
    render(<Callout title="Alert title">Content</Callout>)
    expect(screen.getByText('Alert title')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders with icon', () => {
    render(<Callout icon={<span data-testid="icon">!</span>}>Content</Callout>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('applies info variant by default', () => {
    const { container } = render(<Callout>Info</Callout>)
    expect(container.firstChild).toHaveClass('bg-info-bg')
  })

  it.each([
    ['success', 'bg-success-bg'],
    ['warning', 'bg-warning-bg'],
    ['danger', 'bg-danger-bg'],
    ['info', 'bg-info-bg'],
  ] as const)('renders %s variant with correct bg', (variant, expectedClass) => {
    const { container } = render(<Callout variant={variant}>{variant}</Callout>)
    expect(container.firstChild).toHaveClass(expectedClass)
  })

  it('applies custom className', () => {
    const { container } = render(<Callout className="custom">Content</Callout>)
    expect(container.firstChild).toHaveClass('custom')
  })

  it('renders without icon when not provided', () => {
    const { container } = render(<Callout>No icon</Callout>)
    // icon span is conditionally rendered
    const iconSpan = container.querySelector('.text-\\[18px\\]')
    expect(iconSpan).not.toBeInTheDocument()
  })
})
