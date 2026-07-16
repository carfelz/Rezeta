import { Module } from '@nestjs/common'
import { TenantSeedingService } from './tenant-seeding.service.js'
import { PermissionsModule } from '../permissions/index.js'

@Module({
  imports: [PermissionsModule],
  providers: [TenantSeedingService],
  exports: [TenantSeedingService],
})
export class TenantSeedingModule {}
