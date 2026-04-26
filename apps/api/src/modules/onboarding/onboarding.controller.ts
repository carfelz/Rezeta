import { Controller, Get, Post, Body, Inject, HttpCode, HttpStatus } from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { OnboardingCustomSchema } from '@rezeta/shared'
import type { AuthUser, OnboardingCustomInput } from '@rezeta/shared'
import { OnboardingService, type StarterCandidate } from './onboarding.service.js'

@ApiTags('Onboarding')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/onboarding')
export class OnboardingController {
  constructor(@Inject(OnboardingService) private service: OnboardingService) {}

  @Get('starters')
  @ApiOperation({
    summary: 'Get starter template candidates',
    description:
      'Returns the 5 starter template + type candidates for the personalizar path. ' +
      'No side effects — pure read. Use these as the starting point for `POST /v1/onboarding/custom`.',
  })
  @ApiResponse({ status: 200, description: 'Array of 5 starter candidates.' })
  getStarters(): StarterCandidate[] {
    return this.service.getStarters()
  }

  @Post('default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seed with default config',
    description:
      'Seeds the tenant with the 5 starter templates and 5 default types (Emergencia, ' +
      'Procedimiento, Medicación, Diagnóstico, Fisioterapia). ' +
      'Idempotent — returns 409 if already seeded.',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated AuthUser with `tenantSeededAt` set.',
  })
  @ApiResponse({ status: 409, description: 'Tenant already seeded.' })
  async seedDefault(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.service.seedDefault(user.id, user.firebaseUid)
  }

  @Post('custom')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seed with custom config',
    description:
      "Seeds the tenant with the doctor's chosen templates and types from the personalizar flow. " +
      'Idempotent — returns 409 if already seeded.',
  })
  @ApiBody({
    description: 'Custom templates and types to seed.',
    schema: {
      type: 'object',
      required: ['templates', 'types'],
      properties: {
        templates: {
          type: 'array',
          description: 'Template candidates (min 1).',
          items: {
            type: 'object',
            required: ['clientId', 'name', 'schema'],
            properties: {
              clientId: {
                type: 'string',
                description: 'Temporary client-side ID used to link types.',
                example: 'tpl-emergencia',
              },
              name: { type: 'string', example: 'Intervención de emergencia' },
              schema: { type: 'object', description: 'Template schema JSON.' },
            },
          },
        },
        types: {
          type: 'array',
          description: 'Type candidates (min 1).',
          items: {
            type: 'object',
            required: ['name', 'templateClientId'],
            properties: {
              name: { type: 'string', example: 'Emergencia' },
              templateClientId: {
                type: 'string',
                description: 'Must reference a clientId from the templates array.',
                example: 'tpl-emergencia',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated AuthUser with `tenantSeededAt` set.' })
  @ApiResponse({ status: 409, description: 'Tenant already seeded.' })
  @ApiResponse({
    status: 422,
    description: 'Validation failed (templateClientId not found, duplicate names, etc.).',
  })
  async seedCustom(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(OnboardingCustomSchema)) body: OnboardingCustomInput,
  ): Promise<AuthUser> {
    return this.service.seedCustom(user.firebaseUid, body)
  }
}
