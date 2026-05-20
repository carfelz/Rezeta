import { Button, Overline } from '@/components/ui'
import { BlockRendererRunMode, type SoapField } from '@/components/protocols/BlockRendererRunMode'
import type { ConsultationProtocolUsage } from '@rezeta/shared'
import { canvasViewStrings } from './strings'

export type { SoapField }

export interface CanvasViewProps {
  usage: ConsultationProtocolUsage
  onCheck: (id: string, checked: boolean) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  onLaunchLinkedProtocol?: (protocolId: string, triggerBlockId: string) => void
  isSigned: boolean
  onContinueWithoutProtocol?: () => void
  onEditProtocol?: () => void
}

export function CanvasView({
  usage,
  onCheck,
  onAutoPopulate,
  onLaunchLinkedProtocol,
  isSigned,
  onContinueWithoutProtocol,
  onEditProtocol,
}: CanvasViewProps): JSX.Element {
  const blocks = usage.content?.blocks ?? []
  const checkedState = usage.checkedState ?? {}

  if (blocks.length === 0) {
    return (
      <div className="bg-n-0 border border-dashed border-n-200 rounded-md px-8 py-12 text-center flex flex-col items-center gap-3">
        <Overline tone="warning" size="md">
          {canvasViewStrings.emptyProtocolOverline}
        </Overline>
        <h2 className="font-serif font-medium text-[24px] text-n-900 leading-tight tracking-[-0.01em] m-0">
          {canvasViewStrings.emptyProtocolHeading}
        </h2>
        <p className="text-[13px] text-n-500 max-w-[440px] leading-snug">
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
            ...(onAutoPopulate ? { onAutoPopulate } : {}),
            ...(onLaunchLinkedProtocol ? { onLaunchLinkedProtocol } : {}),
          }}
        />
      ))}
    </div>
  )
}
