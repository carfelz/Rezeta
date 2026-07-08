import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common'
import type { Request } from 'express'
import { Observable, throwError } from 'rxjs'
import { tap, catchError } from 'rxjs/operators'
import { AuditLogService } from '../audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../audit-log/audit-context.store.js'
import type { AuditEntityAction } from '../audit-log/audit-log.types.js'
import type { AuthUser } from '@rezeta/shared'

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

function resolveAction(method: string, path: string): AuditEntityAction {
  if (method === 'DELETE') return 'delete'
  if (method === 'PATCH' && path.endsWith('/archive')) return 'archive'
  if (method === 'POST' && path.endsWith('/sign')) return 'sign'
  if (method === 'POST' && path.endsWith('/amend')) return 'amend'
  if (method === 'POST') return 'create'
  return 'update'
}

/** Capitalizes a URL resource segment, singularizing it only when it actually ends in a plural 's' (e.g. 'patients' -> 'Patient'); non-plural segments are capitalized as-is (e.g. 'onboarding' -> 'Onboarding'). */
function toEntityType(segment: string): string {
  const singular = segment.endsWith('s') ? segment.slice(0, -1) : segment
  return singular.charAt(0).toUpperCase() + singular.slice(1)
}

function extractEntityName(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') return undefined
  const r = response as Record<string, unknown>
  const candidate = r['name'] ?? r['fullName'] ?? r['title']
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser
  tenantId?: string
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(@Inject(AuditLogService) private auditLog: AuditLogService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()

    if (!MUTATION_METHODS.has(request.method)) return next.handle()

    const user = request.user
    const tenantId = request.tenantId

    if (!user || !tenantId) return next.handle()

    const ip = request.ip
    const ua = request.headers['user-agent']
    const rid = request.headers['x-request-id']
    const action = resolveAction(request.method, request.path)
    const entityId = (request.params as Record<string, string>)['id']
    const segments = request.path.split('/').filter(Boolean)
    const resourceSegment = segments.find((s) => !s.startsWith('v') && s !== entityId)
    const entityType = resourceSegment ? toEntityType(resourceSegment) : undefined

    const httpCtx = {
      tenantId,
      actorUserId: user.id,
      ...(typeof rid === 'string' ? { requestId: rid } : {}),
      ...(ip !== undefined ? { ipAddress: ip } : {}),
      ...(typeof ua === 'string' ? { userAgent: ua } : {}),
    }

    const buildRecord = (status: 'success' | 'failed', err?: unknown) => {
      let errorCode: string | undefined
      let errorMessage: string | undefined
      if (status === 'failed' && err != null) {
        const e = err as { code?: unknown; message?: unknown; response?: { code?: unknown } }
        const respCode = e.response && typeof e.response === 'object' ? e.response.code : undefined
        if (typeof respCode === 'string') errorCode = respCode
        else if (typeof e.code === 'string') errorCode = e.code
        if (typeof e.message === 'string') errorMessage = e.message
      }
      return {
        tenantId,
        actorUserId: user.id,
        actorType: 'user' as const,
        category: 'entity' as const,
        action,
        ...(entityType !== undefined ? { entityType } : {}),
        ...(entityId !== undefined ? { entityId } : {}),
        ...(ip !== undefined ? { ipAddress: ip } : {}),
        ...(typeof ua === 'string' ? { userAgent: ua } : {}),
        ...(typeof rid === 'string' ? { requestId: rid } : {}),
        ...(errorCode !== undefined ? { errorCode } : {}),
        ...(errorMessage !== undefined ? { metadata: { errorMessage } } : {}),
        status,
      }
    }

    // Run the subscription inside the async-local store so service-layer
    // explicit audit records (e.g. Invoice/Appointment status transitions) can
    // read the acting user/request context. Audit coverage is interceptor-only
    // for the request-scoped row plus those explicit service-layer records —
    // there is no Prisma middleware backstop.
    return new Observable((subscriber) => {
      httpAuditContextStore.run(httpCtx, () => {
        next
          .handle()
          .pipe(
            tap((response: unknown) => {
              const entityName =
                extractEntityName(response) ?? httpAuditContextStore.getStore()?.entityName
              void this.auditLog.record({
                ...buildRecord('success'),
                ...(entityName !== undefined ? { metadata: { entityName } } : {}),
              })
            }),
            catchError((err: unknown) => {
              void this.auditLog.record(buildRecord('failed', err))
              return throwError(() => err)
            }),
          )
          .subscribe(subscriber)
      })
    })
  }
}
