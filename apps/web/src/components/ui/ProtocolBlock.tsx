import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// Protocol Container (top-level wrapper)

export interface ProtocolContainerProps {
  kicker?: string
  title: string
  meta?: string
  badge?: ReactNode
  children: ReactNode
  className?: string
}

export function ProtocolContainer({
  kicker,
  title,
  meta,
  badge,
  children,
  className,
}: ProtocolContainerProps): JSX.Element {
  return (
    <div className={cn('bg-n-0 border border-n-200 rounded px-8 py-7', className)}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          {kicker && (
            <div className="text-[11px] font-mono uppercase tracking-[0.10em] text-n-400 mb-1">
              {kicker}
            </div>
          )}
          <h1 className="text-[26px] font-serif font-medium text-n-900 tracking-[-0.005em] leading-tight">
            {title}
          </h1>
          {meta && <div className="text-[12.5px] font-sans text-n-500 mt-1">{meta}</div>}
        </div>
        {badge}
      </div>
      <div>{children}</div>
    </div>
  )
}

// Protocol Block (individual block: section, checklist, text, etc.)

export interface ProtocolBlockProps {
  type: string
  title: string
  required?: boolean
  nested?: boolean
  children?: ReactNode
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function ProtocolBlock({
  type,
  title,
  required,
  nested,
  children,
  onEdit,
  onDelete,
  className,
}: ProtocolBlockProps): JSX.Element {
  return (
    <div
      className={cn(
        'bg-n-0 border border-n-200 rounded mb-3',
        nested && 'ml-7 border-l-2 border-l-n-200',
        className,
      )}
    >
      {/* Header with 2px teal left rule */}
      <div className="relative flex items-center gap-3 bg-n-25 border-b border-n-100 px-[18px] py-2 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-p-500 before:rounded-tl-sm">
        <span className="text-n-300 cursor-grab shrink-0">
          <i className="ph ph-dots-six-vertical text-[16px]" />
        </span>
        <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-1.5 py-0.5 rounded-sm shrink-0">
          {type}
        </span>
        <span className="text-[12px] font-serif font-medium text-n-900 flex-1 min-w-0 truncate">
          {title}
        </span>
        {required && (
          <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-n-400 shrink-0">
            REQUERIDA
          </span>
        )}
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center justify-center w-7 h-7 rounded-sm text-n-400 hover:text-n-700 hover:bg-n-100 transition-colors duration-[100ms]"
              aria-label="Editar bloque"
            >
              <i className="ph ph-pencil-simple text-[14px]" />
            </button>
          )}
          {onDelete && !required && (
            <button
              onClick={onDelete}
              className="flex items-center justify-center w-7 h-7 rounded-sm text-n-400 hover:text-danger-text hover:bg-danger-bg transition-colors duration-[100ms]"
              aria-label="Eliminar bloque"
            >
              <i className="ph ph-trash text-[14px]" />
            </button>
          )}
        </div>
      </div>
      {children && <div className="px-[18px] py-4">{children}</div>}
    </div>
  )
}

// Checklist within a protocol block

export interface ChecklistItem {
  id: string
  text: string
  critical?: boolean
  done?: boolean
}

export interface ProtocolChecklistProps {
  items: ChecklistItem[]
  onToggle?: (id: string) => void
}

