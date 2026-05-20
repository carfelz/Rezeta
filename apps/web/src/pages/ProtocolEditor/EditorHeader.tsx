import { useRef } from 'react'
import { Badge, Button } from '@/components/ui'
import { protocolEditorStrings } from './strings'
import { formatRelativeTime } from './helpers'

export interface EditorHeaderProps {
  title: string
  typeName: string
  updatedAt: string
  totalBlocks: number
  sectionCount: number
  isDirty: boolean
  isSaving: boolean
  isRenaming: boolean
  editingTitle: boolean
  titleDraft: string
  onTitleDraftChange: (v: string) => void
  onStartEditing: () => void
  onCommitTitle: () => void
  onCancelTitleEdit: () => void
  nextPublishVersion: number
  onPreview: () => void
  onSaveDraft: () => void
  onPublishClick: () => void
}

export function EditorHeader({
  title,
  typeName,
  updatedAt,
  totalBlocks,
  sectionCount,
  isDirty,
  isSaving,
  isRenaming,
  editingTitle,
  titleDraft,
  onTitleDraftChange,
  onStartEditing,
  onCommitTitle,
  onCancelTitleEdit,
  nextPublishVersion,
  onPreview,
  onSaveDraft,
  onPublishClick,
}: EditorHeaderProps): JSX.Element {
  const titleInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-start gap-6 mb-6">
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
          {[typeName, formatRelativeTime(updatedAt)].filter(Boolean).join(' · ')}
        </div>

        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            autoFocus
            onChange={(e) => onTitleDraftChange(e.target.value)}
            onBlur={onCommitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitTitle()
              if (e.key === 'Escape') onCancelTitleEdit()
            }}
            className="text-[28px] font-serif font-medium text-n-900 bg-transparent border-b-2 border-p-500 outline-none w-full pb-1 mb-2 leading-tight"
            disabled={isRenaming}
          />
        ) : (
          <h1
            onClick={onStartEditing}
            className="text-[28px] font-serif font-medium text-n-900 mb-2 cursor-pointer hover:text-p-700 transition-colors duration-[100ms] leading-tight"
            title="Haz clic para renombrar"
          >
            {title}
          </h1>
        )}

        <p className="text-[13px] font-sans text-n-500">
          {totalBlocks} {totalBlocks === 1 ? 'bloque' : 'bloques'}
          {sectionCount > 0 && ` · ${sectionCount} ${sectionCount === 1 ? 'sección' : 'secciones'}`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 pt-1">
        {isDirty && <Badge variant="review">{protocolEditorStrings.unsavedChanges}</Badge>}
        <Button variant="secondary" size="sm" onClick={onPreview}>
          <i className="ph ph-eye mr-2" />
          {protocolEditorStrings.preview}
        </Button>
        <Button variant="secondary" size="sm" onClick={onSaveDraft} disabled={isSaving}>
          {isSaving ? <i className="ph ph-spinner animate-spin mr-2" /> : null}
          {protocolEditorStrings.save}
        </Button>
        <Button variant="primary" size="sm" onClick={onPublishClick} disabled={isSaving}>
          <i className="ph ph-check mr-2" />
          {protocolEditorStrings.publish(nextPublishVersion)}
        </Button>
      </div>
    </div>
  )
}
