import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { RecordDocument } from '../RecordDocument'
import * as recordHooks from '@/hooks/consultations/use-consultation-record'
import { toastStrings } from '@/lib/toasts'
import type { ConsultationRecordDto, RecordVersionSummary } from '@rezeta/shared'

vi.mock('@/hooks/consultations/use-consultation-record')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Radix Select's pointerdown-based item selection needs these jsdom shims —
// jsdom implements neither pointer capture nor scrollIntoView.
beforeEach(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

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
  vi.mocked(recordHooks.useRecordVersions).mockReturnValue({
    data: [],
    isLoading: false,
    isSuccess: true,
  } as never)
  vi.mocked(recordHooks.useRecordVersion).mockReturnValue({
    data: undefined,
    isLoading: false,
    isSuccess: false,
  } as never)
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

  it('exits edit mode without mutating when saving with no changes', () => {
    const update = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useUpdateRecordSections).mockReturnValue(update)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    expect(
      vi.mocked((update as { mutate: ReturnType<typeof vi.fn> }).mutate),
    ).not.toHaveBeenCalled()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
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
    expect(
      vi.mocked((regenerate as { mutate: ReturnType<typeof vi.fn> }).mutate),
    ).toHaveBeenCalled()
  })

  it('does not regenerate when confirmation is declined', () => {
    const regenerate = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(regenerate)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Regenerar/ }))
    expect(
      vi.mocked((regenerate as { mutate: ReturnType<typeof vi.fn> }).mutate),
    ).not.toHaveBeenCalled()
  })

  it('signs the record when Firmar historia is clicked', () => {
    const signRecord = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useSignRecord).mockReturnValue(signRecord)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Firmar historia/ }))
    expect(
      vi.mocked((signRecord as { mutate: ReturnType<typeof vi.fn> }).mutate),
    ).toHaveBeenCalled()
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

  it('shows a Regenerar button on the signed bar when the consultation was amended', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="amended" />)
    expect(screen.getByRole('button', { name: /Regenerar/ })).toBeInTheDocument()
  })

  it('does not show a Regenerar button on the signed bar when the consultation is only signed', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.queryByRole('button', { name: /Regenerar/ })).not.toBeInTheDocument()
  })

  it('confirms with the amendment-specific string and regenerates when accepted', () => {
    const regenerate = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(regenerate)
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RecordDocument consultationId="c1" consultationStatus="amended" />)
    fireEvent.click(screen.getByRole('button', { name: /Regenerar/ }))
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('nueva versión firmada'),
    )
    expect(
      vi.mocked((regenerate as { mutate: ReturnType<typeof vi.fn> }).mutate),
    ).toHaveBeenCalled()
  })

  it('does not regenerate from the amended signed bar when confirmation is declined', () => {
    const regenerate = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never
    vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(regenerate)
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RecordDocument consultationId="c1" consultationStatus="amended" />)
    fireEvent.click(screen.getByRole('button', { name: /Regenerar/ }))
    expect(
      vi.mocked((regenerate as { mutate: ReturnType<typeof vi.fn> }).mutate),
    ).not.toHaveBeenCalled()
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

  it('toasts an error when the PDF download rejects', async () => {
    vi.mocked(recordHooks.downloadRecordPdf).mockRejectedValue(new Error('network'))
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Descargar PDF/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(toastStrings.errorHistoriaDownload))
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
    expect(vi.mocked((ensure as { mutate: ReturnType<typeof vi.fn> }).mutate)).toHaveBeenCalledWith(
      'c1',
    )
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

describe('RecordDocument version selector', () => {
  const latestSigned: ConsultationRecordDto = {
    ...draft,
    id: 'rec2',
    versionNumber: 2,
    status: 'signed',
    signedAt: '2026-07-06T12:00:00Z',
  }
  const olderVersion: ConsultationRecordDto = {
    ...latestSigned,
    id: 'rec1',
    versionNumber: 1,
    signedAt: '2026-07-05T12:00:00Z',
    sections: latestSigned.sections.map((sec) =>
      sec.key === 'motivo_consulta' ? { ...sec, content: 'Control anterior.' } : sec,
    ),
  }
  const versionsList: RecordVersionSummary[] = [
    {
      id: 'rec2',
      versionNumber: 2,
      kind: 'evolution',
      status: 'signed',
      generatedAt: latestSigned.generatedAt,
      signedAt: latestSigned.signedAt,
    },
    {
      id: 'rec1',
      versionNumber: 1,
      kind: 'evolution',
      status: 'signed',
      generatedAt: olderVersion.generatedAt,
      signedAt: olderVersion.signedAt,
    },
  ]

  it('hides the selector when there is only one version', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows the version selector when there are multiple versions', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: latestSigned,
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.mocked(recordHooks.useRecordVersions).mockReturnValue({
      data: versionsList,
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('selecting an older version renders its sections read-only and hides editing actions', async () => {
    const user = userEvent.setup()
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: latestSigned,
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.mocked(recordHooks.useRecordVersions).mockReturnValue({
      data: versionsList,
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.mocked(recordHooks.useRecordVersion).mockReturnValue({
      data: olderVersion,
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'V1' }))

    expect(screen.getByText('Control anterior.')).toBeInTheDocument()
    expect(screen.getByText('Versión anterior — solo lectura')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Firmar historia/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Regenerar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeInTheDocument()
  })

  it('downloads the PDF for the selected older version', async () => {
    const user = userEvent.setup()
    vi.mocked(recordHooks.downloadRecordPdf).mockResolvedValue(undefined)
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: latestSigned,
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.mocked(recordHooks.useRecordVersions).mockReturnValue({
      data: versionsList,
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.mocked(recordHooks.useRecordVersion).mockReturnValue({
      data: olderVersion,
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'V1' }))
    await user.click(screen.getByRole('button', { name: /Descargar PDF/ }))

    expect(vi.mocked(recordHooks.downloadRecordPdf)).toHaveBeenCalledWith('c1', 1)
  })

  it('restores the action bar when switching back to the latest version', async () => {
    const user = userEvent.setup()
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: latestSigned,
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.mocked(recordHooks.useRecordVersions).mockReturnValue({
      data: versionsList,
      isLoading: false,
      isSuccess: true,
    } as never)
    vi.mocked(recordHooks.useRecordVersion).mockReturnValue({
      data: olderVersion,
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'V1' }))
    expect(screen.getByText('Versión anterior — solo lectura')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'V2' }))

    expect(screen.queryByText('Versión anterior — solo lectura')).not.toBeInTheDocument()
    expect(screen.getByText('Historia firmada — solo lectura')).toBeInTheDocument()
  })
})
