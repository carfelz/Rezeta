import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TagInput } from '../TagInput'

function Controlled({
  initial = [],
  ...rest
}: {
  initial?: string[]
  placeholder?: string
  removeAriaLabel?: (tag: string) => string
  disabled?: boolean
}): JSX.Element {
  const [value, setValue] = useState(initial)
  return <TagInput value={value} onChange={setValue} {...rest} />
}

describe('TagInput', () => {
  it('renders existing tags as chips', () => {
    render(<TagInput value={['Penicilina', 'Polen']} onChange={vi.fn()} />)
    expect(screen.getByText('Penicilina')).toBeInTheDocument()
    expect(screen.getByText('Polen')).toBeInTheDocument()
  })

  it('adds a tag on Enter and clears the input', async () => {
    const user = userEvent.setup()
    render(<Controlled placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    await user.type(input, 'Penicilina{Enter}')
    expect(screen.getByText('Penicilina')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('adds a tag on comma', async () => {
    const user = userEvent.setup()
    render(<Controlled placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    await user.type(input, 'Polen,')
    expect(screen.getByText('Polen')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('trims whitespace before committing', async () => {
    const user = userEvent.setup()
    render(<Controlled placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    await user.type(input, '  Polvo  {Enter}')
    expect(screen.getByText('Polvo')).toBeInTheDocument()
  })

  it('ignores empty input on Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    await user.type(input, '   {Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores empty input on comma', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    await user.type(input, ',')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('dedupes case-insensitively', async () => {
    const user = userEvent.setup()
    render(<Controlled initial={['Penicilina']} placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    await user.type(input, 'penicilina{Enter}')
    expect(screen.getAllByText(/penicilina/i)).toHaveLength(1)
  })

  it('removes the last tag on Backspace when input is empty', async () => {
    const user = userEvent.setup()
    render(<Controlled initial={['Penicilina', 'Polen']} placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    input.focus()
    await user.keyboard('{Backspace}')
    expect(screen.queryByText('Polen')).not.toBeInTheDocument()
    expect(screen.getByText('Penicilina')).toBeInTheDocument()
  })

  it('does not remove a tag on Backspace when input has text', async () => {
    const user = userEvent.setup()
    render(<Controlled initial={['Penicilina']} placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    await user.type(input, 'ab')
    await user.keyboard('{Backspace}')
    expect(screen.getByText('Penicilina')).toBeInTheDocument()
    expect(input).toHaveValue('a')
  })

  it('removes a tag via its remove button', async () => {
    const user = userEvent.setup()
    render(
      <Controlled
        initial={['Penicilina', 'Polen']}
        removeAriaLabel={(tag) => `Quitar ${tag}`}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Quitar Penicilina' }))
    expect(screen.queryByText('Penicilina')).not.toBeInTheDocument()
    expect(screen.getByText('Polen')).toBeInTheDocument()
  })

  it('uses a default remove aria-label when none is provided', () => {
    render(<TagInput value={['Polen']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /polen/i })).toBeInTheDocument()
  })

  it('disables the input and hides remove buttons when disabled', () => {
    render(<TagInput value={['Polen']} onChange={vi.fn()} disabled placeholder="Escribir..." />)
    expect(screen.getByPlaceholderText('Escribir...')).toBeDisabled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not add a tag on Enter when disabled', async () => {
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} disabled placeholder="Escribir..." />)
    const input = screen.getByPlaceholderText('Escribir...')
    // Disabled inputs cannot receive typed input at all.
    expect(input).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies the id to the input element', () => {
    render(<TagInput value={[]} onChange={vi.fn()} id="allergies" />)
    expect(document.getElementById('allergies')).toBeInTheDocument()
  })
})
