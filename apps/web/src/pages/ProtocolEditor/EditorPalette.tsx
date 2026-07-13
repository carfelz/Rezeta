import { Button, Spinner, TextLink } from '@/components/ui'
import { protocolEditorStrings } from './strings'
import type { VersionListItem } from '@rezeta/shared'
import { PALETTE_ITEMS } from './block-factory'

export interface EditorPaletteProps {
  onPaletteClick: (type: string) => void
  versionHistory: VersionListItem[] | undefined
  historyLoading: boolean
  onShowFullHistory: () => void
}

export function EditorPalette({
  onPaletteClick,
  versionHistory,
  historyLoading,
  onShowFullHistory,
}: EditorPaletteProps): JSX.Element {
  return (
    <div
      style={{
        position: 'sticky',
        top: 'calc(var(--layout-topbar-height) + 24px)',
        maxHeight: 'calc(100vh - var(--layout-topbar-height) - 48px)',
        overflowY: 'auto',
      }}
    >
      <h4 className="text-overline font-sans font-semibold text-n-700 mb-3">
        {protocolEditorStrings.paletteHeader}
      </h4>
      <div className="flex flex-col gap-2 mb-6">
        {PALETTE_ITEMS.map(({ type, icon, label, active }) =>
          active ? (
            <Button
              key={type}
              variant="item"
              size="sm"
              onClick={() => onPaletteClick(type)}
              className="flex items-center gap-3 w-full px-3 py-2 text-left"
            >
              <i className={`ph ${icon} text-p-500 text-body-lg shrink-0`} />
              {label}
            </Button>
          ) : (
            <div
              key={type}
              title={protocolEditorStrings.paletteDisabledTooltip}
              className="flex items-center gap-3 px-3 py-2 border border-n-200 rounded-[3px] bg-n-50 text-xs font-sans text-n-400 cursor-not-allowed"
            >
              <i className={`ph ${icon} text-n-300 text-body-lg shrink-0`} />
              {label}
            </div>
          ),
        )}
      </div>

      <h4 className="text-overline font-sans font-semibold text-n-700 mb-3">
        {protocolEditorStrings.historyButton}
      </h4>
      {historyLoading ? (
        <div className="flex justify-center py-3">
          <Spinner size="md" className="text-n-400" />
        </div>
      ) : !versionHistory || versionHistory.length === 0 ? (
        <p className="text-xs font-sans text-n-400 italic">
          {protocolEditorStrings.historyEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {versionHistory.slice(0, 3).map((v) => (
            <div key={v.id} className="text-xs font-sans text-n-500">
              <span className="font-semibold text-n-800">
                {protocolEditorStrings.version(v.versionNumber)}
              </span>
              {' · '}
              {new Date(v.createdAt).toLocaleDateString('es-DO', {
                day: 'numeric',
                month: 'short',
              })}
              {v.changeSummary && (
                <span className="text-n-400 block truncate mt-1">{v.changeSummary}</span>
              )}
            </div>
          ))}
          <TextLink tone="primary" size="md" onClick={onShowFullHistory} className="mt-1">
            {protocolEditorStrings.historyViewAll}
          </TextLink>
        </div>
      )}
    </div>
  )
}
