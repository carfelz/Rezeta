import { useState } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Spinner,
  Textarea,
  Overline,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  useConsultationRecord,
  useEnsureRecord,
  useUpdateRecordSections,
  useRegenerateRecord,
  useSignRecord,
  useRecordVersions,
  useRecordVersion,
  downloadRecordPdf,
} from '@/hooks/consultations/use-consultation-record'
import { toastStrings } from '@/lib/toasts'
import type { RecordSection } from '@rezeta/shared'
import { patientDetailStrings as s } from './strings'

function handleDownloadRecordPdf(consultationId: string, versionNumber?: number): void {
  const promise =
    versionNumber !== undefined
      ? downloadRecordPdf(consultationId, versionNumber)
      : downloadRecordPdf(consultationId)
  promise.catch(() => {
    toast.error(toastStrings.errorHistoriaDownload)
  })
}

export interface RecordDocumentProps {
  consultationId: string
  consultationStatus: string
}

export function RecordDocument({
  consultationId,
  consultationStatus,
}: RecordDocumentProps): JSX.Element {
  const { data: record, isLoading } = useConsultationRecord(consultationId)
  const { data: versions } = useRecordVersions(consultationId)
  const ensure = useEnsureRecord()
  const update = useUpdateRecordSections(consultationId)
  const regenerate = useRegenerateRecord(consultationId)
  const signRecord = useSignRecord(consultationId)
  const [editing, setEditing] = useState(false)
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({})
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)

  const latestVersionNumber = record?.versionNumber ?? null
  const isViewingOlder = selectedVersion !== null && selectedVersion !== latestVersionNumber
  const { data: olderRecord } = useRecordVersion(consultationId, isViewingOlder ? selectedVersion : null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Spinner size="md" className="text-n-400" />
      </div>
    )
  }

  if (!record) {
    if (consultationStatus === 'open') {
      return <p className="text-[13px] text-n-500 p-5">{s.historiaOnlySigned}</p>
    }
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-3">
        <p className="text-[13px] text-n-500">{s.historiaChipNone}</p>
        <Button variant="secondary" size="sm" onClick={() => ensure.mutate(consultationId)}>
          {s.historiaGenerate}
        </Button>
      </div>
    )
  }

  if (isViewingOlder && !olderRecord) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Spinner size="md" className="text-n-400" />
      </div>
    )
  }

  const viewedRecord = isViewingOlder && olderRecord ? olderRecord : record
  const isDraft = !isViewingOlder && record.status === 'draft'
  const editableSections = record.sections.filter((sec) => sec.key !== 'ficha_identificacion')

  function startEdit(): void {
    setDraftTexts(Object.fromEntries(editableSections.map((sec) => [sec.key, sec.content])))
    setEditing(true)
  }

  function cancelEdit(): void {
    setEditing(false)
  }

  function saveEdit(): void {
    const changed = editableSections
      .filter((sec) => draftTexts[sec.key] !== sec.content)
      .map((sec) => ({ key: sec.key, content: draftTexts[sec.key] as string }))

    if (changed.length === 0) {
      setEditing(false)
      return
    }

    update.mutate({ sections: changed }, { onSuccess: () => setEditing(false) })
  }

  function confirmRegenerate(): void {
    if (window.confirm(s.historiaRegenerateConfirm)) regenerate.mutate()
  }

  function confirmRegenerateAmended(): void {
    if (window.confirm(s.historiaRegenerateAmended)) regenerate.mutate()
  }

  return (
    <div>
      {isViewingOlder ? (
        <div className="flex items-center gap-2 px-5 py-2 bg-n-50 border-b border-n-200">
          <span className="text-[12px] font-medium text-n-500">{s.olderVersionNotice}</span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownloadRecordPdf(consultationId, viewedRecord.versionNumber)}
            >
              <i className="ph ph-download-simple" /> {s.historiaDownload}
            </Button>
          </div>
        </div>
      ) : isDraft ? (
        <div className="flex items-center gap-2 px-5 py-2 bg-warning-bg border-b border-warning-border">
          <span className="text-[12px] font-medium text-warning-text">{s.historiaDraftBar}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={confirmRegenerate}>
              {s.historiaRegenerate}
            </Button>
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  {s.historiaCancelEdit}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={saveEdit}
                  disabled={update.isPending}
                >
                  {s.historiaSave}
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={startEdit}>
                {s.historiaEdit}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => signRecord.mutate()}
              disabled={editing || signRecord.isPending}
            >
              {s.historiaSign}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-2 bg-success-bg border-b border-success-border">
          <span className="text-[12px] font-medium text-success-text">{s.historiaSignedBar}</span>
          <div className="ml-auto flex gap-2">
            {consultationStatus === 'amended' && (
              <Button variant="ghost" size="sm" onClick={confirmRegenerateAmended}>
                {s.historiaRegenerate}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownloadRecordPdf(consultationId)}
            >
              <i className="ph ph-download-simple" /> {s.historiaDownload}
            </Button>
          </div>
        </div>
      )}

      <div className="p-5 max-w-[640px]">
        <div className="mb-4 pb-3 border-b border-n-200 flex items-center justify-between gap-3">
          <Overline size="sm" tone="neutral">
            {viewedRecord.kind === 'first_visit' ? s.historiaKindFirstVisit : s.historiaKindEvolution}
            {' · v'}
            {viewedRecord.versionNumber}
          </Overline>
          {versions && versions.length > 1 && (
            <Select
              value={String(selectedVersion ?? latestVersionNumber)}
              onValueChange={(value) => {
                const versionNumber = Number(value)
                setSelectedVersion(versionNumber === latestVersionNumber ? null : versionNumber)
              }}
            >
              <SelectTrigger aria-label={s.versionSelectorAria} className="w-auto min-w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((ver) => (
                  <SelectItem key={ver.versionNumber} value={String(ver.versionNumber)}>
                    {s.versionLabel(ver.versionNumber)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {viewedRecord.sections.map((section: RecordSection) => (
          <div key={section.key} className="mb-4 pl-3 border-l-2 border-p-500">
            <div className="flex items-center gap-2 mb-1">
              <Overline size="sm" tone="primary">
                {section.title}
              </Overline>
              {section.source === 'edited' && (
                <span className="font-mono text-[9px] uppercase px-1 rounded-sm bg-p-50 border border-p-100 text-p-500">
                  {s.historiaEditedFlag}
                </span>
              )}
            </div>
            {editing && !isViewingOlder && section.key !== 'ficha_identificacion' ? (
              <Textarea
                className="min-h-[80px]"
                value={draftTexts[section.key] as string}
                onChange={(e) =>
                  setDraftTexts((prev) => ({ ...prev, [section.key]: e.target.value }))
                }
              />
            ) : (
              <p className="text-[13px] text-n-600 whitespace-pre-line m-0">{section.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
