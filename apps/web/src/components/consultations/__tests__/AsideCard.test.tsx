import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AsideCard } from '../AsideCard'

describe('AsideCard', () => {
  it('renders title and children', () => {
    render(
      <AsideCard title="Alertas">
        <p>contenido</p>
      </AsideCard>,
    )
    expect(screen.getByText('Alertas')).toBeInTheDocument()
    expect(screen.getByText('contenido')).toBeInTheDocument()
  })
})
