import { useState } from 'react'
import { Button, Chip, Input, TextLink, Textarea } from '@/components/ui'
import { useAuth } from '@/hooks/use-auth'
import { formatDoctorName } from '@/lib/format/names'
import { offProtocolNoteStrings } from './strings'

export interface OffProtocolNoteProps {
  onSave: (params: { title: string; body: string }) => void
  onCancel: () => void
  isPending?: boolean
}

export function OffProtocolNote({
  onSave,
  onCancel,
  isPending = false,
}: OffProtocolNoteProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const { user } = useAuth()

  const now = new Date()
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
  const doctorName = formatDoctorName(user?.fullName)

  return (
    <div className="bg-n-0 border border-warning-border rounded-md overflow-hidden">
      <div className="px-4 pt-3 pb-3">
        <div className="mb-3">
          <Chip tone="warning" size="md">
            {offProtocolNoteStrings.chipLabel}
          </Chip>
        </div>

        <Input
          variant="ghost"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={offProtocolNoteStrings.titlePlaceholder}
          className="font-serif font-medium text-h3 text-n-900 leading-tight mb-2 h-auto px-0"
        />

        <Textarea
          variant="ghost"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={offProtocolNoteStrings.bodyPlaceholder}
          rows={3}
          className="leading-snug px-0"
        />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-n-100">
        <Button
          variant="secondary"
          size="sm"
          disabled={!body.trim() || isPending}
          onClick={() => onSave({ title: title.trim(), body: body.trim() })}
        >
          {offProtocolNoteStrings.convertToStepButton}
        </Button>

        <TextLink onClick={onCancel} size="md" className="ml-1">
          {offProtocolNoteStrings.cancelButton}
        </TextLink>

        <span className="text-overline text-n-400 ml-auto">
          {time} · {doctorName}
        </span>
      </div>
    </div>
  )
}
