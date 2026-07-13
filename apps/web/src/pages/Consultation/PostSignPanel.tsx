import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Overline } from '@/components/ui'
import { useUpdateInvoiceStatus } from '@/hooks/invoices/use-invoices'
import { useEnsureRecord } from '@/hooks/consultations/use-consultation-record'
import { formatCurrency } from '@/pages/Billing/helpers'
import { AppointmentFormModal } from '@/pages/Schedule/AppointmentFormModal'
import { toDateInputValue } from '@/pages/Schedule/helpers'
import type { ConsultationWithDetails, InvoiceOutcome, RecordOutcome } from '@rezeta/shared'
import { postSignPanelStrings } from './strings'

const BILLING_PATH = '/facturacion'
const LOCATIONS_SETTINGS_PATH = '/ajustes/ubicaciones'

const navLinkClass = 'text-xs font-sans text-p-500 hover:text-p-700 hover:underline'

export interface PostSignPanelProps {
  invoiceOutcome: InvoiceOutcome
  recordOutcome: RecordOutcome
  /**
   * The just-signed consultation. Currently unused by the invoice card, but
   * kept on the panel so Slice I can append a follow-up block that needs it.
   */
  consultation: ConsultationWithDetails
}

/**
 * Panel shown once — right after signing — surfacing the auto-invoice outcome.
 * Only rendered in the just-signed session; it is not part of the consultation
 * GET payload, so revisiting a signed consultation later shows no panel.
 *
 * Structured so Slice I can append a follow-up block below the invoice card.
 */
export function PostSignPanel({
  invoiceOutcome,
  recordOutcome,
  consultation,
}: PostSignPanelProps): JSX.Element {
  const [showFollowUp, setShowFollowUp] = useState(false)

  return (
    <div className="border border-n-200 rounded-md bg-n-0 p-5 mb-5">
      <Overline as="p" size="sm" className="mb-3">
        {postSignPanelStrings.header}
      </Overline>
      <InvoiceCard invoiceOutcome={invoiceOutcome} />

      <RecordCard recordOutcome={recordOutcome} consultation={consultation} />

      <div className="mt-4 flex items-center justify-between border-t border-n-100 pt-4">
        <div>
          <div className="text-base font-semibold text-n-800">
            {postSignPanelStrings.followUpHeading}
          </div>
          <div className="text-xs text-n-500">{postSignPanelStrings.followUpCaption}</div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowFollowUp(true)}>
          <i className="ph ph-calendar-plus" />
          {postSignPanelStrings.scheduleFollowUpButton}
        </Button>
      </div>

      {showFollowUp && (
        <AppointmentFormModal
          defaultDate={toDateInputValue(new Date())}
          defaultLocationId={consultation.locationId}
          defaultPatientId={consultation.patientId}
          onClose={() => setShowFollowUp(false)}
        />
      )}
    </div>
  )
}

function InvoiceCard({ invoiceOutcome }: { invoiceOutcome: InvoiceOutcome }): JSX.Element {
  if (invoiceOutcome.status === 'created') {
    return (
      <CreatedInvoiceCard
        invoiceId={invoiceOutcome.invoiceId}
        total={invoiceOutcome.total}
        currency={invoiceOutcome.currency}
      />
    )
  }

  if (invoiceOutcome.status === 'skipped_no_fee') {
    return (
      <Callout tone="info" icon="ph ph-info">
        <p className="m-0 mb-2">{postSignPanelStrings.skippedNoFeeMessage}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link to={LOCATIONS_SETTINGS_PATH} className={navLinkClass}>
            {postSignPanelStrings.configureFeeLink}
          </Link>
          <Link to={BILLING_PATH} className={navLinkClass}>
            {postSignPanelStrings.createManualLink}
          </Link>
        </div>
      </Callout>
    )
  }

  // status === 'failed'
  return (
    <Callout tone="danger" icon="ph ph-warning-circle">
      <p className="m-0 mb-2">{postSignPanelStrings.failedMessage}</p>
      <Link to={BILLING_PATH} className={navLinkClass}>
        {postSignPanelStrings.createManualLink}
      </Link>
    </Callout>
  )
}

function RecordCard({
  recordOutcome,
  consultation,
}: {
  recordOutcome: RecordOutcome
  consultation: ConsultationWithDetails
}): JSX.Element {
  const [outcome, setOutcome] = useState(recordOutcome)
  const ensure = useEnsureRecord()

  return (
    <div className="mt-4 flex items-center justify-between border-t border-n-100 pt-4">
      <div>
        <div className="text-base font-semibold text-n-800">
          {postSignPanelStrings.historiaHeading}
        </div>
        <div className="text-xs text-n-500">
          {outcome.status === 'created'
            ? postSignPanelStrings.historiaCreated
            : postSignPanelStrings.historiaFailed}
        </div>
      </div>
      {outcome.status === 'created' ? (
        <Link to={`/pacientes/${consultation.patientId}`} className={navLinkClass}>
          {postSignPanelStrings.historiaOpen}
        </Link>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => ensure.mutate(consultation.id, { onSuccess: (record) => setOutcome({ status: 'created', recordId: record.id }) })}
          disabled={ensure.isPending}
        >
          {postSignPanelStrings.historiaRetry}
        </Button>
      )}
    </div>
  )
}

function CreatedInvoiceCard({
  invoiceId,
  total,
  currency,
}: {
  invoiceId: string
  total: number
  currency: string
}): JSX.Element {
  const [issued, setIssued] = useState(false)
  const updateStatus = useUpdateInvoiceStatus(invoiceId)

  function handleIssue(): void {
    void updateStatus
      .mutateAsync({ status: 'issued' })
      .then(() => setIssued(true))
      .catch(() => undefined)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-n-700">
        <i className="ph ph-receipt text-body-lg text-p-500" />
        <span>{postSignPanelStrings.invoiceCreatedLabel(formatCurrency(total, currency))}</span>
      </div>
      <div className="flex items-center gap-3">
        {issued ? (
          <span className="flex items-center gap-1.5 text-sm text-success-text">
            <i className="ph ph-check-circle text-base" />
            {postSignPanelStrings.issuedLabel}
          </span>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleIssue}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending
              ? postSignPanelStrings.issuingButton
              : postSignPanelStrings.issueButton}
          </Button>
        )}
        <Link to={BILLING_PATH} className={navLinkClass}>
          {postSignPanelStrings.viewInBillingLink}
        </Link>
      </div>
    </div>
  )
}
