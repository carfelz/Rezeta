import { strings } from '@/lib/strings'
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
        <p className="text-[12px] font-sans text-n-400 italic px-2 py-3">
          {strings.EDITOR_TOC_EMPTY_SECTIONS}
        </p>
      ) : (
        sections.map((section, idx) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-[3px] text-[12.5px] font-sans text-n-500 hover:bg-n-50 hover:text-n-800 transition-colors duration-[100ms]"
          >
            <span className="font-mono text-[10.5px] text-n-400 min-w-[18px] shrink-0">
              {idx + 1}
            </span>
            <span className="truncate">
              {section.title || strings.EDITOR_SECTION_DEFAULT_TITLE}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
