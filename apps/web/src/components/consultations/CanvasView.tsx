import { Button, Overline } from '@/components/ui'
import {
  BlockRendererRunMode,
  type BlockModificationEvent,
} from '@/components/protocols/BlockRendererRunMode'
import type { ConsultationProtocolUsage } from '@rezeta/shared'
import { deriveCheckedState } from '@/lib/consultation/usage'
import type { ContentEdit } from '@/lib/consultation/content-edits'
import { canvasViewStrings } from './strings'

export type { BlockModificationEvent }

export interface CanvasViewProps {
  usage: ConsultationProtocolUsage
  onCheck: (id: string, checked: boolean) => void
  onLaunchLinkedProtocol?: (protocolId: string, triggerBlockId: string) => void
  onModification?: (event: BlockModificationEvent) => void
  onContentEdit?: (blockId: string, edit: ContentEdit) => void
  isSigned: boolean
  onContinueWithoutProtocol?: () => void
  onEditProtocol?: () => void
}

export function CanvasView({
  usage,
  onCheck,
  onLaunchLinkedProtocol,
  onModification,
  onContentEdit,
  isSigned,
  onContinueWithoutProtocol,
  onEditProtocol,
}: CanvasViewProps): JSX.Element {
  const blocks = usage.content?.blocks ?? []
  const checkedState = deriveCheckedState(usage)

  if (blocks.length === 0) {
    return (
      <div className="bg-n-0 border border-dashed border-n-200 rounded-md px-8 py-12 text-center flex flex-col items-center gap-3">
        <Overline tone="warning" size="md">
          {canvasViewStrings.emptyProtocolOverline}
        </Overline>
        <h2 className="font-serif font-medium text-h2 text-n-900 leading-tight tracking-[-0.01em] m-0">
          {canvasViewStrings.emptyProtocolHeading}
        </h2>
        <p className="text-sm text-n-500 max-w-[440px] leading-snug">
          {canvasViewStrings.emptyProtocolDescription}
        </p>
        {(onContinueWithoutProtocol || onEditProtocol) && (
          <div className="flex items-center gap-2 mt-2">
            {onContinueWithoutProtocol && (
              <Button variant="ghost" size="sm" onClick={onContinueWithoutProtocol}>
                {canvasViewStrings.continueWithoutProtocol}
              </Button>
            )}
            {onEditProtocol && (
              <Button variant="primary" size="sm" onClick={onEditProtocol}>
                {canvasViewStrings.editProtocol}
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {blocks.map((block) => (
        <BlockRendererRunMode
          key={(block as { id: string }).id}
          block={block}
          runMode={{
            checkedState,
            onCheck,
            isSigned,
            ...(onLaunchLinkedProtocol ? { onLaunchLinkedProtocol } : {}),
            ...(onModification ? { onModification } : {}),
            ...(onContentEdit ? { onContentEdit } : {}),
          }}
        />
      ))}
    </div>
  )
}
