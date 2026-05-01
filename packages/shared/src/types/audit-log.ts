export interface AuditLogActor {
  id: string
  fullName: string | null
  email: string
  role: string
}

export interface AuditLogItem {
  id: string
  tenantId: string | null
  actorUserId: string | null
  actorType: 'user' | 'system' | 'webhook' | 'cron'
  category: 'entity' | 'auth' | 'communication' | 'system'
  action: string
  entityType: string | null
  entityId: string | null
  changes: Record<string, { before: unknown; after: unknown }> | null
  metadata: Record<string, unknown> | null
  requestId: string | null
  ipAddress: string | null
  status: 'success' | 'failed'
  errorCode: string | null
  createdAt: string
  actor: AuditLogActor | null
}

export interface AuditLogListResponse {
  data: AuditLogItem[]
  pagination: {
    cursor: string | null
    hasMore: boolean
    limit: number
  }
}
