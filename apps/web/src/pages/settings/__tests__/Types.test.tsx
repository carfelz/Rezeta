import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProtocolCategoryDto } from '@/hooks/protocol-categories/use-protocol-categories'

const mocks = vi.hoisted(() => ({
  useProtocolCategories: vi.fn(),
  useCreateProtocolCategory: vi.fn(),
  useUpdateProtocolCategory: vi.fn(),
  useDeleteProtocolCategory: vi.fn(),
  updateMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/protocol-categories/use-protocol-categories', () => ({
  useProtocolCategories: mocks.useProtocolCategories,
  useCreateProtocolCategory: mocks.useCreateProtocolCategory,
  useUpdateProtocolCategory: mocks.useUpdateProtocolCategory,
  useDeleteProtocolCategory: mocks.useDeleteProtocolCategory,
}))

import { Types } from '../Types'

const customCategory: ProtocolCategoryDto = {
  id: 'cat-1',
  tenantId: 'tenant-1',
  name: 'Consulta',
  color: '#112233',
  isSeeded: false,
  deletedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updateMutateAsync.mockResolvedValue(customCategory)
  mocks.useProtocolCategories.mockReturnValue({
    data: [customCategory],
    isLoading: false,
    isError: false,
  })
  mocks.useCreateProtocolCategory.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mocks.useUpdateProtocolCategory.mockReturnValue({
    mutateAsync: mocks.updateMutateAsync,
    isPending: false,
  })
  mocks.useDeleteProtocolCategory.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
})

describe('Types — edit category modal', () => {
  function openEditModal() {
    render(<Types />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  }

  it('opens an edit modal prefilled with the category name and color', () => {
    openEditModal()
    expect(screen.getByText('Editar categoría')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Consulta')).toBeInTheDocument()
    // The color <input type="color"> reflects the current category color.
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement
    expect(colorInput).not.toBeNull()
    expect(colorInput.value).toBe('#112233')
  })

  it('submits both name and color on save', async () => {
    openEditModal()
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#445566' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(mocks.updateMutateAsync).toHaveBeenCalledWith({ name: 'Consulta', color: '#445566' })
    })
  })

  it('does not call the API when nothing changed', () => {
    openEditModal()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(mocks.updateMutateAsync).not.toHaveBeenCalled()
  })
})
