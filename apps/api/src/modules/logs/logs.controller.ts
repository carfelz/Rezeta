import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UsePipes } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ClientErrorSchema, type ClientErrorDto } from '@rezeta/shared'

@ApiTags('Logs')
@Controller('v1/logs')
export class LogsController {
  private readonly logger = new Logger('ClientError')

  @Public()
  @Post('client-error')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(ClientErrorSchema))
  @ApiOperation({ summary: 'Report a frontend error to server logs' })
  report(@Body() dto: ClientErrorDto): void {
    const prefix = `[${dto.context ?? 'unknown'}]`
    const msg = `${prefix} ${dto.message}`
    if (dto.severity === 'warn') {
      this.logger.warn(msg)
    } else {
      this.logger.error(dto.stack ? `${msg}\n${dto.stack}` : msg)
    }
  }
}
