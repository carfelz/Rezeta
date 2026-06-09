import type { FC } from 'react'

type ClinicalNotesBlockProps = {
  label: string
  content: string
  required?: boolean
  readOnly?: boolean
  onChange?: (content: string) => void
}

export const ClinicalNotesBlock: FC<ClinicalNotesBlockProps> = ({
  label,
  content,
  required,
  readOnly,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-n-700">{label}</span>
        {required && <span className="text-xs text-danger-text">*</span>}
      </div>
      <textarea
        className="w-full min-h-[120px] px-3 py-2 rounded-sm border border-n-200 bg-n-0 text-n-900 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-p-400 disabled:bg-n-50"
        value={content}
        disabled={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={readOnly ? '' : `Escribir ${label.toLowerCase()}…`}
      />
    </div>
  )
}
