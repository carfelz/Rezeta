export interface ActivityItemProps {
  initials: string
  html: string
  time: string
}

export function ActivityItem({ initials, html, time }: ActivityItemProps): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div className="w-[28px] h-[28px] rounded-full bg-p-50 text-p-700 text-[10px] font-semibold flex items-center justify-center shrink-0 mt-1">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-n-700" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="text-[11.5px] text-n-500 mt-1">{time}</div>
      </div>
    </div>
  )
}
