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
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { AuthUser } from '@rezeta/shared'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { ProvisionRoute } from '../../common/decorators/provision-route.decorator.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { Public } from '../../common/decorators/public.decorator.js'
import type { AuthenticatedRequest } from '../../common/guards/firebase-auth.guard.js'
import { AuthService, type DevTokenResponse } from './auth.service.js'

const FirebaseToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DecodedIdToken => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    return request.firebaseToken as DecodedIdToken
  },
)

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private service: AuthService) {}

  /**
   * POST /v1/auth/dev/token
   *
   * Dev-only Firebase token exchange. Accepts both JSON and application/x-www-form-urlencoded
   * (the latter enables Swagger UI's OAuth2 password flow to work directly from the
   * Authorize dialog without any external tooling).
   */
  @Post('dev/token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dev only: get a Firebase ID token',
    description:
      'Exchanges email + password for a Firebase ID token. **Non-production only.**\n\n' +
      'Accepts `application/json` (`{ email, password }`) **and** ' +
      '`application/x-www-form-urlencoded` (`username`, `password`) — the latter is what ' +
      "Swagger UI's OAuth2 password flow sends when you click **Authorize**.",
  })
  @ApiBody({
    description: 'Firebase credentials',
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
    description: 'Firebase ID token in OAuth2-compatible envelope.',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', description: 'Firebase ID token (JWT)' },
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
      throw new BadRequestException('email and password are required')
    }
    return this.service.devGetToken(email, password)
  }

  /**
   * POST /v1/auth/provision
   *
   * Idempotent. On first call: creates a Tenant + User atomically and returns the user.
   * On repeat calls: returns the existing user unchanged.
   */
  @Post('provision')
  @ProvisionRoute()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('firebase-jwt')
  @ApiSecurity('firebase-oauth2')
  @ApiOperation({
    summary: 'Provision user + tenant',
    description:
      'Idempotent. Creates a Tenant + User on first call; returns the existing user on ' +
      'subsequent calls. Must be called once after signup before any other endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'The provisioned (or existing) user.',
    schema: { $ref: '#/components/schemas/AuthUser' },
  })
  async provision(
    @FirebaseToken() decoded: DecodedIdToken,
    @Req() req: Request,
  ): Promise<AuthUser> {
    const meta = {
      ip: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      requestId:
        typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
    }
    const user = await this.service.provision(decoded, meta)
    return this.service.toAuthUser(user)
  }

  /**
   * GET /v1/auth/me
   *
   * Returns the currently authenticated user's profile.
   */
  @Get('me')
  @ApiBearerAuth('firebase-jwt')
  @ApiSecurity('firebase-oauth2')
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
        firebaseUid: { type: 'string', example: 'abc123firebaseuid' },
        tenantId: {
          type: 'string',
          format: 'uuid',
          example: '018e3f2a-0000-7000-8000-000000000002',
        },
        email: { type: 'string', example: 'dr.garcia@rezeta.app' },
        fullName: { type: 'string', example: 'Dr. Juan García' },
        role: { type: 'string', enum: ['owner', 'doctor'], example: 'owner' },
        specialty: { type: 'string', nullable: true, example: 'Cardiología' },
        licenseNumber: { type: 'string', nullable: true, example: '12345-DR' },
        tenantSeededAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token.' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
