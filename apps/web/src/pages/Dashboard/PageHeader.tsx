import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Row } from '@/components/ui'
import { NewConsultationDialog } from '@/components/consultations/NewConsultationDialog'
import { formatDateKicker } from './helpers'
import { dashboardStrings } from './strings'

export interface PageHeaderProps {
  now: Date
  greeting: string
  subtitle: string
}

export function PageHeader({ now, greeting, subtitle }: PageHeaderProps): JSX.Element {
  const navigate = useNavigate()
  const [showNewConsultation, setShowNewConsultation] = useState(false)
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      {showNewConsultation && (
        <NewConsultationDialog
          open={showNewConsultation}
          onClose={() => setShowNewConsultation(false)}
        />
      )}
      <div>
        <div className="font-mono text-2xs tracking-widest text-n-400 mb-1.5">
          {formatDateKicker(now)}
        </div>
        <h1 className="font-serif font-medium text-h2 text-n-900 leading-display-tight tracking-heading-lg m-0">
          {greeting}
        </h1>
        <p className="text-sm text-n-500 mt-1 mb-0">{subtitle}</p>
      </div>
      <Row gap={2} className="shrink-0">
        <Button variant="secondary" size="md" onClick={() => void navigate('/agenda')}>
          <i className="ph ph-calendar-blank text-base" />
          {dashboardStrings.pageHeaderViewSchedule}
        </Button>
        <Button variant="primary" size="md" onClick={() => setShowNewConsultation(true)}>
          <i className="ph ph-plus text-base" />
          {dashboardStrings.pageHeaderNewConsultation}
        </Button>
      </Row>
    </div>
  )
}
