import { Controller, Get, Post, Body, Inject, HttpCode, HttpStatus } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { OnboardingCustomSchema } from '@rezeta/shared'
import type { AuthUser, OnboardingCustomInput } from '@rezeta/shared'
import { OnboardingService, type StarterCandidate } from './onboarding.service.js'

@Controller('v1/onboarding')
export class OnboardingController {
  constructor(@Inject(OnboardingService) private service: OnboardingService) {}

  /**
   * GET /v1/onboarding/starters
   *
   * Returns the 5 starter template candidates for the personalizar path.
   * No side effects — pure read.
   */
  @Get('starters')
  getStarters(): StarterCandidate[] {
    return this.service.getStarters()
  }

  /**
   * POST /v1/onboarding/default
   *
   * Seeds the tenant with the 5 starter templates + 5 default types.
   * Returns the updated AuthUser (tenantSeededAt will now be set).
   * Idempotent in spirit — responds 409 if already seeded.
   */
  @Post('default')
  @HttpCode(HttpStatus.OK)
  async seedDefault(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.service.seedDefault(user.id, user.firebaseUid)
  }

  /**
   * POST /v1/onboarding/custom
   *
   * Seeds the tenant with the doctor's chosen templates and types.
   * Returns the updated AuthUser (tenantSeededAt will now be set).
   */
  @Post('custom')
  @HttpCode(HttpStatus.OK)
  async seedCustom(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(OnboardingCustomSchema)) body: OnboardingCustomInput,
  ): Promise<AuthUser> {
    return this.service.seedCustom(user.firebaseUid, body)
  }
}
