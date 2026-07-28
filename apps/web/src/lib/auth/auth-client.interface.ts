/** Opaque session — concrete shape depends on the auth provider. */
export type AuthSession = object

/** Returned by `enrollTotp()` — display `secret`/`otpauthUrl` for the user to add to their authenticator app, then call `verify(code)` once they enter the 6-digit code it produces. */
export interface TotpEnrollment {
  secret: string
  otpauthUrl: string
  verify(code: string): Promise<void>
}

export interface IAuthClient {
  /** Subscribe to session changes. Returns unsubscribe fn. */
  onAuthStateChanged(cb: (session: AuthSession | null) => void): () => void

  /** Get current bearer token (or null if signed out). */
  getToken(): Promise<string | null>

  /** Email/password sign-in. Throws with `code: 'auth/multi-factor-auth-required'` when the account has TOTP enrolled — call `completeTotpSignIn` next. */
  signIn(email: string, password: string): Promise<void>

  /** Sign the user out. Resolves on completion; never throws. */
  signOut(): Promise<void>

  /** Verify a password-reset (set-password) code; resolves to the account email. */
  verifyPasswordResetCode(oobCode: string): Promise<string>

  /** Complete a password reset / first-login set-password with the given code. */
  confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>

  /** Translate provider-specific error code to localized user-facing string. */
  errorCodeToMessage(code: string): string

  /** Begins TOTP enrollment for the current signed-in user. Requires an active session (call after sign-in, not during the MFA challenge). */
  enrollTotp(): Promise<TotpEnrollment>

  /** Removes the current user's enrolled TOTP factor, if any. No-op if none is enrolled. */
  unenrollTotp(): Promise<void>

  /**
   * Completes a sign-in interrupted by `signIn`'s `auth/multi-factor-auth-required`
   * error — call after the user submits the 6-digit code from their
   * authenticator app. Throws if there is no pending multi-factor sign-in
   * (i.e. `signIn` never hit that error, or this was already called once).
   */
  completeTotpSignIn(code: string): Promise<void>
}
