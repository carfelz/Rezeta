import { Global, Module } from '@nestjs/common'
import { AuditLogService } from './audit-log.service.js'
import { AuditLogRepository } from './audit-log.repository.js'
import { AuditLogController } from './audit-log.controller.js'

@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditLogRepository],
  exports: [AuditLogService],
})
export class AuditLogModule {}
