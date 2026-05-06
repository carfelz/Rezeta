import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProtocolPills } from '../ProtocolPills'

const pills = [
  { id: 'p1', title: 'HTA — Seguimiento', completed: 4, total: 8, isActive: true },
  { id: 'p2', title: 'DM2 — Control', completed: 2, total: 6, isActive: false },
]

describe('ProtocolPills', () => {
  it('renders each pill title', () => {
    render(<ProtocolPills pills={pills} onSelect={vi.fn()} onAdd={vi.fn()} />)
    expect(screen.getByText('HTA — Seguimiento')).toBeInTheDocument()
    expect(screen.getByText('DM2 — Control')).toBeInTheDocument()
  })

  it('renders progress count for each pill', () => {
    render(<ProtocolPills pills={pills} onSelect={vi.fn()} onAdd={vi.fn()} />)
    expect(screen.getByText('4/8')).toBeInTheDocument()
    expect(screen.getByText('2/6')).toBeInTheDocument()
  })

  it('renders the "Añadir protocolo" tab', () => {
    render(<ProtocolPills pills={pills} onSelect={vi.fn()} onAdd={vi.fn()} />)
    expect(screen.getByText('Añadir protocolo')).toBeInTheDocument()
  })

  it('calls onSelect with pill id when clicked', () => {
    const onSelect = vi.fn()
    render(<ProtocolPills pills={pills} onSelect={onSelect} onAdd={vi.fn()} />)
    fireEvent.click(screen.getByText('DM2 — Control'))
    expect(onSelect).toHaveBeenCalledWith('p2')
  })

  it('calls onAdd when "Añadir protocolo" clicked', () => {
    const onAdd = vi.fn()
    render(<ProtocolPills pills={pills} onSelect={vi.fn()} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('Añadir protocolo'))
    expect(onAdd).toHaveBeenCalled()
  })

  it('hides add button when showAdd=false', () => {
    render(<ProtocolPills pills={pills} onSelect={vi.fn()} onAdd={vi.fn()} showAdd={false} />)
    expect(screen.queryByText('Añadir protocolo')).toBeNull()
  })
})
