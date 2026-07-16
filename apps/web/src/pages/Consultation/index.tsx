import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConsultation } from '@/hooks/consultations/use-consultations'
import { usePendingModifications } from '@/hooks/consultations/use-pending-modifications'
import { Button, Spinner } from '@/components/ui'
import { useOrderQueueStore } from '@/store/order-queue.store'
import { useOrderQueueSession } from '@/hooks/consultations/use-order-queue-session'
import { useFlushOrderQueue } from '@/hooks/consultations/use-flush-order-queue'
import { useBeforeUnloadGuard } from '@/hooks/use-before-unload-guard'
import { useCan } from '@/hooks/use-can'
import { MissingFieldsPanel } from '@/components/consultations/MissingFieldsPanel'
import { Breadcrumb } from './Breadcrumb'
import { PageHeader } from './PageHeader'
import { SignedBanner } from './SignedBanner'
import { PostSignPanel } from './PostSignPanel'
import { AmendmentsBanner } from './AmendmentsBanner'
import { ProtocolPanel } from './ProtocolPanel'
import { OrdersRail } from './OrdersRail'
import { formatBreadcrumbDate } from '@/lib/format/dates'
import { consultationPageStrings } from './strings'
import { computeMissingRequiredFields } from '@rezeta/shared'
import type { SignConsultationResponse } from '@rezeta/shared'

export function Consultation(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: serverConsultation, isLoading, isError } = useConsultation(id!)
  const {
    hasPending,
    record: recordModification,
    withPending,
    flush: flushPendingModifications,
    discardUsage,
    recordContentEdit,
  } = usePendingModifications(id!)
  // Server truth + not-yet-persisted modification deltas. Everything below
  // renders from this merged view so batched edits show up immediately.
  const consultation = serverConsultation ? withPending(serverConsultation) : serverConsultation

  const [showMissingFields, setShowMissingFields] = useState(false)
  const [showSign, setShowSign] = useState(false)
  const [showAmend, setShowAmend] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  // Sign response (incl. invoice outcome) captured for the just-signed session
  // only — it is not part of the consultation GET payload, so revisiting a
  // signed consultation later shows the banner without the post-sign panel.
  const [signResult, setSignResult] = useState<SignConsultationResponse | null>(null)

  const missingFields = computeMissingRequiredFields(consultation?.protocolUsages ?? [])

  const consultationSigned = consultation?.status === 'signed'
  const hasUnsavedOrders = useOrderQueueStore(
    (s) => s.medications.length > 0 || s.imagingOrders.length > 0 || s.labOrders.length > 0,
  )
  const resetOrderQueue = useOrderQueueStore((s) => s.reset)
  const { flush: flushOrderQueue } = useFlushOrderQueue(id ?? '')
  useOrderQueueSession(id ?? '', consultationSigned)

  // Sign-time flush: persist pending protocol modifications first, then the
  // in-memory order queue. Either failing aborts the sign so an immutable
  // record is never created from partially-saved content.
  async function handleBeforeSign(): Promise<boolean> {
    const modificationsPersisted = await flushPendingModifications()
    if (!modificationsPersisted) return false
    return flushOrderQueue()
  }

  // Clear the in-memory queue on a successful sign so a stale entry cannot
  // produce a "Recetas 1" chip against an empty saved-orders list.
  function handleSigned(result: SignConsultationResponse): void {
    setSignResult(result)
    resetOrderQueue()
  }
  useBeforeUnloadGuard((hasUnsavedOrders || hasPending) && !consultationSigned)
  // Read before the early returns below so this hook is always called in the
  // same order regardless of loading/error state (Rules of Hooks).
  const canManageConsultations = useCan('consultations', 'manage')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-300">
        <div className="text-sm text-n-500 flex items-center gap-2">
          <Spinner decorative size="sm" /> {consultationPageStrings.loading}
        </div>
      </div>
    )
  }

  if (isError || !consultation) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <i className="ph ph-warning text-h2 text-n-300 mb-3" />
        <p className="text-base text-n-600 mb-4">{consultationPageStrings.loadError}</p>
        <Button variant="secondary" onClick={() => void navigate(-1)}>
          {consultationPageStrings.backButton}
        </Button>
      </div>
    )
  }

  const isSigned = consultationSigned
  const readOnly = isSigned || !canManageConsultations
  const canSign = consultation.protocolUsages.length > 0
  const dateShort = formatBreadcrumbDate(new Date(consultation.startedAt))
  const hasContent = consultation.protocolUsages.length > 0
  const pageTitle = isSigned
    ? `Consulta del ${dateShort} · firmada`
    : hasContent
      ? `Consulta del ${dateShort}`
      : 'Nueva consulta'

  function handleSignClick(): void {
    if (missingFields.length > 0) {
      setShowMissingFields(true)
      return
    }
    setShowSign(true)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Zone 1: Header — never scrolls */}
      <div className="shrink-0 px-8 pt-6 pb-0">
        <Breadcrumb patientName={consultation.patientName} consultedAt={consultation.startedAt} />
        <PageHeader
          consultedAt={consultation.startedAt}
          locationName={consultation.locationName}
          patientName={consultation.patientName}
          doctorName={consultation.doctorName}
          patientAllergies={consultation.patientAllergies}
          patientChronicConditions={consultation.patientChronicConditions}
          pageTitle={pageTitle}
          saveStatus={hasPending ? 'dirty' : 'idle'}
          isSigned={isSigned}
          canSign={canSign}
          onAmend={() => setShowAmend(true)}
          onRetry={() => undefined}
          onSignClick={handleSignClick}
          canManage={canManageConsultations}
        />

        {isSigned && consultation.signedAt && (
          <SignedBanner signedAt={consultation.signedAt} doctorName={consultation.doctorName} />
        )}
        {signResult && (
          <PostSignPanel
            invoiceOutcome={signResult.invoiceOutcome}
            recordOutcome={signResult.recordOutcome}
            consultation={consultation}
          />
        )}
        <AmendmentsBanner amendments={consultation.amendments} />

        {showMissingFields && (
          <div className="mb-4">
            <MissingFieldsPanel
              fields={missingFields}
              isSigned={isSigned}
              onDismiss={() => setShowMissingFields(false)}
              onSign={() => {
                setShowMissingFields(false)
                setShowSign(true)
              }}
            />
          </div>
        )}
      </div>

      {/* Zone 2+3: Main + right rail */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <ProtocolPanel
            consultation={consultation}
            readOnly={readOnly}
            onRecordModification={recordModification}
            onFlushPending={handleBeforeSign}
            onUsageRemoved={discardUsage}
            onRecordContentEdit={recordContentEdit}
            showSign={showSign}
            onShowSignChange={setShowSign}
            onSigned={handleSigned}
            showAmend={showAmend}
            onShowAmendChange={setShowAmend}
            showPicker={showPicker}
            onShowPickerChange={setShowPicker}
          />
        </main>
        <aside
          className="w-80 border-l border-n-200 flex flex-col overflow-hidden"
          aria-label={consultationPageStrings.complementaryInfoLabel}
        >
          <OrdersRail
            consultation={consultation}
            readOnly={readOnly}
            onAddProtocol={() => setShowPicker(true)}
          />
        </aside>
      </div>
    </div>
  )
}
