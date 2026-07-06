import { useState } from 'react'
import { Button, Spinner, Textarea, Overline } from '@/components/ui'
import {
  useConsultationRecord,
  useEnsureRecord,
  useUpdateRecordSections,
  useRegenerateRecord,
  useSignRecord,
  downloadRecordPdf,
} from '@/hooks/consultations/use-consultation-record'
import type { RecordSection } from '@rezeta/shared'
import { patientDetailStrings as s } from './strings'

export interface RecordDocumentProps {
  consultationId: string
  consultationStatus: string
}

export function RecordDocument({
  consultationId,
  consultationStatus,
}: RecordDocumentProps): JSX.Element {
  const { data: record, isLoading } = useConsultationRecord(consultationId)
  const ensure = useEnsureRecord()
  const update = useUpdateRecordSections(consultationId)
  const regenerate = useRegenerateRecord(consultationId)
  const signRecord = useSignRecord(consultationId)
  const [editing, setEditing] = useState(false)
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({})

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

  const isDraft = record.status === 'draft'
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

  return (
    <div>
      {isDraft ? (
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
          <div className="ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void downloadRecordPdf(consultationId)}
            >
              <i className="ph ph-download-simple" /> {s.historiaDownload}
            </Button>
          </div>
        </div>
      )}

      <div className="p-5 max-w-[640px]">
        <div className="mb-4 pb-3 border-b border-n-200">
          <Overline size="sm" tone="neutral">
            {record.kind === 'first_visit' ? s.historiaKindFirstVisit : s.historiaKindEvolution}
            {' · v'}
            {record.versionNumber}
          </Overline>
        </div>

        {record.sections.map((section: RecordSection) => (
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
            {editing && section.key !== 'ficha_identificacion' ? (
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
