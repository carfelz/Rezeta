import { AsyncLocalStorage } from 'async_hooks'

export interface HttpAuditContext {
  tenantId: string
  actorUserId: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
  entityName?: string
}

export interface NonHttpAuditContext {
  actorType: 'system' | 'cron' | 'webhook'
  tenantId?: string
  actorUserId?: string
}

// Undefined = store not initialized (non-HTTP context)
// HttpAuditContext = active HTTP request being handled by the interceptor
export const httpAuditContextStore = new AsyncLocalStorage<HttpAuditContext>()

/**
 * Call from a service before performing a delete/archive operation so that
 * the audit interceptor can capture the entity name even when the HTTP
 * response body is empty (204 No Content).
 */
export function setAuditEntityName(name: string): void {
  const ctx = httpAuditContextStore.getStore()
  if (ctx) ctx.entityName = name
}
