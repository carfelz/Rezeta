import { useState, useCallback } from 'react'
import type { AuditLogItem } from '@rezeta/shared'
import { useAuth } from '@/hooks/use-auth'
import { useAuditLogs, downloadAuditLogCsv } from '@/hooks/audit-logs/use-audit-logs'
import type { AuditLogParams } from '@/hooks/audit-logs/use-audit-logs'
import { triggerDownload } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { AUDIT_ENTITY_LABELS_FORMAL } from '@/lib/audit-entities'
import {
  Button,
  Callout,
  EmptyState,
  IconButton,
  Input,
  NativeSelect,
  TextLink,
} from '@/components/ui'
import { auditLogStrings } from './strings'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  entity: auditLogStrings.categoryEntity,
  auth: auditLogStrings.categoryAuth,
  communication: auditLogStrings.categoryCommunication,
  system: auditLogStrings.categorySystem,
}

const ACTION_LABELS: Record<string, string> = {
  create: auditLogStrings.actionCreate,
  update: auditLogStrings.actionUpdate,
  delete: auditLogStrings.actionDelete,
  restore: auditLogStrings.actionRestore,
  sign: auditLogStrings.actionSign,
  amend: auditLogStrings.actionAmend,
  archive: auditLogStrings.actionArchive,
  lock: auditLogStrings.actionLock,
  unlock: auditLogStrings.actionUnlock,
  login: auditLogStrings.actionLogin,
  logout: auditLogStrings.actionLogout,
  login_failed: auditLogStrings.actionLoginFailed,
  password_change: auditLogStrings.actionPasswordChange,
  mfa_enabled: auditLogStrings.actionMfaEnabled,
  session_revoked: auditLogStrings.actionSessionRevoked,
  permission_granted: auditLogStrings.actionPermissionGranted,
  permission_revoked: auditLogStrings.actionPermissionRevoked,
  email_queued: auditLogStrings.actionEmailQueued,
  email_sent: auditLogStrings.actionEmailSent,
  email_delivered: auditLogStrings.actionEmailDelivered,
  email_bounced: auditLogStrings.actionEmailBounced,
  sms_sent: auditLogStrings.actionSmsSent,
  whatsapp_sent: auditLogStrings.actionWhatsappSent,
  notification_sent: auditLogStrings.actionNotificationSent,
  pdf_generated: auditLogStrings.actionPdfGenerated,
  pdf_downloaded: auditLogStrings.actionPdfDownloaded,
  reminder_sent: auditLogStrings.actionReminderSent,
  invoice_issued: auditLogStrings.actionInvoiceIssued,
  prescription_dispensed: auditLogStrings.actionPrescriptionDispensed,
  export_generated: auditLogStrings.actionExportGenerated,
  report_run: auditLogStrings.actionReportRun,
  backup_verified: auditLogStrings.actionBackupVerified,
  webhook_received: auditLogStrings.actionWebhookReceived,
}

const ACTOR_TYPE_LABELS: Record<string, string> = {
  user: '',
  system: auditLogStrings.actorSystem,
  webhook: auditLogStrings.actorWebhook,
  cron: auditLogStrings.actorCron,
}

const ENTITY_TYPE_LABELS: Record<string, string> = AUDIT_ENTITY_LABELS_FORMAL

function formatTs(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('es-DO', { month: 'short' })
  const year = d.getFullYear()
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${day} ${month} ${year}, ${h12}:${minutes} ${ampm}`
}

function renderValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function defaultFromDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category

  const cls =
    category === 'entity'
      ? 'bg-info-bg border border-info-border text-info-text'
      : category === 'auth'
        ? 'bg-warning-bg border border-warning-border text-warning-text'
        : category === 'communication'
          ? 'bg-p-50 border border-p-100 text-p-700'
          : 'bg-n-50 border border-n-200 text-n-600'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-sm text-overline font-medium ${cls}`}
    >
      <span className="w-[5px] h-[5px] rounded-full bg-current opacity-70 shrink-0" />
      {label}
    </span>
  )
}

