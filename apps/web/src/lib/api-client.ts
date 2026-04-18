import { auth } from './firebase'
import type { ApiError } from '@rezeta/shared'

const API_BASE = import.meta.env['VITE_API_URL'] as string | undefined ?? ''

export class ApiRequestError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
  }
}

async function getToken(): Promise<string | null> {
  const user = auth?.currentUser
  return user ? user.getIdToken() : null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined ?? {}),
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (response.status === 204) return undefined as T

  const body = await response.json() as Record<string, unknown>

  if (!response.ok) {
    throw new ApiRequestError(body['error'] as ApiError)
  }

  return body['data'] as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}
