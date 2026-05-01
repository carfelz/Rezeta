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
  if (method === 'POST' && path.endsWith('/sign')) return 'sign'
  if (method === 'POST' && path.endsWith('/amend')) return 'amend'
  if (method === 'POST') return 'create'
  return 'update'
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
    const entityType = resourceSegment
      ? resourceSegment.charAt(0).toUpperCase() + resourceSegment.slice(1, -1)
      : undefined

    const httpCtx = {
      tenantId,
      actorUserId: user.id,
      ...(typeof rid === 'string' ? { requestId: rid } : {}),
      ...(ip !== undefined ? { ipAddress: ip } : {}),
      ...(typeof ua === 'string' ? { userAgent: ua } : {}),
    }

    const buildRecord = (status: 'success' | 'failed') => ({
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
      status,
    })

    // Wrap subscription inside the async context so Prisma's $use backstop
    // sees the store and skips writing its own audit row.
    return new Observable((subscriber) => {
      httpAuditContextStore.run(httpCtx, () => {
        next
          .handle()
          .pipe(
            tap(() => {
              void this.auditLog.record(buildRecord('success'))
            }),
            catchError((err: unknown) => {
              void this.auditLog.record(buildRecord('failed'))
              return throwError(() => err)
            }),
          )
          .subscribe(subscriber)
      })
    })
  }
}
