export interface VerifiedToken {
  /** The provider-issued subject identifier (e.g. Firebase UID, future: our own UUID) */
  externalUid: string
  /** Email extracted from the verified token */
  email: string
  /** Raw decoded claims — kept for extensibility, do not use directly in business logic */
  rawClaims: Record<string, unknown>
}

export interface SignedInToken {
  /** Bearer token clients send back on subsequent requests. */
  accessToken: string
  /** Seconds until the token expires. */
  expiresIn: number
}

export interface OidcProviderConfigInput {
  /** Provider identifier, must be prefixed `oidc.` (e.g. `oidc.hospital-x1`). */
  providerId: string
  /** Human-readable label shown to admins. */
  displayName: string
  /** OIDC issuer URL. */
  issuer: string
  /** OAuth client ID registered with the issuer. */
  clientId: string
  /** OAuth client secret. Omit on update to keep the existing secret unchanged. */
  clientSecret?: string
  /** Whether the connection accepts sign-ins. */
  enabled: boolean
}

export interface IAuthProvider {
  /**
   * Verify a raw bearer token string.
   * Throws UnauthorizedException if the token is invalid or expired.
   * Returns a VerifiedToken if valid.
   */
  verifyToken(token: string): Promise<VerifiedToken>

  /**
   * Exchange email + password for a bearer token (dev/test login flow).
   * Implementations MAY no-op or throw in production — callers must gate by env.
   */
  signInWithPassword(email: string, password: string): Promise<SignedInToken>

  /**
   * Revoke all active sessions for a given external UID.
   * Used when a user is suspended or their account is compromised.
   * No-op if the provider does not support server-side revocation.
   */
  revokeUserSessions(externalUid: string): Promise<void>

  /**
   * Delete the identity record from the auth provider.
   * Called when a user account is permanently removed.
   * This does NOT delete the User row in Postgres — that is the caller's responsibility.
   */
  deleteUser(externalUid: string): Promise<void>

  /**
   * Create an identity record in the auth provider for an invited user.
   * Returns the provider UID to store on the User row. No password is set —
   * the user establishes one via the set-password link (generatePasswordResetLink).
   */
  createUser(email: string): Promise<{ externalUid: string }>

  /**
   * Generate a set-password / first-login link (a password-reset link) for the
   * given email. The caller emails it (or, in dev, logs it).
   */
  generatePasswordResetLink(email: string): Promise<string>

  /**
   * Read the current user's MFA enrollment state directly from the provider
   * (identity design §4 — this slice mirrors state onto `User.mfaEnrolledAt`
   * rather than a full `MfaEnrollment` table; see identity slice 4 plan §Out
   * of scope). TOTP only this slice — a phone/SMS factor is never returned
   * as "enrolled" here even if present, since SMS MFA is deferred.
   */
  getMfaEnrollment(externalUid: string): Promise<{ enrolledAt: Date | null }>

  /**
   * Register a new OIDC SSO connection with the provider (an Identity Platform
   * "provider config"). `clientSecret` is required on create.
   */
  createOidcProviderConfig(input: Required<OidcProviderConfigInput>): Promise<void>

  /**
   * Update an existing OIDC SSO connection, including enabling/disabling it via
   * the `enabled` flag — there is no separate enable/disable method.
   * Omit `clientSecret` to keep the existing secret unchanged.
   */
  updateOidcProviderConfig(input: OidcProviderConfigInput): Promise<void>

  /**
   * Delete an SSO connection's provider config. Idempotent — swallows a
   * not-found error so callers can delete without checking existence first.
   */
  deleteProviderConfig(providerId: string): Promise<void>
}
