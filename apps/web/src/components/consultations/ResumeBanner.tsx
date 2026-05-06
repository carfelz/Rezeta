import { Avatar, Button, DialogCard } from '@/components/ui'
import type { ConsultationProtocolUsage } from '@rezeta/shared'

export interface ResumeBannerProps {
  usage: ConsultationProtocolUsage
  patientName: string
  patientAge?: number
  currentStep?: { number: number; title: string }
  totalSteps?: number
  completedSteps?: number
  lastEditField?: string
  lastEditTime?: string
  elapsedMinutes: number
  onResume: () => void
  onStartNew: () => void
}

export function ResumeBanner({
  usage,
  patientName,
  patientAge,
  currentStep,
  totalSteps,
  completedSteps,
  lastEditField,
  lastEditTime,
  elapsedMinutes,
  onResume,
  onStartNew,
}: ResumeBannerProps): JSX.Element {
  const initials = patientName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DialogCard
      width="xl"
      elevation="raised"
      overline="Consulta en progreso"
      overlineTone="neutral"
      title="Bienvenido de vuelta"
      description={
        <>
          Dejaste una consulta de {patientName} a medias hace {elapsedMinutes} minutos. ¿Quieres
          continuar donde la dejaste?
        </>
      }
      footer={
        <div className="flex flex-col w-full gap-3">
          <div className="flex items-center gap-2 w-full">
            <Button variant="primary" size="md" className="flex-1" onClick={onResume}>
              Continuar
              {currentStep && ` en paso ${currentStep.number} · ${currentStep.title}`}
            </Button>
            <Button variant="secondary" size="md" onClick={onStartNew}>
              Empezar nueva
            </Button>
          </div>
          <p className="text-[11.5px] text-n-400 text-center">El borrador se conserva 7 días.</p>
        </div>
      }
    >
      <div className="border border-n-200 rounded p-4 bg-n-25">
        <div className="flex items-center gap-3 mb-3">
          <Avatar initials={initials} size="default" />
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-n-900 truncate">
              {patientName}
              {patientAge != null && ` · ${patientAge} años`}
            </div>
            {currentStep && (
              <div className="text-[11.5px] text-n-500 mt-px">
                Protocolo {usage.protocolTitle} · paso {currentStep.number} de {totalSteps ?? '?'}
              </div>
            )}
          </div>
        </div>

        {totalSteps != null && completedSteps != null && (
          <div className="flex gap-1 mb-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={
                  i < completedSteps
                    ? 'h-1 flex-1 bg-p-500 rounded-full'
                    : 'h-1 flex-1 bg-n-100 rounded-full'
                }
              />
            ))}
          </div>
        )}

        {(lastEditField || lastEditTime) && (
          <div className="flex items-center justify-between text-[11.5px] text-n-500">
            {lastEditField && (
              <span>
                Última edición: <span className="text-n-800 font-medium">{lastEditField}</span>
              </span>
            )}
            {lastEditTime && <span>{lastEditTime} · auto-guardado</span>}
          </div>
        )}
      </div>
    </DialogCard>
  )
}
