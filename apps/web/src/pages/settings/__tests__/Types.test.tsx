import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProtocolCategoryDto } from '@/hooks/protocol-categories/use-protocol-categories'
import { ApiRequestError } from '@/lib/api-client'

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiRequestError: class ApiRequestError extends Error {
    error: { code: string; message: string; details?: Record<string, unknown> }
    constructor(error: { code: string; message: string; details?: Record<string, unknown> }) {
      super(error.message)
      this.name = 'ApiRequestError'
      this.error = error
    }
  },
}))

const mocks = vi.hoisted(() => ({
  useProtocolCategories: vi.fn(),
  useCreateProtocolCategory: vi.fn(),
  useUpdateProtocolCategory: vi.fn(),
  useDeleteProtocolCategory: vi.fn(),
  updateMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
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
  specialty: null,
  isSeeded: false,
  deletedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updateMutateAsync.mockResolvedValue(customCategory)
  mocks.deleteMutateAsync.mockResolvedValue(undefined)
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
  mocks.useDeleteProtocolCategory.mockReturnValue({
    mutateAsync: mocks.deleteMutateAsync,
    isPending: false,
  })
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

  it('submits name, color, and specialty on save', async () => {
    openEditModal()
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#445566' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
        name: 'Consulta',
        color: '#445566',
        specialty: null,
      })
    })
  })

  it('does not call the API when nothing changed', () => {
    openEditModal()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(mocks.updateMutateAsync).not.toHaveBeenCalled()
  })

  it('renders the specialty field with the correct label', () => {
    openEditModal()
    expect(screen.getByText('Especialidad sugerida')).toBeInTheDocument()
  })

  it('prefills specialty field with the category specialty value', () => {
    mocks.useProtocolCategories.mockReturnValue({
      data: [{ ...customCategory, specialty: 'cardiología' }],
      isLoading: false,
      isError: false,
    })
    mocks.updateMutateAsync.mockResolvedValue({ ...customCategory, specialty: 'cardiología' })
    render(<Types />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByDisplayValue('cardiología')).toBeInTheDocument()
  })

  it('sends specialty in the update payload when changed', async () => {
    openEditModal()
    const specialtyInput = screen.getByPlaceholderText('Ej. cardiología, pediatría')
    fireEvent.change(specialtyInput, { target: { value: 'neurología' } })
    // also change color so that "nothing changed" guard doesn't fire
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#778899' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(mocks.updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ specialty: 'neurología' }),
      )
    })
  })
})

describe('Types — create category modal', () => {
  function openCreateModal() {
    render(<Types />)
    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/i }))
  }

  it('renders the specialty field in the create modal', () => {
    openCreateModal()
    expect(screen.getByText('Especialidad sugerida')).toBeInTheDocument()
  })

  it('sends specialty in create payload when filled in', async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({ ...customCategory, id: 'cat-new' })
    mocks.useCreateProtocolCategory.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    })
    openCreateModal()
    const nameInput = screen.getByPlaceholderText('Ej. Emergencia, Procedimiento')
    fireEvent.change(nameInput, { target: { value: 'Cardiología' } })
    const specialtyInput = screen.getByPlaceholderText('Ej. cardiología, pediatría')
    fireEvent.change(specialtyInput, { target: { value: 'cardiología' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }))
    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Cardiología', specialty: 'cardiología' }),
      )
    })
  })

  it('does not send specialty key when field is left empty', async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({ ...customCategory, id: 'cat-new' })
    mocks.useCreateProtocolCategory.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    })
    openCreateModal()
    const nameInput = screen.getByPlaceholderText('Ej. Emergencia, Procedimiento')
    fireEvent.change(nameInput, { target: { value: 'Urgencias' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }))
    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.not.objectContaining({ specialty: expect.anything() }),
      )
    })
  })
})

describe('Types — delete category blocked by templates', () => {
  it('shows an explanatory modal when delete fails with CATEGORY_IN_USE_BY_TEMPLATES', async () => {
    mocks.deleteMutateAsync.mockRejectedValue(
      new ApiRequestError({
        code: 'CATEGORY_IN_USE_BY_TEMPLATES',
        message: 'Category is in use by templates',
        details: { count: 2 },
      }),
    )
    render(<Types />)

    // Open the confirm dialog
    fireEvent.click(screen.getByTitle('Eliminar'))
    await waitFor(() => {
      expect(screen.getByText(/¿Eliminar la categoría/)).toBeInTheDocument()
    })

    // Confirm the delete
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    // Wait for the blocked modal to appear
    await waitFor(() => {
      expect(screen.getByText('No se puede eliminar esta categoría')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/No puedes eliminar esta categoría: 2 plantillas la usan/),
    ).toBeInTheDocument()

    // Category still visible in the list
    expect(screen.getByText('Consulta')).toBeInTheDocument()
  })
})
