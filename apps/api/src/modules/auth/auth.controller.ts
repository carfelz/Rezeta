import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
import type { Request } from 'express'
import type { AuthUser } from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { ProvisionRoute } from '../../common/decorators/provision-route.decorator.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { Public } from '../../common/decorators/public.decorator.js'
import type { AuthenticatedRequest } from '../../common/guards/auth.guard.js'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME, type VerifiedToken } from '../../lib/auth/index.js'
import { AuthService, type DevTokenResponse } from './auth.service.js'

const VerifiedTokenParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): VerifiedToken => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    return request.verifiedToken as VerifiedToken
  },
)

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private service: AuthService) {}

  /**
   * POST /v1/auth/dev/token
   *
   * Dev-only token exchange. Accepts both JSON and application/x-www-form-urlencoded
   * (the latter enables Swagger UI's OAuth2 password flow to work directly from the
   * Authorize dialog without any external tooling).
   */
  @Post('dev/token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dev only: get a bearer token',
    description:
      'Exchanges email + password for a bearer JWT. **Non-production only.**\n\n' +
      'Accepts `application/json` (`{ email, password }`) **and** ' +
      '`application/x-www-form-urlencoded` (`username`, `password`) — the latter is what ' +
      "Swagger UI's OAuth2 password flow sends when you click **Authorize**.",
  })
  @ApiBody({
    description: 'Login credentials',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'dr.garcia@rezeta.app' },
        password: { type: 'string', format: 'password', example: 'password123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Bearer token in OAuth2-compatible envelope.',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', description: 'Bearer JWT' },
        token_type: { type: 'string', example: 'bearer' },
        expires_in: { type: 'number', example: 3600 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  @ApiResponse({ status: 403, description: 'Not available in production.' })
  async devToken(@Body() body: Record<string, string>): Promise<DevTokenResponse> {
    // OAuth2 form flow sends `username`; JSON body uses `email`
    const email = body['username'] ?? body['email']
    const password = body['password']
    if (!email || !password) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'email and password are required',
      })
    }
    return this.service.devGetToken(email, password)
  }

  /**
   * POST /v1/auth/provision
   *
   * Idempotent. Resolves the existing User row for the verified token and
   * returns it unchanged on every call. Never creates a Tenant or User —
   * there is no public signup; unknown identities get USER_NOT_PROVISIONED.
   */
  @Post('provision')
  @ProvisionRoute()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(AUTH_BEARER_SCHEME)
  @ApiSecurity(AUTH_OAUTH2_SCHEME)
  @ApiOperation({
    summary: 'Resolve the provisioned user',
    description:
      'Resolves the User row for the verified bearer token. Users are provisioned ' +
      'internally by an admin (POST /v1/users) — this endpoint does not create a Tenant ' +
      'or User; it rejects USER_NOT_PROVISIONED if no row exists yet for this token.',
  })
  @ApiResponse({
    status: 200,
    description: 'The resolved user.',
    schema: { $ref: '#/components/schemas/AuthUser' },
  })
  @ApiResponse({ status: 401, description: 'USER_NOT_PROVISIONED — no User row for this token.' })
  async provision(
    @VerifiedTokenParam() verified: VerifiedToken,
    @Req() req: Request,
  ): Promise<AuthUser> {
    const meta = {
      ...(req.ip ? { ip: req.ip } : {}),
      ...(typeof req.headers['user-agent'] === 'string'
        ? { userAgent: req.headers['user-agent'] }
        : {}),
      ...(typeof req.headers['x-request-id'] === 'string'
        ? { requestId: req.headers['x-request-id'] }
        : {}),
    }
    const user = await this.service.provision(verified, meta)
    return this.service.resolveAuthUser(user)
  }

  /**
   * GET /v1/auth/me
   *
   * Returns the currently authenticated user's profile.
   */
  @Get('me')
  @ApiBearerAuth(AUTH_BEARER_SCHEME)
  @ApiSecurity(AUTH_OAUTH2_SCHEME)
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the authenticated user profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user profile.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', example: '018e3f2a-0000-7000-8000-000000000001' },
        externalUid: { type: 'string', example: 'abc123externaluid' },
        tenantId: {
          type: 'string',
          format: 'uuid',
          example: '018e3f2a-0000-7000-8000-000000000002',
        },
        email: { type: 'string', example: 'dr.garcia@rezeta.app' },
        fullName: { type: 'string', example: 'Dr. Juan García' },
        role: {
          type: 'string',
          enum: ['assistant', 'doctor', 'admin', 'super_admin'],
          example: 'super_admin',
        },
        specialty: { type: 'string', nullable: true, example: 'Cardiología' },
        licenseNumber: { type: 'string', nullable: true, example: '12345-DR' },
        tenantSeededAt: { type: 'string', format: 'date-time', nullable: true },
        capabilities: {
          type: 'object',
          additionalProperties: { type: 'string', enum: ['none', 'view', 'manage'] },
          example: { patients: 'manage', users: 'none' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid bearer token.' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
