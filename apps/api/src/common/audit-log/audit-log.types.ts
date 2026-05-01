export type AuditActorType = 'user' | 'system' | 'webhook' | 'cron'

export type AuditCategory = 'entity' | 'auth' | 'communication' | 'system'

export type AuditEntityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'sign'
  | 'amend'
  | 'archive'
  | 'lock'
  | 'unlock'

export type AuditAuthAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'mfa_enabled'
  | 'session_revoked'
  | 'permission_granted'
  | 'permission_revoked'

export type AuditCommunicationAction =
  | 'email_queued'
  | 'email_sent'
  | 'email_delivered'
  | 'email_bounced'
  | 'sms_sent'
  | 'whatsapp_sent'
  | 'notification_sent'
  | 'pdf_generated'
  | 'pdf_downloaded'

export type AuditSystemAction =
  | 'reminder_sent'
  | 'invoice_issued'
  | 'prescription_dispensed'
  | 'export_generated'
  | 'report_run'
  | 'backup_verified'
  | 'webhook_received'

export type AuditAction =
  | AuditEntityAction
  | AuditAuthAction
  | AuditCommunicationAction
  | AuditSystemAction

export type AuditStatus = 'success' | 'failed'

export interface RecordAuditEventInput {
  tenantId?: string
  actorUserId?: string
  actorType: AuditActorType
  onBehalfOfId?: string
  category: AuditCategory
  action: AuditAction
  entityType?: string
  entityId?: string
  changes?: Record<string, { before: unknown; after: unknown }>
  metadata?: Record<string, unknown>
  requestId?: string
  ipAddress?: string
  userAgent?: string
  status?: AuditStatus
  errorCode?: string
}

export interface AuditLogFilters {
  tenantId: string
  actorUserId?: string
  category?: AuditCategory
  action?: AuditAction
  entityType?: string
  entityId?: string
  status?: AuditStatus
  fromDate?: Date
  toDate?: Date
  limit?: number
  cursor?: string
}
