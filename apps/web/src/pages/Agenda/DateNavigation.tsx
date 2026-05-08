import { Chip, IconButton, Row, TextLink } from '@/components/ui'
import { formatDate } from './helpers'

export interface DateNavigationProps {
  currentDate: Date
  isToday: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function DateNavigation({
  currentDate,
  isToday,
  onPrev,
  onNext,
  onToday,
}: DateNavigationProps): JSX.Element {
  return (
    <Row gap={3} className="mb-5">
      <IconButton
        icon="ph ph-caret-left"
        aria-label="Día anterior"
        tone="neutral"
        size="md"
        onClick={onPrev}
      />
      <IconButton
        icon="ph ph-caret-right"
        aria-label="Día siguiente"
        tone="neutral"
        size="md"
        onClick={onNext}
      />
      <Row gap={2}>
        <span className="text-[15px] font-semibold text-n-800">{formatDate(currentDate)}</span>
        {isToday && (
          <Chip tone="primarySolid" size="md" format="sentence">
            Hoy
          </Chip>
        )}
      </Row>
      {!isToday && (
        <TextLink tone="primary" size="lg" weight="medium" onClick={onToday} className="ml-1">
          Ir a hoy
        </TextLink>
      )}
    </Row>
  )
}