// ─── Status Indicator ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-warning-text text-xs">
        <i className="ph ph-warning text-sm" />
        {auditLogStrings.statusFailed}
      </span>
    )
  }
  return <span className="inline-block w-[6px] h-[6px] rounded-full bg-n-300" />
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

interface DrawerProps {
  item: AuditLogItem
  onClose: () => void
}

function DetailDrawer({ item, onClose }: DrawerProps) {
  const actorLabel =
    item.actorType === 'user'
      ? (item.actor?.fullName ?? item.actor?.email ?? auditLogStrings.actorUnknown)
      : (ACTOR_TYPE_LABELS[item.actorType] ?? item.actorType)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-[rgba(14,14,13,0.35)]" onClick={onClose} />

      {/* drawer panel */}
      <div className="relative z-10 w-[480px] max-w-full h-full bg-n-0 border-l border-n-200 flex flex-col shadow-floating overflow-y-auto">
        {/* header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-n-200 shrink-0">
          <div>
            <p className="text-body-lg font-serif font-medium text-n-900">
              {ACTION_LABELS[item.action] ?? item.action}
            </p>
            <p className="text-xs font-mono text-n-500 mt-0.5">{formatTs(item.createdAt)}</p>
          </div>
          <IconButton
            icon="ph ph-x"
            aria-label={auditLogStrings.drawerCloseLabel}
            tone="neutral"
            size="md"
            onClick={onClose}
          />
        </div>

        {/* body */}
        <div className="flex-1 px-6 py-5 flex flex-col gap-5">
          {/* status */}
          <div className="flex items-center gap-3">
            <CategoryBadge category={item.category} />
            {item.status === 'failed' && (
              <span className="inline-flex items-center gap-1 text-warning-text text-xs">
                <i className="ph ph-warning" />
                {auditLogStrings.statusFailed}
                {item.errorCode && (
                  <span className="font-mono text-overline ml-1 text-n-500">{item.errorCode}</span>
                )}
              </span>
            )}
          </div>

          {/* actor */}
          <section>
            <p className="text-overline mb-2">{auditLogStrings.drawerActorSection}</p>
            <p className="text-sm text-n-800 font-medium">{actorLabel}</p>
            {item.ipAddress && (
              <p className="text-xs font-mono text-n-500 mt-0.5">{item.ipAddress}</p>
            )}
          </section>

          {/* entity */}
          {item.entityType && (
            <section>
              <p className="text-overline mb-2">{auditLogStrings.drawerEntitySection}</p>
              <p className="text-sm text-n-700">
                <span className="font-medium">{item.entityType}</span>
                {item.entityId && (
                  <span className="font-mono text-n-500 ml-2 text-overline">{item.entityId}</span>
                )}
              </p>
            </section>
          )}

          {/* changes diff */}
          {item.changes && Object.keys(item.changes).length > 0 && (
            <section>
              <p className="text-overline mb-2">{auditLogStrings.drawerChangesSection}</p>
              <div className="border border-n-200 rounded-sm overflow-hidden">
                {Object.entries(item.changes).map(([field, diff]) => (
                  <div key={field} className="px-3 py-2 border-b border-n-100 last:border-0">
                    <p className="text-overline font-mono text-n-500 mb-1">{field}</p>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-danger-text line-through break-all">
                        {renderValue(diff.before)}
                      </span>
                      <i className="ph ph-arrow-right text-n-400 shrink-0 mt-0.5" />
                      <span className="text-success-text break-all">{renderValue(diff.after)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* metadata */}
          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <section>
              <p className="text-overline mb-2">{auditLogStrings.drawerMetadataSection}</p>
              <div className="border border-n-200 rounded-sm overflow-hidden">
                {Object.entries(item.metadata).map(([k, v]) => (
                  <div key={k} className="flex gap-3 px-3 py-2 border-b border-n-100 last:border-0">
                    <span className="text-overline font-mono text-n-500 shrink-0 w-[120px] truncate">
                      {k}
                    </span>
                    <span className="text-xs text-n-700 break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* request id */}
          {item.requestId && (
            <section>
              <p className="text-overline mb-2">{auditLogStrings.drawerRequestIdSection}</p>
              <p className="text-overline font-mono text-n-500 break-all">{item.requestId}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Filters ──────────────────────────────────────────────────────────────────

interface FilterState {
  dateFrom: string
  dateTo: string
  category: string
  action: string
  status: string
}

interface FiltersBarProps {
  filters: FilterState
  onChange: (f: FilterState) => void
}

function FiltersBar({ filters, onChange }: FiltersBarProps) {
  function set(key: keyof FilterState, val: string) {
    onChange({ ...filters, [key]: val })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <div className="flex items-center gap-2">
        <label className="text-overline font-medium text-n-600 shrink-0">
          {auditLogStrings.filterFrom}
        </label>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => set('dateFrom', e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-overline font-medium text-n-600 shrink-0">
          {auditLogStrings.filterTo}
        </label>
        <Input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
      </div>

      <NativeSelect value={filters.category} onChange={(e) => set('category', e.target.value)}>
        <option value="">{auditLogStrings.filterAllCategories}</option>
        <option value="entity">{auditLogStrings.categoryEntity}</option>
        <option value="auth">{auditLogStrings.categoryAuth}</option>
        <option value="communication">{auditLogStrings.categoryCommunication}</option>
        <option value="system">{auditLogStrings.categorySystem}</option>
      </NativeSelect>

      <NativeSelect value={filters.status} onChange={(e) => set('status', e.target.value)}>
        <option value="">{auditLogStrings.filterAllStatuses}</option>
        <option value="success">{auditLogStrings.filterStatusSuccess}</option>
        <option value="failed">{auditLogStrings.filterStatusFailed}</option>
      </NativeSelect>

      {(filters.category || filters.status) && (
        <TextLink
          tone="primary"
          size="md"
          onClick={() => onChange({ ...filters, category: '', action: '', status: '' })}
        >
          {auditLogStrings.filterClearButton}
        </TextLink>
      )}
    </div>
  )
}

// ─── Plan Banner ──────────────────────────────────────────────────────────────

function PlanBanner({ plan }: { plan: string }) {
  const days = plan === 'free' ? 30 : 365
  return (
    <div className="mb-5 px-4 py-3 bg-info-bg border border-info-border rounded-sm flex items-center gap-3">
      <i className="ph ph-info text-info-text text-body-lg shrink-0" />
      <p className="text-sm text-info-text">
        {auditLogStrings.planBannerDays(days)}{' '}
        <span className="font-medium">{auditLogStrings.planBannerUpgrade}</span>
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AuditLog(): JSX.Element {
  const { user } = useAuth()
  const tenantPlan = user?.tenantPlan ?? 'free'
  const isClinic = tenantPlan === 'clinic'

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: defaultFromDate(),
    dateTo: '',
    category: '',
    action: '',
    status: '',
  })
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [selectedItem, setSelectedItem] = useState<AuditLogItem | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const params: AuditLogParams = {
    limit: 50,
    ...(filters.dateFrom && { dateFrom: new Date(filters.dateFrom).toISOString() }),
    ...(filters.dateTo && { dateTo: new Date(filters.dateTo + 'T23:59:59Z').toISOString() }),
    ...(filters.category && { category: filters.category }),
    ...(filters.action && { action: filters.action }),
    ...(filters.status && { status: filters.status }),
    ...(cursor && { cursor }),
  }

  const { data, isLoading, isError } = useAuditLogs(params)

  const handleFiltersChange = useCallback((f: FilterState) => {
    setFilters(f)
    setCursor(undefined)
  }, [])

  async function handleExport() {
    setExportError(null)
    setExporting(true)
    try {
      const blob = await downloadAuditLogCsv({
        ...(params.dateFrom && { dateFrom: params.dateFrom }),
        ...(params.dateTo && { dateTo: params.dateTo }),
        ...(params.category && { category: params.category }),
        ...(params.action && { action: params.action }),
        ...(params.status && { status: params.status }),
      })
      const ts = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `audit-log-${ts}.csv`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'AuditLog.exportCsv' })
      setExportError(auditLogStrings.exportError)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {selectedItem && <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">{auditLogStrings.pageTitle}</h1>
        {isClinic && (
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => {
              void handleExport()
            }}
          >
            <i className="ph ph-download-simple mr-1.5" />
            {exporting ? auditLogStrings.exportingButton : auditLogStrings.exportButton}
          </Button>
        )}
      </div>

      {/* Plan banner */}
      {!isClinic && <PlanBanner plan={tenantPlan} />}

      {/* Export error */}
      {exportError && (
        <div className="mb-4">
          <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}>
            {exportError}
          </Callout>
        </div>
      )}

      {/* Filters */}
      <FiltersBar filters={filters} onChange={handleFiltersChange} />

      {/* Loading */}
      {isLoading && <p className="text-body text-n-500">{auditLogStrings.loading}</p>}

      {/* Error */}
      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {auditLogStrings.loadError}
        </Callout>
      )}

      {/* Empty */}
      {!isLoading && !isError && data?.data.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-clipboard-text" />}
          title={auditLogStrings.emptyTitle}
          description={auditLogStrings.emptyDescription}
        />
      )}

      {/* Table */}
      {!isLoading && !isError && (data?.data.length ?? 0) > 0 && (
        <>
          <div className="border border-n-200 rounded-md overflow-hidden">
            <table className="w-full border-collapse bg-n-0">
              <thead>
                <tr className="bg-n-50">
                  {[
                    auditLogStrings.colDate,
                    auditLogStrings.colActor,
                    auditLogStrings.colCategory,
                    auditLogStrings.colAction,
                    auditLogStrings.colEntity,
                    auditLogStrings.colStatus,
                  ].map((col) => (
                    <th
                      key={col}
                      className="text-overline font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.data.map((item) => {
                  const actorLabel =
                    item.actorType === 'user'
                      ? (item.actor?.fullName ?? item.actor?.email ?? auditLogStrings.actorUnknown)
                      : (ACTOR_TYPE_LABELS[item.actorType] ?? item.actorType)

                  const isSelected = selectedItem?.id === item.id

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`border-t border-n-100 cursor-pointer relative transition-colors duration-[100ms] ${
                        isSelected ? 'bg-n-25' : 'hover:bg-n-25'
                      }`}
                    >
                      {/* Active indicator */}
                      {isSelected && (
                        <td className="absolute left-0 top-[6px] bottom-[6px] w-[2px] bg-p-500 rounded-sm p-0" />
                      )}
                      <td className="px-4 py-3 font-mono text-xs text-n-600 whitespace-nowrap">
                        {formatTs(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-n-700">{actorLabel}</td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={item.category} />
                      </td>
                      <td className="px-4 py-3 text-sm text-n-700">
                        {ACTION_LABELS[item.action] ?? item.action}
                      </td>
                      <td className="px-4 py-3 text-sm text-n-600">
                        {item.entityType ? (
                          <span>
                            {typeof item.metadata?.entityName === 'string' ? (
                              <span className="font-medium text-n-800">
                                {item.metadata.entityName}
                              </span>
                            ) : (
                              <>
                                <span className="font-medium text-n-800">
                                  {ENTITY_TYPE_LABELS[item.entityType] ?? item.entityType}
                                </span>
                                {item.entityId && (
                                  <span className="font-mono text-overline text-n-400 ml-1.5">
                                    {item.entityId.slice(0, 8)}…
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="text-n-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusDot status={item.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-n-500">
              {auditLogStrings.recordCount(data!.data.length)}
            </p>
            <div className="flex gap-2">
              {cursor && (
                <Button variant="secondary" size="sm" onClick={() => setCursor(undefined)}>
                  {auditLogStrings.firstPage}
                </Button>
              )}
              {data!.pagination.hasMore && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCursor(data!.pagination.cursor ?? undefined)}
                >
                  {auditLogStrings.nextPage}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
