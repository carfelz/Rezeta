import { Module } from '@nestjs/common'
import { LogsController } from './logs.controller.js'
import { ClientErrorThrottleGuard } from '../../common/guards/client-error-throttle.guard.js'

@Module({
  controllers: [LogsController],
  providers: [ClientErrorThrottleGuard],
})
export class LogsModule {}
