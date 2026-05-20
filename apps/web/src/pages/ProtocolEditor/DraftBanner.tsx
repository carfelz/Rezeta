import { TextLink } from '@/components/ui'
import { protocolEditorStrings } from './strings'

export interface DraftBannerProps {
  onUse: () => void
  onDiscard: () => void
}

export function DraftBanner({ onUse, onDiscard }: DraftBannerProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 -mx-12 -mt-8 mb-6 px-12 py-3 bg-warning-bg border-b border-warning-border text-[12.5px] font-sans text-warning-text">
      <i className="ph ph-clock-counter-clockwise text-[14px]" />
      <span className="flex-1">{protocolEditorStrings.draftRecovered}</span>
      <TextLink tone="warning" size="md" weight="medium" underline="hover" onClick={onUse}>
        {protocolEditorStrings.draftUse}
      </TextLink>
      <TextLink
        tone="warning"
        size="md"
        underline="hover"
        onClick={onDiscard}
        className="opacity-70"
      >
        {protocolEditorStrings.draftDiscard}
      </TextLink>
    </div>
  )
}
