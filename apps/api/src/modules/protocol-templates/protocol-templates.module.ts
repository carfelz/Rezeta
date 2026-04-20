import { Module } from '@nestjs/common'
import { ProtocolTemplatesController } from './protocol-templates.controller.js'
import { ProtocolTemplatesService } from './protocol-templates.service.js'
import { ProtocolTemplatesRepository } from './protocol-templates.repository.js'

@Module({
  controllers: [ProtocolTemplatesController],
  providers: [ProtocolTemplatesService, ProtocolTemplatesRepository],
  exports: [ProtocolTemplatesService, ProtocolTemplatesRepository],
})
export class ProtocolTemplatesModule {}
