import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui'

type Severity = 'info' | 'warning' | 'danger' | 'success'

interface AlertBlockEditorProps {
  id: string
  severity: Severity
  title?: string | undefined
  content: string
}

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'info', label: strings.EDITOR_ALERT_SEVERITY_INFO },
  { value: 'warning', label: strings.EDITOR_ALERT_SEVERITY_WARNING },
  { value: 'danger', label: strings.EDITOR_ALERT_SEVERITY_DANGER },
  { value: 'success', label: strings.EDITOR_ALERT_SEVERITY_SUCCESS },
]

export function AlertBlockEditor({
  id,
  severity,
  title,
  content,
}: AlertBlockEditorProps): JSX.Element {
  const [draftSeverity, setDraftSeverity] = useState<Severity>(severity)
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  const [draftContent, setDraftContent] = useState(content)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const commit = () => {
    updateBlock(id, (b) => {
      if (b.type !== 'alert') return b
      const trimmed = draftTitle.trim()
      const updated = { ...b, severity: draftSeverity, content: draftContent }
      if (trimmed) updated.title = trimmed
      else delete updated.title
      return updated
    })
    selectBlock(null)
  }

  const cancel = () => {
    setDraftSeverity(severity)
    setDraftTitle(title ?? '')
    setDraftContent(content)
    selectBlock(null)
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Severity */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_ALERT_SEVERITY_LABEL}
        </label>
        <select
          className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms] bg-n-0"
          value={draftSeverity}
          onChange={(e) => setDraftSeverity(e.target.value as Severity)}
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Title (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_ALERT_TITLE_LABEL}
        </label>
        <input
          type="text"
          className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={strings.EDITOR_ALERT_TITLE_PLACEHOLDER}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_ALERT_CONTENT_LABEL}
        </label>
        <textarea
          className="w-full min-h-[80px] px-3 py-2 text-[13px] font-sans text-n-700 border border-n-300 rounded-sm resize-vertical focus:outline-none focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] transition-all duration-[100ms]"
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder={strings.EDITOR_ALERT_CONTENT_PLACEHOLDER}
          autoFocus
        />
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </div>
    </div>
  )
}
