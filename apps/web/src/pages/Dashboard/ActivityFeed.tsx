import { Caption } from '@/components/ui'
import type { AuditLogItem } from '@rezeta/shared'
import { ActivityItem } from './ActivityItem'
import { describeAuditEntry, initialsForActor, timeAgo } from './helpers'

export interface ActivityFeedProps {
  entries: AuditLogItem[]
}

export function ActivityFeed({ entries }: ActivityFeedProps): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-5">
      <div className="mb-[14px]">
        <h3 className="font-serif font-medium text-[18px] text-n-900 m-0 tracking-[-0.005em]">
          Actividad reciente
        </h3>
      </div>
      {entries.length === 0 ? (
        <Caption tone="muted" size="lg" as="p" className="py-2 block">
          Sin actividad reciente.
        </Caption>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.slice(0, 5).map((entry) => (
            <ActivityItem
              key={entry.id}
              initials={initialsForActor(entry.actor?.fullName ?? null)}
              html={describeAuditEntry(entry)}
              time={timeAgo(entry.createdAt)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
