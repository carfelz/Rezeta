import { Module } from '@nestjs/common'
import { ProtocolCategoriesController } from './protocol-categories.controller.js'
import { ProtocolCategoriesService } from './protocol-categories.service.js'
import { ProtocolCategoriesRepository } from './protocol-categories.repository.js'

@Module({
  controllers: [ProtocolCategoriesController],
  providers: [ProtocolCategoriesService, ProtocolCategoriesRepository],
  exports: [ProtocolCategoriesService, ProtocolCategoriesRepository],
})
export class ProtocolCategoriesModule {}
