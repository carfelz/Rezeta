/** Opaque session — concrete shape depends on the auth provider. */
export type AuthSession = object

export interface IAuthClient {
  /** Subscribe to session changes. Returns unsubscribe fn. */
  onAuthStateChanged(cb: (session: AuthSession | null) => void): () => void

  /** Get current bearer token (or null if signed out). */
  getToken(): Promise<string | null>

  /** Email/password sign-in. */
  signIn(email: string, password: string): Promise<void>

  /** Sign the user out. Resolves on completion; never throws. */
  signOut(): Promise<void>

  /** Translate provider-specific error code to localized user-facing string. */
  errorCodeToMessage(code: string): string
}
