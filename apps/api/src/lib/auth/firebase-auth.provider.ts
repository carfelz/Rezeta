/** Firebase implementation of IAuthProvider. All firebase-admin imports are confined to this file. To migrate, replace this class with a new IAuthProvider implementation and update AUTH_PROVIDER in auth.module.ts. **/
import {
  Injectable,
  OnModuleInit,
  Inject,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as admin from 'firebase-admin'
import { ErrorCode } from '@rezeta/shared'
import type { AppConfig } from '../../config/configuration.js'
import type {
  IAuthProvider,
  VerifiedToken,
  SignedInToken,
  OidcProviderConfigInput,
} from './auth-provider.interface.js'

@Injectable()
export class FirebaseAuthProvider implements IAuthProvider, OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthProvider.name)
  private app: admin.app.App | null = null

  constructor(@Inject(ConfigService) private config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0] as admin.app.App
      return
    }

    let { projectId, clientEmail, privateKey } = this.config.get('firebase', { infer: true })

    if ((!projectId || !clientEmail || !privateKey) && process.env['FIREBASE_ADMIN_KEY']) {
      try {
        const parsed = JSON.parse(process.env['FIREBASE_ADMIN_KEY']) as {
          project_id?: string
          client_email?: string
          private_key?: string
        }
        projectId = projectId || parsed.project_id || ''
        clientEmail = clientEmail || parsed.client_email || ''
        privateKey = privateKey || parsed.private_key || ''
      } catch {
        this.logger.error('Failed to parse FIREBASE_ADMIN_KEY — must be valid JSON')
      }
    }

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase service account credentials missing — Auth guard will reject all requests. ' +
          'Set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, ' +
          'or FIREBASE_ADMIN_KEY (JSON blob for Cloud Run).',
      )
      return
    }

    this.app = admin.initializeApp({
      projectId,
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    })

    this.logger.log(`Firebase Admin initialized for project: ${projectId}`)
  }

  async verifyToken(token: string): Promise<VerifiedToken> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }

    let decoded: admin.auth.DecodedIdToken
    try {
      decoded = await this.app.auth().verifyIdToken(token)
    } catch (err) {
      this.logger.debug(`Token verification failed: ${(err as Error).message}`)
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'ID token is invalid or expired',
      })
    }

    return {
      identityId: decoded.uid,
      email: decoded.email ?? '',
      rawClaims: decoded as unknown as Record<string, unknown>,
    }
  }

  async signInWithPassword(email: string, password: string): Promise<SignedInToken> {
    const webApiKey = this.config.get('firebase', { infer: true }).webApiKey
    if (!webApiKey) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider missing web API key',
      })
    }

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    )

    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } }
      throw new UnauthorizedException(body.error?.message ?? 'Invalid credentials')
    }

    const data = (await res.json()) as { idToken: string; expiresIn: string }
    return { accessToken: data.idToken, expiresIn: parseInt(data.expiresIn, 10) }
  }

  async revokeUserSessions(identityId: string): Promise<void> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      await this.app.auth().revokeRefreshTokens(identityId)
    } catch (err) {
      this.logger.error(`Failed to revoke sessions for ${identityId}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to revoke sessions',
      })
    }
  }

  async deleteUser(identityId: string): Promise<void> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      await this.app.auth().deleteUser(identityId)
    } catch (err) {
      this.logger.error(`Failed to delete user ${identityId}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to delete user from auth provider',
      })
    }
  }

  async createUser(email: string): Promise<{ identityId: string }> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      const record = await this.app.auth().createUser({ email })
      return { identityId: record.uid }
    } catch (err) {
      if (isFirebaseErrorCode(err, 'auth/email-already-exists')) {
        throw new ConflictException({
          code: ErrorCode.USER_ALREADY_EXISTS,
          message: `A user with email ${email} already exists`,
        })
      }
      this.logger.error(`Failed to create user ${email}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to create user in auth provider',
      })
    }
  }

  async generatePasswordResetLink(email: string): Promise<string> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      return await this.app.auth().generatePasswordResetLink(email)
    } catch (err) {
      this.logger.error(`Failed to generate reset link for ${email}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to generate set-password link',
      })
    }
  }

  async getMfaEnrollment(identityId: string): Promise<{ enrolledAt: Date | null }> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      const user = await this.app.auth().getUser(identityId)
      const totpFactor = user.multiFactor?.enrolledFactors.find((f) => f.factorId === 'totp')
      if (!totpFactor) return { enrolledAt: null }
      return { enrolledAt: totpFactor.enrollmentTime ? new Date(totpFactor.enrollmentTime) : new Date() }
    } catch (err) {
      this.logger.error(`Failed to read MFA enrollment for ${identityId}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to read MFA enrollment',
      })
    }
  }

  async createOidcProviderConfig(input: Required<OidcProviderConfigInput>): Promise<void> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    await this.app.auth().createProviderConfig({
      providerId: input.providerId,
      displayName: input.displayName,
      issuer: input.issuer,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      enabled: input.enabled,
      responseType: { code: true },
    } as admin.auth.OIDCAuthProviderConfig)
  }

  async updateOidcProviderConfig(input: OidcProviderConfigInput): Promise<void> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    const patch: Record<string, unknown> = {
      displayName: input.displayName,
      issuer: input.issuer,
      clientId: input.clientId,
      enabled: input.enabled,
      responseType: { code: true },
    }
    if (input.clientSecret) patch['clientSecret'] = input.clientSecret
    await this.app.auth().updateProviderConfig(input.providerId, patch)
  }

  async deleteProviderConfig(providerId: string): Promise<void> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      await this.app.auth().deleteProviderConfig(providerId)
    } catch (err) {
      if (isFirebaseErrorCode(err, 'auth/configuration-not-found')) return
      throw err
    }
  }
}

/** Structural check for a Firebase Admin SDK error code, without importing firebase-admin's error types. */
function isFirebaseErrorCode(err: unknown, code: string): boolean {
  return (
    err !== null && typeof err === 'object' && 'code' in err && (err as { code: string }).code === code
  )
}
