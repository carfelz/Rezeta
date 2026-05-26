import { Module } from '@nestjs/common'
import { ProtocolsController } from './protocols.controller.js'
import { ProtocolsService } from './protocols.service.js'
import { ProtocolsRepository } from './protocols.repository.js'

@Module({
  controllers: [ProtocolsController],
  providers: [ProtocolsService, ProtocolsRepository],
  exports: [ProtocolsService],
})
export class ProtocolsModule {}
