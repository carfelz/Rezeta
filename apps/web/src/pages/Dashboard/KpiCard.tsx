export interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  delta: string
  deltaDir: 'up' | 'down' | 'flat'
  loading?: boolean
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaDir,
  loading,
}: KpiCardProps): JSX.Element {
  const deltaIcon =
    deltaDir === 'up' ? 'ph-arrow-up' : deltaDir === 'down' ? 'ph-arrow-down' : 'ph-minus'
  const deltaColor =
    deltaDir === 'up'
      ? 'text-success-text'
      : deltaDir === 'down'
        ? 'text-danger-text'
        : 'text-n-500'

  return (
    <div className="bg-n-0 border border-n-200 rounded-md px-5 py-4.5">
      <div className="font-mono text-2xs tracking-widest uppercase text-n-500 mb-2.5">
        {label}
      </div>
      {loading ? (
        <div className="h-10 w-96 bg-n-100 rounded animate-pulse" />
      ) : (
        <div className="font-serif font-medium text-h1 text-n-900 leading-none tracking-heading-lg">
          {value}
          {unit && (
            <span className="font-sans font-medium text-sm text-n-400 ml-1">{unit}</span>
          )}
        </div>
      )}
      <div className={`font-mono text-overline mt-2 flex items-center gap-1 ${deltaColor}`}>
        <i className={`ph ${deltaIcon}`} />
        {delta}
      </div>
    </div>
  )
}
