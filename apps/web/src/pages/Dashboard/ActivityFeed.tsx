import { Caption } from '@/components/ui'
import type { AuditLogItem } from '@rezeta/shared'
import { ActivityItem } from './ActivityItem'
import { describeAuditEntry, initialsForActor, timeAgo } from './helpers'
import { dashboardStrings } from './strings'

export interface ActivityFeedProps {
  entries: AuditLogItem[]
}

export function ActivityFeed({ entries }: ActivityFeedProps): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-5">
      <div className="mb-[14px]">
        <h3 className="font-serif font-medium text-h3 text-n-900 m-0 tracking-[-0.005em]">
          {dashboardStrings.activityFeedTitle}
        </h3>
      </div>
      {entries.length === 0 ? (
        <Caption tone="muted" size="lg" as="p" className="py-2 block">
          {dashboardStrings.activityFeedEmpty}
        </Caption>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.slice(0, 5).map((entry) => {
            const { actor, detail } = describeAuditEntry(entry)
            return (
              <ActivityItem
                key={entry.id}
                initials={initialsForActor(entry.actor?.fullName ?? null)}
                actor={actor}
                detail={detail}
                time={timeAgo(entry.createdAt)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
