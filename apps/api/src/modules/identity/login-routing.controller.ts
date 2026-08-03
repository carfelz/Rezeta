import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { LoginMethodsRequestSchema, type LoginMethodsRequestDto, type LoginMethodsResponseDto } from '@rezeta/shared'
import { Public } from '../../common/decorators/public.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { LoginRoutingService } from './login-routing.service.js'

/**
 * Public login-method routing: given an email, tells the login screen
 * whether to show password/Google, redirect straight to SSO, or offer both.
 * Unauthenticated by design (`@Public()`) — the user hasn't signed in yet
 * when the login screen needs this. See `LoginRoutingService` for the
 * no-user-lookup guarantee.
 */
@ApiTags('Auth')
@Controller('v1/auth')
export class LoginRoutingController {
  constructor(@Inject(LoginRoutingService) private svc: LoginRoutingService) {}

  @Public()
  @Post('login-methods')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve available login methods for an email' })
  @ApiResponse({ status: 200 })
  loginMethods(
    @Body(new ZodValidationPipe(LoginMethodsRequestSchema)) dto: LoginMethodsRequestDto,
  ): Promise<LoginMethodsResponseDto> {
    return this.svc.methodsForEmail(dto.email)
  }
}
