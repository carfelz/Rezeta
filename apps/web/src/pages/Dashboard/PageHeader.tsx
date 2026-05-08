import { useNavigate } from 'react-router-dom'
import { Button, Row } from '@/components/ui'
import { formatDateKicker } from './helpers'

export interface PageHeaderProps {
  now: Date
  greeting: string
  subtitle: string
}

export function PageHeader({ now, greeting, subtitle }: PageHeaderProps): JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-n-400 mb-[6px]">
          {formatDateKicker(now)}
        </div>
        <h1 className="font-serif font-medium text-[30px] text-n-900 leading-[1.15] tracking-[-0.015em] m-0">
          {greeting}
        </h1>
        <p className="text-[13px] text-n-500 mt-1 mb-0">{subtitle}</p>
      </div>
      <Row gap={2} className="shrink-0">
        <Button variant="secondary" size="md" onClick={() => void navigate('/agenda')}>
          <i className="ph ph-calendar-blank text-[15px]" />
          Ver agenda
        </Button>
        <Button variant="primary" size="md" onClick={() => void navigate('/consultas/nueva')}>
          <i className="ph ph-plus text-[15px]" />
          Nueva consulta
        </Button>
      </Row>
    </div>
  )
}
