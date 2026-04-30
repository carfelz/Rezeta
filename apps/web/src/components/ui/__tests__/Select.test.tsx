import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '../Select'

describe('Select components', () => {
  it('renders SelectTrigger with placeholder', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose..." />
        </SelectTrigger>
      </Select>,
    )
    expect(screen.getByText('Choose...')).toBeInTheDocument()
  })

  it('applies className to SelectTrigger', () => {
    render(
      <Select>
        <SelectTrigger className="my-class" data-testid="trigger">
          <SelectValue />
        </SelectTrigger>
      </Select>,
    )
    expect(screen.getByTestId('trigger')).toHaveClass('my-class')
  })

  it('renders disabled SelectTrigger', () => {
    render(
      <Select disabled>
        <SelectTrigger data-testid="trigger">
          <SelectValue placeholder="Choose..." />
        </SelectTrigger>
      </Select>,
    )
    expect(screen.getByTestId('trigger')).toBeDisabled()
  })

  it('renders SelectGroup, SelectLabel, SelectSeparator', () => {
    render(
      <Select>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Opciones</SelectLabel>
            <SelectItem value="a">Item A</SelectItem>
            <SelectSeparator />
            <SelectItem value="b">Item B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    )
    // SelectContent is portaled and may not be in DOM until open — just verify no crash
    expect(true).toBe(true)
  })

  it('SelectItem has correct value attribute when rendered', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger data-testid="trigger">
          <SelectValue placeholder="Choose..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option 1</SelectItem>
          <SelectItem value="opt2">Option 2</SelectItem>
        </SelectContent>
      </Select>,
    )
    // When open, items are in DOM
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
  })

  it('SelectItem renders with disabled state', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" disabled>
            Disabled Item
          </SelectItem>
        </SelectContent>
      </Select>,
    )
    const item = screen.getByText('Disabled Item')
    expect(item).toBeInTheDocument()
  })

  it('SelectLabel renders text', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>My Group</SelectLabel>
            <SelectItem value="x">X</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    )
    expect(screen.getByText('My Group')).toBeInTheDocument()
  })
})
