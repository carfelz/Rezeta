import { TextLink } from '@/components/ui'
import { strings } from '@/lib/strings'
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
      <h4 className="text-[11.5px] font-sans font-semibold text-n-700 mb-3">
        {strings.EDITOR_PALETTE_HEADER}
      </h4>
      <div className="flex flex-col gap-2 mb-6">
        {PALETTE_ITEMS.map(({ type, icon, label, active }) =>
          active ? (
            <button
              key={type}
              onClick={() => onPaletteClick(type)}
              className="flex items-center gap-3 px-3 py-2 border border-n-200 rounded-[3px] bg-n-0 text-[12.5px] font-sans text-n-700 hover:border-n-400 hover:bg-n-25 transition-colors duration-[100ms] cursor-pointer text-left"
            >
              <i className={`ph ${icon} text-p-500 text-[16px] shrink-0`} />
              {label}
            </button>
          ) : (
            <div
              key={type}
              title={strings.EDITOR_PALETTE_DISABLED_TOOLTIP}
              className="flex items-center gap-3 px-3 py-2 border border-n-200 rounded-[3px] bg-n-50 text-[12.5px] font-sans text-n-400 cursor-not-allowed"
            >
              <i className={`ph ${icon} text-n-300 text-[16px] shrink-0`} />
              {label}
            </div>
          ),
        )}
      </div>

      <h4 className="text-[11.5px] font-sans font-semibold text-n-700 mb-3">
        {strings.EDITOR_HISTORY_BUTTON}
      </h4>
      {historyLoading ? (
        <div className="flex justify-center py-3">
          <i className="ph ph-spinner animate-spin text-[18px] text-n-400" />
        </div>
      ) : !versionHistory || versionHistory.length === 0 ? (
        <p className="text-[12px] font-sans text-n-400 italic">{strings.EDITOR_HISTORY_EMPTY}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {versionHistory.slice(0, 3).map((v) => (
            <div key={v.id} className="text-[12px] font-sans text-n-500">
              <span className="font-semibold text-n-800">
                {strings.EDITOR_VERSION(v.versionNumber)}
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
            {strings.EDITOR_HISTORY_VIEW_ALL}
          </TextLink>
        </div>
      )}
    </div>
  )
}
