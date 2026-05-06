import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import {
  Button,
  Field,
  Input,
  Row,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Textarea,
} from '@/components/ui'

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
    <Stack gap={3} className="p-4">
      <Field label={strings.EDITOR_ALERT_SEVERITY_LABEL}>
        <Select value={draftSeverity} onValueChange={(v) => setDraftSeverity(v as Severity)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={strings.EDITOR_ALERT_TITLE_LABEL}>
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={strings.EDITOR_ALERT_TITLE_PLACEHOLDER}
        />
      </Field>

      <Field label={strings.EDITOR_ALERT_CONTENT_LABEL}>
        <Textarea
          rows={3}
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder={strings.EDITOR_ALERT_CONTENT_PLACEHOLDER}
          autoFocus
        />
      </Field>

      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </Row>
    </Stack>
  )
}
