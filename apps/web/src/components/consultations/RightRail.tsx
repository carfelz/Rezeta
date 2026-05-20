import { GroupSectionCard, Callout } from '@/components/ui'
import { cn } from '@/lib/utils'
import { rightRailStrings } from './strings'

export interface AlertEntry {
  id: string
  tone: 'danger' | 'warn' | 'info'
  icon: string
  label: string
}

export interface StepEntry {
  n: number
  label: string
  done: boolean
  active: boolean
}

export interface OrderCount {
  label: string
  count: number
  highlight?: boolean
  prefix?: string
}

export interface RightRailProps {
  alerts: AlertEntry[]
  steps: StepEntry[]
  orders: OrderCount[]
}

const calloutToneByAlertTone: Record<AlertEntry['tone'], 'danger' | 'warning' | 'info'> = {
  danger: 'danger',
  warn: 'warning',
  info: 'info',
}

export function RightRail({ alerts, steps, orders }: RightRailProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {alerts.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-n-400 mb-2">
            {rightRailStrings.alertsLabel}
          </div>
          <div className="flex flex-col gap-2">
            {alerts.map((a) => (
              <Callout key={a.id} tone={calloutToneByAlertTone[a.tone]} icon={a.icon} compact>
                {a.label}
              </Callout>
            ))}
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <GroupSectionCard label={rightRailStrings.protocolStepsLabel} compact>
          {steps.map((s) => (
            <div key={s.n} className="flex items-center justify-between py-px text-[12px]">
              <span
                className={cn(
                  'flex items-center gap-2',
                  s.done ? 'text-n-700' : 'text-n-400',
                  s.active && 'font-medium',
                )}
              >
                <span className="font-mono text-[10px] text-n-400 min-w-[14px]">
                  {String(s.n).padStart(2, '0')}
                </span>
                {s.label}
              </span>
              {s.done && <i className="ph ph-check-circle text-[13px] text-success-text" />}
              {s.active && (
                <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-p-700">
                  {rightRailStrings.stepInProgress}
                </span>
              )}
            </div>
          ))}
        </GroupSectionCard>
      )}

      {orders.length > 0 && (
        <GroupSectionCard label={rightRailStrings.ordersLabel} compact>
          {orders.map((o) => (
            <div
              key={o.label}
              className="flex items-center justify-between py-px text-[12px] text-n-700"
            >
              <span>{o.label}</span>
              <span
                className={cn(
                  'font-mono text-[11px]',
                  o.highlight ? 'text-success-text' : 'text-n-500',
                )}
              >
                {o.prefix ? `${o.prefix} ` : ''}
                {o.count}
              </span>
            </div>
          ))}
        </GroupSectionCard>
      )}
    </div>
  )
}
