import type { ReactNode } from 'react'
import { Breadcrumbs, Overline, Row, Stack, type BreadcrumbItem } from '@/components/ui'

export type { BreadcrumbItem }

export interface ConsultHeaderProps {
  breadcrumbs: BreadcrumbItem[]
  datetimeOverline: string
  title: string
  subtitle?: string
  rightSlot?: ReactNode
}

export function ConsultHeader({
  breadcrumbs,
  datetimeOverline,
  title,
  subtitle,
  rightSlot,
}: ConsultHeaderProps): JSX.Element {
  return (
    <Row align="end" justify="between" gap={6} className="pb-6 border-b border-n-100">
      <Stack gap={2} className="min-w-0 flex-1">
        <Breadcrumbs items={breadcrumbs} />
        <Overline tone="neutral" size="md">
          {datetimeOverline}
        </Overline>
        <h1 className="font-serif font-medium text-[34px] text-n-900 leading-tight tracking-[-0.015em]">
          {title}
        </h1>
        {subtitle && <p className="text-[13.5px] text-n-500">{subtitle}</p>}
      </Stack>

      {rightSlot && (
        <Row gap={2} className="shrink-0">
          {rightSlot}
        </Row>
      )}
    </Row>
  )
}
