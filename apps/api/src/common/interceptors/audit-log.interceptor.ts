import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common'
import type { Request } from 'express'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { PrismaService } from '../../lib/prisma.service.js'
import type { AuthUser } from '@rezeta/shared'

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

// Maps HTTP method + route convention to an audit action verb
function resolveAction(method: string, path: string): string {
  if (method === 'DELETE') return 'delete'
  if (method === 'POST' && path.endsWith('/sign')) return 'sign'
  if (method === 'POST' && path.endsWith('/amend')) return 'amend'
  if (method === 'POST') return 'create'
  if (method === 'PATCH' || method === 'PUT') return 'update'
  return method.toLowerCase()
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser
  tenantId?: string
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()

    if (!MUTATION_METHODS.has(request.method)) return next.handle()

    const user = request.user
    const tenantId = request.tenantId

    if (!user || !tenantId) return next.handle()

    return next.handle().pipe(
      tap(() => {
        const entityId = (request.params as Record<string, string>)['id']
        if (!entityId) return

        // Derive entity type from path: /v1/patients/:id → Patient
        const segments = request.path.split('/').filter(Boolean)
        const resourceSegment = segments.find((s) => !s.startsWith('v') && s !== entityId)
        const entityType = resourceSegment
          ? resourceSegment.charAt(0).toUpperCase() + resourceSegment.slice(1, -1)
          : 'Unknown'

        void this.prisma.auditLog.create({
          data: {
            tenantId,
            userId: user.id,
            entityType,
            entityId,
            action: resolveAction(request.method, request.path),
            ipAddress: request.ip ?? null,
            userAgent: request.headers['user-agent'] ?? null,
          },
        })
      }),
    )
  }
}
