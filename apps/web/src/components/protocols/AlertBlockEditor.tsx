import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { blockEditorStrings } from './strings'
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
  { value: 'info', label: blockEditorStrings.alertSeverityInfo },
  { value: 'warning', label: blockEditorStrings.alertSeverityWarning },
  { value: 'danger', label: blockEditorStrings.alertSeverityDanger },
  { value: 'success', label: blockEditorStrings.alertSeveritySuccess },
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
      <Field label={blockEditorStrings.alertSeverityLabel}>
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

      <Field label={blockEditorStrings.alertTitleLabel}>
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={blockEditorStrings.alertTitlePlaceholder}
        />
      </Field>

      <Field label={blockEditorStrings.alertContentLabel}>
        <Textarea
          rows={3}
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder={blockEditorStrings.alertContentPlaceholder}
          autoFocus
        />
      </Field>

      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {blockEditorStrings.blockCancel}
        </Button>
        <Button variant="primary" size="sm" onClick={commit}>
          {blockEditorStrings.blockApply}
        </Button>
      </Row>
    </Stack>
  )
}
