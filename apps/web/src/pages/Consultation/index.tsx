import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useConsultation,
  useUpdateConsultation,
} from '@/hooks/consultations/use-consultations'
import { Button } from '@/components/ui'
import { useOrderQueueStore } from '@/store/order-queue.store'
import { useOrderQueueSession } from '@/hooks/consultations/use-order-queue-session'
import { useBeforeUnloadGuard } from '@/hooks/use-before-unload-guard'
import {
  MissingFieldsPanel,
  computeMissingFields,
} from '@/components/consultations/MissingFieldsPanel'
import { Breadcrumb } from './Breadcrumb'
import { PageHeader } from './PageHeader'
import { SignedBanner } from './SignedBanner'
import { AmendmentsBanner } from './AmendmentsBanner'
import { ProtocolPanel } from './ProtocolPanel'
import { OrdersRail } from './OrdersRail'
import { useSoapState } from './use-soap-state'
import { formatBreadcrumbDate } from '@/lib/format/dates'
import { consultationPageStrings } from './strings'

export function Consultation(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: consultation, isLoading, isError } = useConsultation(id!)
  const updateMutation = useUpdateConsultation(id!)

  const soap = useSoapState(consultation, updateMutation)

  const [showMissingFields, setShowMissingFields] = useState(false)
  const [showSign, setShowSign] = useState(false)

  const missingFields = computeMissingFields({
    chiefComplaint: soap.chiefComplaint,
    subjective: soap.subjective,
    objective: soap.objective,
    assessment: soap.assessment,
    plan: soap.plan,
    diagnoses: soap.diagnoses,
  })

  const consultationSigned = consultation?.status === 'signed'
  const hasUnsavedOrders = useOrderQueueStore(
    (s) => s.medications.length > 0 || s.imagingOrders.length > 0 || s.labOrders.length > 0,
  )
  useOrderQueueSession(id ?? '', consultationSigned)
  useBeforeUnloadGuard(hasUnsavedOrders && !consultationSigned)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-[13px] text-n-500 flex items-center gap-2">
          <i className="ph ph-spinner animate-spin" /> {consultationPageStrings.loading}
        </div>
      </div>
    )
  }

  if (isError || !consultation) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <i className="ph ph-warning text-[32px] text-n-300 mb-3" />
        <p className="text-[14px] text-n-600 mb-4">{consultationPageStrings.loadError}</p>
        <Button variant="secondary" onClick={() => void navigate(-1)}>
          {consultationPageStrings.backButton}
        </Button>
      </div>
    )
  }

  const isSigned = consultationSigned
  const dateShort = formatBreadcrumbDate(new Date(consultation.startedAt))
  const hasContent = Boolean(
    soap.chiefComplaint.trim() ||
    soap.subjective.trim() ||
    soap.objective.trim() ||
    soap.assessment.trim() ||
    soap.plan.trim() ||
    soap.diagnoses.length > 0 ||
    consultation.protocolUsages.length > 0,
  )
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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Zone 1: Header — never scrolls */}
      <div className="shrink-0 px-8 pt-6 pb-0">
        <Breadcrumb patientName={consultation.patientName} consultedAt={consultation.startedAt} />
        <PageHeader
          consultedAt={consultation.startedAt}
          locationName={consultation.locationName}
          patientName={consultation.patientName}
          doctorName={consultation.doctorName}
          pageTitle={pageTitle}
          saveStatus={soap.saveStatus}
          {...(soap.savedAt !== undefined ? { savedAt: soap.savedAt } : {})}
          isSigned={isSigned}
          onAmend={() => setShowSign(false)}
          onRetry={soap.saveNow}
          onSignClick={handleSignClick}
        />

        {isSigned && consultation.signedAt && (
          <SignedBanner signedAt={consultation.signedAt} doctorName={consultation.doctorName} />
        )}
        <AmendmentsBanner amendments={consultation.amendments} />

        {showMissingFields && (
          <div className="mb-4">
            <MissingFieldsPanel
              fields={missingFields}
              isSigned={isSigned}
              onFieldClick={(fieldId) => {
                setShowMissingFields(false)
                document.getElementById(`field-${fieldId}`)?.scrollIntoView({ behavior: 'smooth' })
              }}
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
            readOnly={isSigned}
            updateMutation={updateMutation}
            soap={soap}
            onSignClick={handleSignClick}
            showSign={showSign}
            onShowSignChange={setShowSign}
          />
        </main>
        <aside
          className="w-80 border-l border-n-200 flex flex-col overflow-hidden"
          aria-label={consultationPageStrings.complementaryInfoLabel}
        >
          <OrdersRail consultation={consultation} readOnly={isSigned} />
        </aside>
      </div>
    </div>
  )
}
