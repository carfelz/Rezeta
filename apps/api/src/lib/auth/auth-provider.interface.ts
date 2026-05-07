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
}
