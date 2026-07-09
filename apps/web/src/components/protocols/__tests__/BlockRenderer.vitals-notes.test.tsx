import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BlockRenderer } from '../BlockRenderer'
import { blockTypeStrings } from '../strings'

/**
 * Covers the read-only (non-run-mode) `BlockRenderer`'s `vitals` and
 * `clinical_notes` cases. Neighboring component tests in this directory (e.g.
 * BlockRendererRunMode.vitals-notes.test.tsx) use a plain RTL `render` with
 * no extra providers — BlockRenderer needs none either, so this harness is
 * minimal: build a block and render it directly.
 */

describe('BlockRenderer — clinical_notes label rendering', () => {
  it('renders its label exactly once (no duplicate chrome title)', () => {
    const block = {
      id: 'notes-1',
      type: 'clinical_notes',
      label: 'Motivo de consulta',
      content: '',
    }
    render(<BlockRenderer block={block} />)

    expect(screen.getAllByText('Motivo de consulta')).toHaveLength(1)
  })
})

describe('BlockRenderer — vitals label rendering', () => {
  it('with no title, renders the type name exactly once (chrome chip) and no duplicate title', () => {
    const block = {
      id: 'vitals-1',
      type: 'vitals',
      fields: [{ id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' as const }],
    }
    render(<BlockRenderer block={block} />)

    expect(screen.getAllByText(blockTypeStrings.vitals)).toHaveLength(1)
  })

  it('with a title, renders that title exactly once', () => {
    const block = {
      id: 'vitals-1',
      type: 'vitals',
      title: 'Signos basales',
      fields: [{ id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' as const }],
    }
    render(<BlockRenderer block={block} />)

    expect(screen.getAllByText('Signos basales')).toHaveLength(1)
  })
})
