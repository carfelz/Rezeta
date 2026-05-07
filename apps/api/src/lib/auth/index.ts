export type { IAuthProvider, VerifiedToken, SignedInToken } from './auth-provider.interface.js'
export { AUTH_PROVIDER, AuthModule } from './auth.module.js'

/** Swagger security scheme names — provider-neutral. Keep in sync with main.ts. */
export const AUTH_BEARER_SCHEME = 'bearer-jwt'
export const AUTH_OAUTH2_SCHEME = 'oauth2-password'
