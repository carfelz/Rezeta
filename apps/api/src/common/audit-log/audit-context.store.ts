import { AsyncLocalStorage } from 'async_hooks'

export interface HttpAuditContext {
  tenantId: string
  actorUserId: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
}

export interface NonHttpAuditContext {
  actorType: 'system' | 'cron' | 'webhook'
  tenantId?: string
  actorUserId?: string
}

// Undefined = store not initialized (non-HTTP context)
// HttpAuditContext = active HTTP request being handled by the interceptor
export const httpAuditContextStore = new AsyncLocalStorage<HttpAuditContext>()
