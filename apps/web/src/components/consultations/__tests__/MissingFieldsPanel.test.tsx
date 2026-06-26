import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  MissingFieldsPanel,
  MissingFieldsCallout,
  RequiredBadge,
} from '../MissingFieldsPanel'

const fields = [
  { id: 'chiefComplaint', label: 'Motivo de consulta' },
  { id: 'assessment', label: 'Evaluación', description: 'Impresión diagnóstica' },
]

describe('MissingFieldsPanel', () => {
  it('renders the FALTANTES header with count', () => {
    render(<MissingFieldsPanel fields={fields} />)
    expect(screen.getByText(/Faltantes \(2\)/)).toBeInTheDocument()
  })

  it('renders each field label', () => {
    render(<MissingFieldsPanel fields={fields} />)
    expect(screen.getByText('Motivo de consulta')).toBeInTheDocument()
    expect(screen.getByText('Evaluación')).toBeInTheDocument()
  })

  it('renders field rows as a static checklist (not interactive buttons)', () => {
    render(<MissingFieldsPanel fields={fields} />)
    // Field rows are static <li>; the only button in the panel is the dismiss control.
    expect(screen.queryByRole('button', { name: /Motivo de consulta/i })).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(fields.length)
  })

  it('renders dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn()
    render(<MissingFieldsPanel fields={fields} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Cerrar panel'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('does not render dismiss button when onDismiss not provided', () => {
    render(<MissingFieldsPanel fields={fields} />)
    expect(screen.queryByLabelText('Cerrar panel')).toBeNull()
  })

  it('renders nothing when fields is empty', () => {
    const { container } = render(<MissingFieldsPanel fields={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('MissingFieldsCallout', () => {
  it('renders the title', () => {
    render(<MissingFieldsCallout count={3} onJumpFirst={vi.fn()} onShowList={vi.fn()} />)
    expect(screen.getByText('No puedes firmar todavía')).toBeInTheDocument()
  })

  it('renders count in the body link', () => {
    render(<MissingFieldsCallout count={3} onJumpFirst={vi.fn()} onShowList={vi.fn()} />)
    expect(screen.getByText(/Faltan 3 campos requeridos/)).toBeInTheDocument()
  })

  it('renders "Ver faltantes" button', () => {
    render(<MissingFieldsCallout count={3} onJumpFirst={vi.fn()} onShowList={vi.fn()} />)
    expect(screen.getByText('Ver faltantes')).toBeInTheDocument()
  })

  it('calls onJumpFirst when body link clicked', () => {
    const onJumpFirst = vi.fn()
    render(<MissingFieldsCallout count={3} onJumpFirst={onJumpFirst} onShowList={vi.fn()} />)
    fireEvent.click(screen.getByText(/Faltan 3 campos requeridos/))
    expect(onJumpFirst).toHaveBeenCalled()
  })

  it('calls onShowList when "Ver faltantes" clicked', () => {
    const onShowList = vi.fn()
    render(<MissingFieldsCallout count={3} onJumpFirst={vi.fn()} onShowList={onShowList} />)
    fireEvent.click(screen.getByText('Ver faltantes'))
    expect(onShowList).toHaveBeenCalled()
  })
})

describe('RequiredBadge', () => {
  it('renders the badge text', () => {
    render(<RequiredBadge />)
    expect(screen.getByText('Requerido')).toBeInTheDocument()
  })
})
