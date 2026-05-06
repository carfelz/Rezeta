import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TabRail, TabRailItem, TabRailAdd } from '../TabRail'

describe('TabRail', () => {
  it('renders children', () => {
    render(
      <TabRail>
        <TabRailItem>HTA</TabRailItem>
        <TabRailItem>DM2</TabRailItem>
      </TabRail>,
    )
    expect(screen.getByText('HTA')).toBeInTheDocument()
    expect(screen.getByText('DM2')).toBeInTheDocument()
  })
})

describe('TabRailItem', () => {
  it('renders children + meta', () => {
    render(<TabRailItem meta="4/8">HTA</TabRailItem>)
    expect(screen.getByText('HTA')).toBeInTheDocument()
    expect(screen.getByText('4/8')).toBeInTheDocument()
  })

  it('aria-pressed reflects active state', () => {
    const { rerender } = render(<TabRailItem>x</TabRailItem>)
    expect(screen.getByText('x').closest('button')).toHaveAttribute('aria-pressed', 'false')
    rerender(<TabRailItem active>x</TabRailItem>)
    expect(screen.getByText('x').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(<TabRailItem onClick={onClick}>x</TabRailItem>)
    fireEvent.click(screen.getByText('x'))
    expect(onClick).toHaveBeenCalled()
  })

  it('default type is button', () => {
    render(<TabRailItem>x</TabRailItem>)
    expect(screen.getByText('x').closest('button')).toHaveAttribute('type', 'button')
  })

  it('respects disabled', () => {
    render(<TabRailItem disabled>x</TabRailItem>)
    expect(screen.getByText('x').closest('button')).toBeDisabled()
  })
})

describe('TabRailAdd', () => {
  it('renders children', () => {
    render(<TabRailAdd>Añadir</TabRailAdd>)
    expect(screen.getByText('Añadir')).toBeInTheDocument()
  })

  it('forwards onClick', () => {
    const onClick = vi.fn()
    render(<TabRailAdd onClick={onClick}>x</TabRailAdd>)
    fireEvent.click(screen.getByText('x'))
    expect(onClick).toHaveBeenCalled()
  })
})
