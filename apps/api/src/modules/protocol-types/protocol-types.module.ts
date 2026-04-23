import { Module } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import { ProtocolTypesRepository } from './protocol-types.repository.js'
import { ProtocolTypesService } from './protocol-types.service.js'
import { ProtocolTypesController } from './protocol-types.controller.js'

@Module({
  controllers: [ProtocolTypesController],
  providers: [PrismaService, ProtocolTypesRepository, ProtocolTypesService],
  exports: [ProtocolTypesRepository, ProtocolTypesService],
})
export class ProtocolTypesModule {}
