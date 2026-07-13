import { Button, Callout, Chip, IconButton, TextLink } from '@/components/ui'
import { missingFieldsStrings } from './strings'

export interface MissingField {
  id: string
  label: string
  /**
   * Optional path-style breadcrumb shown under the label in mono caption,
   * e.g. `Vitales · Temperatura`.
   */
  description?: string
}

// ─── Inline callout (body) ──────────────────────────────────────────────────────

export interface MissingFieldsCalloutProps {
  count: number
  onJumpFirst: () => void
  onShowList: () => void
}

export function MissingFieldsCallout({
  count,
  onJumpFirst,
  onShowList,
}: MissingFieldsCalloutProps): JSX.Element {
  return (
    <Callout tone="danger" icon="ph ph-warning-circle" title={missingFieldsStrings.calloutTitle}>
      <div className="flex items-center gap-3">
        <TextLink tone="danger" size="md" underline="hover" onClick={onJumpFirst}>
          {missingFieldsStrings.calloutLink(count)}
        </TextLink>
        <Button variant="secondary" size="sm" onClick={onShowList} className="ml-auto">
          {missingFieldsStrings.calloutShowList}
        </Button>
      </div>
    </Callout>
  )
}

// ─── Page-level panel ──────────────────────────────────────────────────────────

export interface MissingFieldsPanelProps {
  fields: MissingField[]
  onDismiss?: () => void
  /**
   * When true, the panel renders nothing — signed consultations don't surface
   * the missing-fields workflow.
   */
  isSigned?: boolean
  /**
   * Optional handler that triggers the sign flow. When provided and no fields
   * are missing on a non-signed consultation, the panel renders a green
   * "Listo" callout with a primary "Firmar y cerrar" button.
   */
  onSign?: () => void
}

export function MissingFieldsPanel({
  fields,
  onDismiss,
  isSigned = false,
  onSign,
}: MissingFieldsPanelProps): JSX.Element | null {
  if (isSigned) return null

  if (fields.length === 0) {
    if (!onSign) return null
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-success-bg border border-success-border rounded-md">
        <div className="flex items-center gap-2 text-success-text">
          <i className="ph ph-check-circle text-body-lg" aria-hidden />
          <p className="text-xs font-medium leading-tight">
            {missingFieldsStrings.readyMessage}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onSign}>
          {missingFieldsStrings.signButton}
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-n-0 border border-danger-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-danger-text">
          {missingFieldsStrings.panelTitle(fields.length)}
        </span>
        {onDismiss && (
          <IconButton
            icon="ph ph-x"
            aria-label={missingFieldsStrings.panelClosePanelLabel}
            tone="neutral"
            onClick={onDismiss}
          />
        )}
      </div>
      <p className="px-4 pb-3 text-xs text-n-500 leading-snug">
        {missingFieldsStrings.panelDescription}
      </p>
      <ul className="flex flex-col gap-2 px-3 pb-3 list-none m-0">
        {fields.map((field) => (
          <li
            key={field.id}
            className="flex items-center gap-3 px-3 py-2 rounded-sm bg-danger-bg/40"
          >
            <i className="ph ph-circle text-xs text-danger-text shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-danger-text truncate">
                {field.label}
              </div>
              {field.description && (
                <div className="text-2xs font-mono uppercase tracking-[0.08em] text-danger-text/70 mt-0.5 truncate">
                  {field.description}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Required field badge (inline) ─────────────────────────────────────────────

export function RequiredBadge(): JSX.Element {
  return (
    <Chip tone="warning" size="xs">
      {missingFieldsStrings.requiredBadge}
    </Chip>
  )
}
