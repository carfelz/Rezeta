import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SectionBlock } from '../SectionBlock'

describe('SectionBlock', () => {
  it('renders heading and children', () => {
    render(
      <SectionBlock title="Vitals">
        <span>body</span>
      </SectionBlock>,
    )
    expect(screen.getByRole('heading', { name: 'Vitals' })).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('passes id through when provided', () => {
    const { container } = render(
      <SectionBlock title="x" id="my-id">
        <span>body</span>
      </SectionBlock>,
    )
    expect(container.querySelector('#my-id')).not.toBeNull()
  })
})
