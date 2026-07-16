import { Module } from '@nestjs/common'
import { PermissionsService } from './permissions.service.js'
import { PermissionsRepository } from './permissions.repository.js'

@Module({
  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService],
})
export class PermissionsModule {}
