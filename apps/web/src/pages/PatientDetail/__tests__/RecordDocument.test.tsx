import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordDocument } from '../RecordDocument'
import * as recordHooks from '@/hooks/consultations/use-consultation-record'
import type { ConsultationRecordDto } from '@rezeta/shared'

vi.mock('@/hooks/consultations/use-consultation-record')

const draft: ConsultationRecordDto = {
  id: 'rec1',
  consultationId: 'c1',
  patientId: 'p1',
  versionNumber: 1,
  kind: 'evolution',
  status: 'draft',
  sections: [
    {
      key: 'ficha_identificacion',
      title: 'Ficha de identificación',
      content: 'María Peña',
      source: 'generated',
      required: false,
    },
    {
      key: 'motivo_consulta',
      title: 'Motivo de consulta',
      content: 'Control.',
      source: 'generated',
      required: true,
    },
    {
      key: 'examen_fisico',
      title: 'Examen físico',
      content: 'PA 148/92',
      source: 'edited',
      required: true,
    },
  ],
  generatedAt: '2026-07-06T10:42:00Z',
  signedAt: null,
  signedBy: null,
  createdAt: '2026-07-06T10:42:00Z',
  updatedAt: '2026-07-06T10:42:00Z',
}

const mutationStub = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
    data: draft,
    isLoading: false,
    isSuccess: true,
  } as never)
  vi.mocked(recordHooks.useUpdateRecordSections).mockReturnValue(mutationStub)
  vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(mutationStub)
  vi.mocked(recordHooks.useSignRecord).mockReturnValue(mutationStub)
  vi.mocked(recordHooks.useEnsureRecord).mockReturnValue(mutationStub)
})

describe('RecordDocument', () => {
  it('renders sections with titles and the draft bar', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByText('Borrador — editable hasta la firma')).toBeInTheDocument()
    expect(screen.getByText('Motivo de consulta')).toBeInTheDocument()
    expect(screen.getByText('Control.')).toBeInTheDocument()
  })

  it('shows the edited flag on edited sections only', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getAllByText('Editado')).toHaveLength(1)
  })

  it('switches to textareas in edit mode and hides ficha from editing', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    expect(screen.getAllByRole('textbox').length).toBe(2) // motivo + examen, never ficha
  })

  it('saves edited sections and exits edit mode on success', () => {
    const update = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useUpdateRecordSections).mockReturnValue(update)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0]!, { target: { value: 'Control actualizado.' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    expect(vi.mocked((update as { mutate: ReturnType<typeof vi.fn> }).mutate)).toHaveBeenCalled()
  })

  it('cancels edit mode without saving', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }))
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })

  it('confirms before regenerating and calls mutate when accepted', () => {
    const regenerate = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(regenerate)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Regenerar/ }))
    expect(window.confirm).toHaveBeenCalled()
    expect(vi.mocked((regenerate as { mutate: ReturnType<typeof vi.fn> }).mutate)).toHaveBeenCalled()
  })

  it('does not regenerate when confirmation is declined', () => {
    const regenerate = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(regenerate)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Regenerar/ }))
    expect(vi.mocked((regenerate as { mutate: ReturnType<typeof vi.fn> }).mutate)).not.toHaveBeenCalled()
  })

  it('signs the record when Firmar historia is clicked', () => {
    const signRecord = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useSignRecord).mockReturnValue(signRecord)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Firmar historia/ }))
    expect(vi.mocked((signRecord as { mutate: ReturnType<typeof vi.fn> }).mutate)).toHaveBeenCalled()
  })

  it('renders read-only signed state with download action', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByText('Historia firmada — solo lectura')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Firmar historia/ })).not.toBeInTheDocument()
  })

  it('downloads the PDF when Descargar PDF is clicked', () => {
    vi.mocked(recordHooks.downloadRecordPdf).mockResolvedValue(undefined)
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Descargar PDF/ }))
    expect(vi.mocked(recordHooks.downloadRecordPdf)).toHaveBeenCalledWith('c1')
  })

  it('exits edit mode when the update mutation succeeds', () => {
    const update = {
      mutate: vi.fn((_vars, opts) => opts?.onSuccess?.()),
      mutateAsync: vi.fn(),
      isPending: false,
    } as never
    vi.mocked(recordHooks.useUpdateRecordSections).mockReturnValue(update)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })

  it('offers "Generar historia" when no record exists yet', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByRole('button', { name: /Generar historia/ })).toBeInTheDocument()
  })

  it('calls ensure.mutate when "Generar historia" is clicked', () => {
    const ensure = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useEnsureRecord).mockReturnValue(ensure)
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Generar historia/ }))
    expect(vi.mocked((ensure as { mutate: ReturnType<typeof vi.fn> }).mutate)).toHaveBeenCalledWith('c1')
  })

  it('shows the loading state', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.queryByText('Motivo de consulta')).not.toBeInTheDocument()
  })

  it('shows the only-signed message for open consultations without a record', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="open" />)
    expect(screen.getByText('La historia se genera al firmar la consulta.')).toBeInTheDocument()
  })

  it('labels a first-visit record with the first-visit kind string', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, kind: 'first_visit' },
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByText(/Primera consulta/)).toBeInTheDocument()
  })
})
