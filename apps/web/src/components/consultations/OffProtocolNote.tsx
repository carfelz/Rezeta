import { useState } from 'react'
import { Button, Chip, TextLink } from '@/components/ui'

export type SoapField = 'subjective' | 'objective' | 'assessment' | 'plan'

export interface OffProtocolNoteProps {
  onSave: (params: { title: string; body: string; promoteTo: SoapField | null }) => void
  onCancel: () => void
  isPending?: boolean
}

const SOAP_FIELD_LABELS: Record<SoapField, string> = {
  subjective: 'Subjetivo',
  objective: 'Examen físico',
  assessment: 'Evaluación',
  plan: 'Plan',
}

export function OffProtocolNote({
  onSave,
  onCancel,
  isPending = false,
}: OffProtocolNoteProps): JSX.Element {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [promoteTo, setPromoteTo] = useState<SoapField | null>(null)

  const now = new Date()
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="bg-n-0 border border-warning-border rounded-md overflow-hidden">
      <div className="px-4 pt-3 pb-3">
        <div className="mb-3">
          <Chip tone="warning" size="md">
            Fuera de protocolo
          </Chip>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del hallazgo (ej. Dolor torácico atípico)"
          className="w-full font-serif font-medium text-[18px] text-n-900 leading-tight bg-transparent border-0 focus:outline-none placeholder:text-n-300 mb-2"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe el hallazgo. Anexar a SOAP → [campo]."
          rows={3}
          className="w-full text-[13px] font-sans text-n-700 placeholder:text-n-300 bg-transparent border-0 focus:outline-none resize-none leading-snug"
        />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-n-100">
        <Button
          variant="secondary"
          size="sm"
          disabled={!body.trim() || isPending}
          onClick={() => onSave({ title: title.trim(), body: body.trim(), promoteTo: null })}
        >
          Convertir en paso
        </Button>

        <SoapMover
          selected={promoteTo}
          onSelect={setPromoteTo}
          onConfirm={(field) =>
            onSave({ title: title.trim(), body: body.trim(), promoteTo: field })
          }
          disabled={!body.trim() || isPending}
        />

        <TextLink onClick={onCancel} size="md" className="ml-1">
          Cancelar
        </TextLink>

        <span className="text-[11.5px] text-n-400 ml-auto">{time} · Dr. García</span>
      </div>
    </div>
  )
}

function SoapMover({
  selected,
  onSelect,
  onConfirm,
  disabled,
}: {
  selected: SoapField | null
  onSelect: (field: SoapField | null) => void
  onConfirm: (field: SoapField) => void
  disabled: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => setOpen((o) => !o)}>
        Mover a {selected ? SOAP_FIELD_LABELS[selected] : 'SOAP'}
      </Button>
      {open && !disabled && (
        <div className="absolute left-0 bottom-full mb-1 bg-n-0 border border-n-200 rounded-md shadow-floating w-[160px] py-1 z-30">
          {(Object.keys(SOAP_FIELD_LABELS) as SoapField[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                onSelect(f)
                setOpen(false)
                onConfirm(f)
              }}
              className="block w-full text-left px-3 py-2 text-[12.5px] text-n-700 hover:bg-n-25 transition-colors"
            >
              {SOAP_FIELD_LABELS[f]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
