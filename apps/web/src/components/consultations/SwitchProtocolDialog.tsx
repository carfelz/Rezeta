import { useState } from 'react'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { useSwitchProtocolUsage } from '@/hooks/consultations/use-consultations'
import { Button, DialogCard, ModalContent, SearchInput, SelectableCard } from '@/components/ui'
import { switchProtocolStrings } from './strings'

export interface SwitchProtocolDialogProps {
  consultationId: string
  currentUsageId: string
  currentProtocolId: string
  currentProtocolTitle: string
  completedSteps: number
  totalSteps: number
  onClose: () => void
}

export function SwitchProtocolDialog({
  consultationId,
  currentUsageId,
  currentProtocolId,
  currentProtocolTitle,
  completedSteps,
  totalSteps,
  onClose,
}: SwitchProtocolDialogProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keepDraft, setKeepDraft] = useState(true)
  const [search, setSearch] = useState('')

  const { useGetProtocols } = useProtocols()
  const { data: protocols = [] } = useGetProtocols({ status: 'active' })
  const switchMutation = useSwitchProtocolUsage(consultationId)

  const filtered = protocols.filter(
    (p) =>
      p.id !== currentProtocolId &&
      (search === '' || p.title.toLowerCase().includes(search.toLowerCase())),
  )
  const target = protocols.find((p) => p.id === selectedId)

  function handleSwitch(): void {
    if (!selectedId) return
    switchMutation.mutate(
      { usageId: currentUsageId, newProtocolId: selectedId },
      { onSuccess: onClose },
    )
  }

  return (
    <ModalContent className="w-[520px] p-0">
      <DialogCard
        width="lg"
        elevation="none"
        className="border-0 rounded"
        overline={switchProtocolStrings.overline}
        overlineTone="warning"
        title={
          target
            ? switchProtocolStrings.dialogTitle(currentProtocolTitle, target.title)
            : switchProtocolStrings.dialogTitleNoTarget(currentProtocolTitle)
        }
        description={
          target
            ? switchProtocolStrings.descriptionProgress(completedSteps, totalSteps)
            : switchProtocolStrings.descriptionNoTarget(completedSteps, totalSteps)
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              {switchProtocolStrings.cancelButton}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedId || switchMutation.isPending}
              onClick={handleSwitch}
            >
              {switchMutation.isPending
                ? switchProtocolStrings.switchingButton
                : switchProtocolStrings.switchButton}
            </Button>
          </>
        }
      >
        {!target && (
          <div className="flex flex-col gap-2">
            <SearchInput
              size="sm"
              placeholder={switchProtocolStrings.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-[12.5px] text-n-400 py-3 text-center">
                  {search
                    ? switchProtocolStrings.noResults
                    : switchProtocolStrings.noOtherProtocols}
                </p>
              ) : (
                filtered.map((p) => (
                  <SelectableCard key={p.id} density="compact" onClick={() => setSelectedId(p.id)}>
                    <i className="ph ph-stack text-[14px] text-n-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-n-800 truncate">{p.title}</div>
                      <div className="font-mono text-[11px] text-n-400">{p.typeName}</div>
                    </div>
                  </SelectableCard>
                ))
              )}
            </div>
          </div>
        )}

        {target && (
          <>
            <div className="border border-n-200 rounded-md p-4 flex flex-col gap-3 bg-n-25">
              <ImpactRow
                tone="kept"
                title={switchProtocolStrings.keptTitle}
                detail={switchProtocolStrings.keptDetail}
              />
              <ImpactRow
                tone="moved"
                title={switchProtocolStrings.movedTitle(completedSteps)}
                detail={switchProtocolStrings.movedDetail}
              />
              <ImpactRow
                tone="discarded"
                title={switchProtocolStrings.discardedTitle}
                detail={switchProtocolStrings.discardedDetail}
              />
            </div>
            <label className="flex items-center gap-2 mt-4 text-[12.5px] text-n-700 cursor-pointer">
              <input
                type="checkbox"
                checked={keepDraft}
                onChange={(e) => setKeepDraft(e.target.checked)}
                className="w-4 h-4 accent-p-500"
              />
              {switchProtocolStrings.keepDraftLabel(currentProtocolTitle)}
            </label>
          </>
        )}

        {switchMutation.isError && (
          <p className="text-[12px] text-danger-text mt-3">{switchProtocolStrings.errorMessage}</p>
        )}
      </DialogCard>
    </ModalContent>
  )
}

type ImpactTone = 'kept' | 'moved' | 'discarded'

function ImpactRow({
  tone,
  title,
  detail,
}: {
  tone: ImpactTone
  title: string
  detail: string
}): JSX.Element {
  const dotClass =
    tone === 'kept' ? 'bg-success-text' : tone === 'moved' ? 'bg-warning-text' : 'bg-danger-solid'
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden className={`mt-[6px] w-[6px] h-[6px] rounded-full shrink-0 ${dotClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-n-800">{title}</div>
        <div className="text-[12px] text-n-500 mt-px">{detail}</div>
      </div>
    </div>
  )
}
