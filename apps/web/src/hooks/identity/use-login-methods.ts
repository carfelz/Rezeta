import type { LoginMethodsResponseDto } from '@rezeta/shared'

const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? ''
const LOGIN_METHODS_TIMEOUT_MS = 3_000

/** Fail-open default: password + Google, same as an unconfigured tenant. */
const FAIL_OPEN_METHODS: LoginMethodsResponseDto = { methods: ['password', 'google'] }

/**
 * Resolves the available sign-in methods for an email, so the login screen
 * can swap in an SSO-only or SSO+password layout before the user submits.
 * Called with plain `fetch` — not `apiClient` — because the endpoint is
 * public and `apiClient` attaches an auth bearer token the user doesn't have
 * yet at this point.
 *
 * Fails open on any error (network failure, timeout, non-2xx response): the
 * login screen must never get stuck unable to show the password form because
 * of a backend hiccup.
 */
export async function fetchLoginMethods(email: string): Promise<LoginMethodsResponseDto> {
  try {
    const response = await fetch(`${API_BASE}/v1/auth/login-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(LOGIN_METHODS_TIMEOUT_MS),
    })

    if (!response.ok) return FAIL_OPEN_METHODS

    const body = (await response.json()) as { data?: LoginMethodsResponseDto }
    return body.data ?? FAIL_OPEN_METHODS
  } catch {
    return FAIL_OPEN_METHODS
  }
}
