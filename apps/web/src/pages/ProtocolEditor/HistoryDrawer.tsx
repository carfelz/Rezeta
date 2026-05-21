import { IconButton } from '@/components/ui'
import { BlockRenderer } from '@/components/protocols/BlockRenderer'
import { protocolEditorStrings } from './strings'
import type { VersionDetailResponse, VersionListItem } from '@rezeta/shared'

export interface HistoryDrawerProps {
  versionHistory: VersionListItem[] | undefined
  historyLoading: boolean
  selectedVersionId: string | null
  selectedVersion: VersionDetailResponse | undefined
  versionPreviewLoading: boolean
  onSelectVersion: (id: string | null) => void
  onClose: () => void
  onRestore: (versionId: string) => void
  isRestoring: boolean
}

export function HistoryDrawer({
  versionHistory,
  historyLoading,
  selectedVersionId,
  selectedVersion,
  versionPreviewLoading,
  onSelectVersion,
  onClose,
  onRestore,
  isRestoring,
}: HistoryDrawerProps): JSX.Element {
  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-[380px] bg-n-0 border-l border-n-200 flex flex-col z-50"
      style={{
        boxShadow: '0 1px 0 rgba(14,14,13,.04), -8px 0 24px -8px rgba(14,14,13,.10)',
      }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-n-200 shrink-0">
        <span className="text-[13.5px] font-sans font-semibold text-n-800">
          {protocolEditorStrings.historyTitle}
        </span>
        <IconButton
          icon="ph ph-x"
          aria-label={protocolEditorStrings.historyCloseLabel}
          tone="neutral"
          size="sm"
          onClick={onClose}
        />
      </div>

      <div className="flex flex-col overflow-y-auto shrink-0 max-h-[260px] border-b border-n-200">
        {historyLoading ? (
          <div className="flex justify-center py-6">
            <i className="ph ph-spinner animate-spin text-[20px] text-n-400" />
          </div>
        ) : !versionHistory || versionHistory.length === 0 ? (
          <p className="text-[12.5px] font-sans text-n-400 text-center py-6">
            {protocolEditorStrings.historyEmpty}
          </p>
        ) : (
          versionHistory.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-2 px-5 py-3 border-b border-n-100 last:border-0 ${
                selectedVersionId === v.id ? 'bg-p-50' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectVersion(v.id === selectedVersionId ? null : v.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <span className="text-[12.5px] font-mono font-medium text-n-800 shrink-0">
                  {protocolEditorStrings.version(v.versionNumber)}
                </span>
                {v.isCurrent && (
                  <span className="text-[10.5px] font-mono text-p-700 bg-p-50 border border-p-100 rounded px-2 py-1 shrink-0">
                    {protocolEditorStrings.historyCurrent}
                  </span>
                )}
                <span className="flex-1 text-[12px] font-sans text-n-500 truncate">
                  {v.changeSummary ?? protocolEditorStrings.historyNoSummary}
                </span>
                <span className="text-[11px] font-mono text-n-400 shrink-0">
                  {new Date(v.createdAt).toLocaleDateString('es-DO', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </button>
              {!v.isCurrent && (
                <IconButton
                  icon="ph ph-clock-counter-clockwise"
                  aria-label={protocolEditorStrings.historyRestore}
                  tone="neutral"
                  size="sm"
                  disabled={isRestoring}
                  onClick={() => onRestore(v.id)}
                />
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedVersionId ? (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-[12.5px] font-sans text-n-400 text-center">
              {protocolEditorStrings.historySelectPrompt}
            </p>
          </div>
        ) : versionPreviewLoading ? (
          <div className="flex justify-center py-8">
            <i className="ph ph-spinner animate-spin text-[20px] text-n-400" />
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.10em] text-n-400 mb-1">
              {protocolEditorStrings.historyPreviewTitle}
            </div>
            {selectedVersion?.content.blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
