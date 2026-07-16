import { Module } from '@nestjs/common'
import { PermissionsService } from './permissions.service.js'
import { PermissionsRepository } from './permissions.repository.js'
import { PermissionsController } from './permissions.controller.js'

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService],
})
export class PermissionsModule {}
