import { useRef } from 'react'
import { Badge, Button, Input, Spinner } from '@/components/ui'
import { protocolEditorStrings } from './strings'
import { formatRelativeTime, statusToBadgeVariant, labelForProtocolStatus } from './helpers'

export interface EditorHeaderProps {
  title: string
  typeName: string | null
  updatedAt: string
  totalBlocks: number
  sectionCount: number
  status: string
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
  status,
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
        <div className="text-overline font-mono uppercase tracking-label-wide text-n-400 mb-2">
          {[typeName, formatRelativeTime(updatedAt)].filter(Boolean).join(' · ')}
        </div>

        {editingTitle ? (
          <Input
            ref={titleInputRef}
            variant="ghost"
            value={titleDraft}
            autoFocus
            onChange={(e) => onTitleDraftChange(e.target.value)}
            onBlur={onCommitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitTitle()
              if (e.key === 'Escape') onCancelTitleEdit()
            }}
            className="text-h2 font-serif font-medium text-n-900 pb-1 mb-2 leading-tight border-b-2 border-p-500"
            disabled={isRenaming}
          />
        ) : (
          <h1
            onClick={onStartEditing}
            className="text-h2 font-serif font-medium text-n-900 mb-2 cursor-pointer hover:text-p-700 transition-colors duration-fast leading-tight"
            title={protocolEditorStrings.titleRenameTooltip}
          >
            {title}
          </h1>
        )}

        <p className="text-sm font-sans text-n-500">
          {protocolEditorStrings.blockCount(totalBlocks)}
          {sectionCount > 0 && ` · ${protocolEditorStrings.sectionCount(sectionCount)}`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 pt-1">
        <Badge variant={statusToBadgeVariant(status)}>{labelForProtocolStatus(status)}</Badge>
        {isDirty && <Badge variant="review">{protocolEditorStrings.unsaved}</Badge>}
        <Button variant="secondary" size="sm" onClick={onPreview}>
          <i className="ph ph-eye mr-2" />
          {protocolEditorStrings.preview}
        </Button>
        <Button variant="secondary" size="sm" onClick={onSaveDraft} disabled={isSaving}>
          {isSaving ? (
            <>
              <Spinner className="mr-2" decorative size="sm" />
              {protocolEditorStrings.saving}
            </>
          ) : (
            protocolEditorStrings.save
          )}
        </Button>
        <Button variant="primary" size="sm" onClick={onPublishClick} disabled={isSaving}>
          {isSaving ? (
            <>
              <Spinner className="mr-2" decorative size="sm" />
              {protocolEditorStrings.publishing}
            </>
          ) : (
            <>
              <i className="ph ph-check mr-2" />
              {protocolEditorStrings.publish(nextPublishVersion)}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
