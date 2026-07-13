import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'

/** Per-client fixed-window limit for the public client-error log endpoint. */
export const CLIENT_ERROR_RATE_LIMIT = { max: 20, windowMs: 60_000 } as const

/** Above this many tracked clients, expired windows are swept to bound memory. */
export const MAX_TRACKED_CLIENTS = 10_000

interface Window {
  count: number
  windowStart: number
}

/**
 * In-memory, dependency-free rate limiter for `POST /v1/logs/client-error`.
 *
 * That endpoint is `@Public()` and writes attacker-controllable text to the server
 * logs, so it needs a spam guard. A per-client fixed window (`max` requests per
 * `windowMs`) is sufficient for log-spam protection. State is per-instance — good
 * enough here; a shared store (Redis) would only matter if the limit had to hold
 * exactly across horizontally-scaled instances, which log-spam protection does not.
 */
@Injectable()
export class ClientErrorThrottleGuard implements CanActivate {
  private readonly windows = new Map<string, Window>()

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      ip?: string
      headers?: Record<string, string | string[] | undefined>
    }>()
    const key = clientKey(req)
    const now = Date.now()

    if (this.windows.size > MAX_TRACKED_CLIENTS) this.sweep(now)

    const existing = this.windows.get(key)
    if (!existing || now - existing.windowStart >= CLIENT_ERROR_RATE_LIMIT.windowMs) {
      this.windows.set(key, { count: 1, windowStart: now })
      return true
    }

    if (existing.count >= CLIENT_ERROR_RATE_LIMIT.max) {
      throw new HttpException(
        { code: ErrorCode.RATE_LIMITED, message: 'Too many requests, slow down' },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    existing.count += 1
    return true
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.windowStart >= CLIENT_ERROR_RATE_LIMIT.windowMs) this.windows.delete(key)
    }
  }
}

/** Prefer the first x-forwarded-for hop (real client behind the proxy), else req.ip. */
function clientKey(req: {
  ip?: string
  headers?: Record<string, string | string[] | undefined>
}): string {
  const xff = req.headers?.['x-forwarded-for']
  const forwarded = Array.isArray(xff) ? xff[0] : xff
  const first = forwarded?.split(',')[0]?.trim()
  return first || req.ip || 'unknown'
}
