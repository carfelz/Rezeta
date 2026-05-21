const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? ''

interface LogPayload {
  message: string
  stack?: string
  url?: string
  context?: string
  severity: 'error' | 'warn'
}

function post(payload: LogPayload): void {
  void fetch(`${API_BASE}/v1/logs/client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}

export const logger = {
  error(message: string, opts?: { stack?: string; context?: string }): void {
    console.error(`[${opts?.context ?? 'app'}]`, message, opts?.stack ?? '')
    post({
      message,
      stack: opts?.stack,
      url: window.location.pathname,
      context: opts?.context,
      severity: 'error',
    })
  },

  warn(message: string, opts?: { context?: string }): void {
    console.warn(`[${opts?.context ?? 'app'}]`, message)
    post({
      message,
      url: window.location.pathname,
      context: opts?.context,
      severity: 'warn',
    })
  },
}
