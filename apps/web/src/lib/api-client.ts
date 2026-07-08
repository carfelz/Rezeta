import { authClient } from './auth'
import { useLoadingStore } from '@/store/loading.store'
import { toastStrings } from './toasts'
import type { ApiError } from '@rezeta/shared'

const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? ''
const TOKEN_TIMEOUT_MS = 15_000
const REQUEST_TIMEOUT_MS = 30_000

export interface RequestOptions {
  /** Skip the global loading indicator (autosave/polling traffic). */
  silent?: boolean
}

export class ApiRequestError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

async function withLoading<T>(silent: boolean | undefined, run: () => Promise<T>): Promise<T> {
  if (silent) return run()
  useLoadingStore.getState().requestStarted()
  try {
    return await run()
  } finally {
    useLoadingStore.getState().requestFinished()
  }
}

async function request<T>(path: string, init?: RequestInit, opts?: RequestOptions): Promise<T> {
  return withLoading(opts?.silent, async () => {
    const token = await withTimeout(authClient.getToken(), TOKEN_TIMEOUT_MS, toastStrings.errorRequestTimeout)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    }

    const response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

    if (response.status === 204) return undefined as T

    if (response.status === 401) {
      await authClient.signOut()
    }

    const body = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      throw new ApiRequestError(body['error'] as ApiError)
    }

    return body['data'] as T
  })
}

async function downloadBlob(path: string, opts?: RequestOptions): Promise<Blob> {
  return withLoading(opts?.silent, async () => {
    const token = await withTimeout(authClient.getToken(), TOKEN_TIMEOUT_MS, toastStrings.errorRequestTimeout)
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    const response = await fetch(`${API_BASE}${path}`, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (response.status === 401) {
      await authClient.signOut()
    }
    if (!response.ok) {
      const body = (await response.json()) as Record<string, unknown>
      throw new ApiRequestError(body['error'] as ApiError)
    }
    return response.blob()
  })
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions): Promise<T> => request<T>(path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, opts),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, opts),
  delete: (path: string, opts?: RequestOptions): Promise<void> =>
    request<void>(path, { method: 'DELETE' }, opts),
  download: (path: string, opts?: RequestOptions): Promise<Blob> => downloadBlob(path, opts),
}
