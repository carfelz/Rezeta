import { Module } from '@nestjs/common'
import { ProtocolsController } from './protocols.controller.js'
import { ProtocolsService } from './protocols.service.js'
import { ProtocolsRepository } from './protocols.repository.js'
import { ProtocolTemplatesModule } from '../protocol-templates/index.js'

@Module({
  imports: [ProtocolTemplatesModule],
  controllers: [ProtocolsController],
  providers: [ProtocolsService, ProtocolsRepository],
  exports: [ProtocolsService],
})
export class ProtocolsModule {}
