import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StepCircle } from '../StepCircle'

describe('StepCircle', () => {
  it('renders check icon when status=done', () => {
    render(<StepCircle status="done" aria-label="done" />)
    expect(screen.getByLabelText('done').querySelector('i')).toHaveClass('ph-check')
  })

  it('renders number when status=active and number provided', () => {
    render(<StepCircle status="active" number={5} aria-label="x" />)
    expect(screen.getByText('05')).toBeInTheDocument()
  })

  it('zero-pads single-digit numbers', () => {
    render(<StepCircle status="active" number={3} aria-label="x" />)
    expect(screen.getByText('03')).toBeInTheDocument()
  })

  it('renders number with two digits already', () => {
    render(<StepCircle status="active" number={12} aria-label="x" />)
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders empty when status=pending and no number', () => {
    render(<StepCircle status="pending" aria-label="pending" />)
    expect(screen.getByLabelText('pending').textContent).toBe('')
  })

  it('renders empty when status=active without number', () => {
    render(<StepCircle status="active" aria-label="x" />)
    expect(screen.getByLabelText('x').textContent).toBe('')
  })

  it('forces check via showCheck prop', () => {
    render(<StepCircle status="active" showCheck aria-label="x" />)
    expect(screen.getByLabelText('x').querySelector('i')).toHaveClass('ph-check')
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(<StepCircle status="pending" onClick={onClick} aria-label="x" />)
    fireEvent.click(screen.getByLabelText('x'))
    expect(onClick).toHaveBeenCalled()
  })

  it.each([
    ['done', 'bg-p-500'],
    ['active', 'border-p-500'],
    ['pending', 'border-n-300'],
  ] as const)('status=%s applies %s class', (status, expected) => {
    render(<StepCircle status={status} aria-label="x" />)
    expect(screen.getByLabelText('x')).toHaveClass(expected)
  })

  it.each([
    ['sm', 'w-5'],
    ['md', 'w-6'],
    ['lg', 'w-7'],
  ] as const)('size=%s applies %s class', (size, expected) => {
    render(<StepCircle status="done" size={size} aria-label="x" />)
    expect(screen.getByLabelText('x')).toHaveClass(expected)
  })

  it('respects disabled', () => {
    render(<StepCircle status="done" disabled aria-label="x" />)
    expect(screen.getByLabelText('x')).toBeDisabled()
  })

  it('always type=button', () => {
    render(<StepCircle status="done" aria-label="x" />)
    expect(screen.getByLabelText('x')).toHaveAttribute('type', 'button')
  })
})
