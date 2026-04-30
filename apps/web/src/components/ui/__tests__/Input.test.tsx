import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Input, Textarea, InputGroup, InputAdorn, InputIcon, Field } from '../Input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('accepts typed text', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')
    await user.type(input, 'hello')
    expect(input).toHaveValue('hello')
  })

  it('is disabled when disabled prop is set', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
  })

  it('shows error styling when error prop is true', () => {
    render(<Input error placeholder="Error" />)
    const input = screen.getByPlaceholderText('Error')
    expect(input.className).toContain('border-danger-solid')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Input ref={ref} placeholder="Ref" />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('applies custom className', () => {
    render(<Input className="custom" placeholder="Custom" />)
    expect(screen.getByPlaceholderText('Custom').className).toContain('custom')
  })

  it('calls onChange handler', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input placeholder="Change" onChange={onChange} />)
    await user.type(screen.getByPlaceholderText('Change'), 'a')
    expect(onChange).toHaveBeenCalled()
  })
})

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea placeholder="Enter notes" />)
    expect(screen.getByPlaceholderText('Enter notes')).toBeInTheDocument()
  })

  it('is a textarea element', () => {
    render(<Textarea placeholder="Notes" />)
    expect(screen.getByPlaceholderText('Notes').tagName).toBe('TEXTAREA')
  })

  it('shows error styling when error prop is true', () => {
    render(<Textarea error placeholder="Error" />)
    const ta = screen.getByPlaceholderText('Error')
    expect(ta.className).toContain('border-danger-solid')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Textarea ref={ref} placeholder="Ref" />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })
})

describe('InputGroup', () => {
  it('renders children', () => {
    render(
      <InputGroup>
        <span>Prefix</span>
        <Input placeholder="test" />
      </InputGroup>,
    )
    expect(screen.getByText('Prefix')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('test')).toBeInTheDocument()
  })

  it('applies error styles', () => {
    const { container } = render(
      <InputGroup error>
        <Input placeholder="err" />
      </InputGroup>,
    )
    expect(container.firstChild).toHaveClass('border-danger-solid')
  })
})

describe('InputAdorn', () => {
  it('renders adornment text', () => {
    render(
      <InputGroup>
        <InputAdorn>RD$</InputAdorn>
        <Input placeholder="amount" />
      </InputGroup>,
    )
    expect(screen.getByText('RD$')).toBeInTheDocument()
  })

  it('renders right-side adornment', () => {
    const { container } = render(
      <InputGroup>
        <Input placeholder="amount" />
        <InputAdorn side="right">.00</InputAdorn>
      </InputGroup>,
    )
    const adorn = container.querySelector('.border-l')
    expect(adorn).toBeInTheDocument()
  })

  it('renders plain variant without background', () => {
    const { container } = render(
      <InputGroup>
        <InputAdorn plain>@</InputAdorn>
        <Input placeholder="handle" />
      </InputGroup>,
    )
    const adorn = container.querySelector('span')
    expect(adorn?.className).not.toContain('bg-n-50')
  })
})

describe('InputIcon', () => {
  it('renders icon content', () => {
    render(
      <InputGroup>
        <InputIcon>
          <span data-testid="icon">🔍</span>
        </InputIcon>
        <Input placeholder="search" />
      </InputGroup>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders as button role when action prop is set', () => {
    const onClick = vi.fn()
    render(
      <InputGroup>
        <InputIcon action onClick={onClick}>
          <span>X</span>
        </InputIcon>
        <Input placeholder="clearable" />
      </InputGroup>,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})

describe('Field', () => {
  it('renders label and children', () => {
    render(
      <Field label="Full name">
        <Input placeholder="Name" />
      </Field>,
    )
    expect(screen.getByText('Full name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
  })

  it('shows required asterisk', () => {
    render(
      <Field label="Email" required>
        <Input placeholder="email" />
      </Field>,
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows helper text', () => {
    render(
      <Field label="Name" helper="Enter full name">
        <Input placeholder="name" />
      </Field>,
    )
    expect(screen.getByText('Enter full name')).toBeInTheDocument()
  })

  it('shows error text instead of helper when both provided', () => {
    render(
      <Field label="Name" helper="Enter full name" error="This field is required">
        <Input placeholder="name" />
      </Field>,
    )
    expect(screen.getByText('This field is required')).toBeInTheDocument()
    expect(screen.queryByText('Enter full name')).not.toBeInTheDocument()
  })

  it('renders without label', () => {
    render(
      <Field>
        <Input placeholder="no label" />
      </Field>,
    )
    expect(screen.getByPlaceholderText('no label')).toBeInTheDocument()
  })
})