export function ProtocolChecklist({ items, onToggle }: ProtocolChecklistProps): JSX.Element {
  return (
    <ul className="divide-y divide-n-100">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex items-center gap-3 py-2 px-1 hover:bg-n-25 rounded transition-colors duration-[100ms]',
            item.done && 'opacity-60',
          )}
        >
          <input
            type="checkbox"
            checked={item.done ?? false}
            onChange={() => onToggle?.(item.id)}
            className="w-4 h-4 rounded-sm border-n-400 text-p-500 cursor-pointer shrink-0"
          />
          <span
            className={cn(
              'text-[13.5px] font-sans text-n-700 leading-[1.5] flex-1',
              item.done && 'line-through text-n-400',
            )}
          >
            {item.text}
          </span>
          {item.critical && !item.done && (
            <span className="text-[11.5px] font-mono uppercase text-danger-solid tracking-[0.02em] shrink-0">
              CRÍTICO
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

// Steps list

export interface Step {
  id: string
  order: number
  title: string
  detail?: string
}

export interface ProtocolStepsProps {
  steps: Step[]
}

export function ProtocolSteps({ steps }: ProtocolStepsProps): JSX.Element {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => (
        <li key={step.id} className="flex gap-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-p-50 text-p-700 text-[12px] font-mono font-medium shrink-0 mt-0.5">
            {step.order}
          </span>
          <div className="flex-1">
            <div className="text-[13.5px] font-sans font-semibold text-n-800">{step.title}</div>
            {step.detail && (
              <div className="text-[12.5px] font-sans text-n-500 mt-0.5 leading-[1.4]">
                {step.detail}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

// Decision block

export interface Branch {
  id: string
  label: string
  action: string
}

export interface ProtocolDecisionProps {
  condition: string
  branches: Branch[]
}

export function ProtocolDecision({ condition, branches }: ProtocolDecisionProps): JSX.Element {
  return (
    <div>
      <div className="text-[13px] font-sans font-semibold text-n-800 mb-3 pb-3 border-b border-n-100">
        {condition}
      </div>
      <div className="flex flex-col gap-3">
        {branches.map((branch) => (
          <div key={branch.id} className="flex gap-3">
            <span className="text-[11.5px] font-mono font-medium text-p-700 bg-p-50 border border-p-100 px-2 py-0.5 rounded-sm shrink-0 h-fit mt-0.5">
              {branch.label}
            </span>
            <div className="text-[13px] font-sans text-n-700 leading-[1.45]">{branch.action}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Dosage table

export interface DosageRow {
  id: string
  drug: string
  dose: string
  route: string
  frequency: string
  notes: string
}

export interface ProtocolDosageTableProps {
  title?: string
  rows: DosageRow[]
}

export function ProtocolDosageTable({ title, rows }: ProtocolDosageTableProps): JSX.Element {
  const cols = ['Medicamento', 'Dosis', 'Vía', 'Frecuencia', 'Notas']
  return (
    <div className="overflow-x-auto">
      {title && <div className="text-[13px] font-sans font-semibold text-n-800 mb-3">{title}</div>}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            {cols.map((col) => (
              <th
                key={col}
                className="text-[11px] font-mono uppercase tracking-[0.06em] text-n-600 bg-n-50 px-3 py-2 border-b border-n-200 font-semibold"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-n-25">
              <td className="text-[13px] font-sans font-semibold text-n-800 px-3 py-2 border-b border-n-100">
                {row.drug}
              </td>
              <td className="text-[13px] font-sans text-n-700 px-3 py-2 border-b border-n-100">
                {row.dose}
              </td>
              <td className="text-[13px] font-sans text-n-700 px-3 py-2 border-b border-n-100">
                {row.route}
              </td>
              <td className="text-[13px] font-sans text-n-700 px-3 py-2 border-b border-n-100">
                {row.frequency}
              </td>
              <td className="text-[12px] font-sans text-n-500 px-3 py-2 border-b border-n-100">
                {row.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Alert block (within a protocol)

export interface ProtocolAlertProps {
  severity: 'info' | 'warning' | 'danger' | 'success'
  title?: string
  content: string
}

const alertStyles = {
  info: 'bg-info-bg border-info-border text-info-text',
  warning: 'bg-warning-bg border-warning-border text-warning-text',
  danger: 'bg-danger-bg border-danger-border text-danger-text',
  success: 'bg-success-bg border-success-border text-success-text',
}

export function ProtocolAlert({ severity, title, content }: ProtocolAlertProps): JSX.Element {
  return (
    <div
      className={cn(
        'px-4 py-3 rounded border text-[13px] font-sans leading-[1.45]',
        alertStyles[severity],
      )}
    >
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      {content}
    </div>
  )
}

// Add block button

export function AddBlockButton({
  onClick,
  label = 'Añadir bloque',
}: {
  onClick?: () => void
  label?: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-n-200 rounded text-[12.5px] font-sans text-n-500 hover:border-n-400 hover:text-n-800 transition-colors duration-[100ms]"
    >
      <i className="ph ph-plus text-[14px]" />
      {label}
    </button>
  )
}
