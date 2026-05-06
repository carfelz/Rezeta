import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  MissingFieldsPanel,
  MissingFieldsCallout,
  RequiredBadge,
  computeMissingFields,
} from '../MissingFieldsPanel'

const fields = [
  { id: 'chiefComplaint', label: 'Motivo de consulta' },
  { id: 'assessment', label: 'Evaluación', description: 'Impresión diagnóstica' },
]

describe('MissingFieldsPanel', () => {
  it('renders the FALTANTES header with count', () => {
    render(<MissingFieldsPanel fields={fields} onFieldClick={vi.fn()} />)
    expect(screen.getByText(/Faltantes \(2\)/)).toBeInTheDocument()
  })

  it('renders each field label', () => {
    render(<MissingFieldsPanel fields={fields} onFieldClick={vi.fn()} />)
    expect(screen.getByText('Motivo de consulta')).toBeInTheDocument()
    expect(screen.getByText('Evaluación')).toBeInTheDocument()
  })

  it('calls onFieldClick with field id when row clicked', () => {
    const onFieldClick = vi.fn()
    render(<MissingFieldsPanel fields={fields} onFieldClick={onFieldClick} />)
    fireEvent.click(screen.getByText('Motivo de consulta'))
    expect(onFieldClick).toHaveBeenCalledWith('chiefComplaint')
  })

  it('renders dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn()
    render(<MissingFieldsPanel fields={fields} onFieldClick={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Cerrar panel'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('does not render dismiss button when onDismiss not provided', () => {
    render(<MissingFieldsPanel fields={fields} onFieldClick={vi.fn()} />)
    expect(screen.queryByLabelText('Cerrar panel')).toBeNull()
  })

  it('renders nothing when fields is empty', () => {
    const { container } = render(<MissingFieldsPanel fields={[]} onFieldClick={vi.fn()} />)
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

describe('computeMissingFields', () => {
  const base = {
    chiefComplaint: 'Dolor de cabeza',
    subjective: '',
    objective: '',
    assessment: 'Migraña',
    plan: '',
    diagnoses: ['Migraña'],
  }

  it('returns empty array when required fields are filled', () => {
    expect(computeMissingFields(base)).toHaveLength(0)
  })

  it('includes chiefComplaint when missing', () => {
    const missing = computeMissingFields({ ...base, chiefComplaint: '' })
    expect(missing.some((f) => f.id === 'chiefComplaint')).toBe(true)
  })

  it('includes assessment when missing', () => {
    const missing = computeMissingFields({ ...base, assessment: '' })
    expect(missing.some((f) => f.id === 'assessment')).toBe(true)
  })

  it('includes diagnoses when empty', () => {
    const missing = computeMissingFields({ ...base, diagnoses: [] })
    expect(missing.some((f) => f.id === 'diagnoses')).toBe(true)
  })

  it('returns multiple missing fields at once', () => {
    const missing = computeMissingFields({
      ...base,
      chiefComplaint: '',
      assessment: '',
      diagnoses: [],
    })
    expect(missing).toHaveLength(3)
  })

  it('trims whitespace when checking chiefComplaint', () => {
    const missing = computeMissingFields({ ...base, chiefComplaint: '   ' })
    expect(missing.some((f) => f.id === 'chiefComplaint')).toBe(true)
  })
})
