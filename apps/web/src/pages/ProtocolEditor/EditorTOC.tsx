import { Button } from '@/components/ui'
import { protocolEditorStrings } from './strings'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

type SectionBlock = Extract<ProtocolBlock, { type: 'section' }>

export interface EditorTOCProps {
  sections: SectionBlock[]
  onSectionClick: (sectionId: string) => void
}

export function EditorTOC({ sections, onSectionClick }: EditorTOCProps): JSX.Element {
  return (
    <div
      style={{
        position: 'sticky',
        top: 'calc(var(--layout-topbar-height) + 24px)',
        maxHeight: 'calc(100vh - var(--layout-topbar-height) - 48px)',
        overflowY: 'auto',
      }}
    >
      {sections.length === 0 ? (
        <p className="text-xs font-sans text-n-400 italic px-2 py-3">
          {protocolEditorStrings.tocEmptySections}
        </p>
      ) : (
        sections.map((section, idx) => (
          <Button
            key={section.id}
            variant="item"
            size="sm"
            onClick={() => onSectionClick(section.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-sm"
          >
            <span className="font-mono text-2xs text-n-400 min-w-4.5 shrink-0">
              {idx + 1}
            </span>
            <span className="truncate">
              {section.title || protocolEditorStrings.sectionDefaultTitle}
            </span>
          </Button>
        ))
      )}
    </div>
  )
}
