import { Module } from '@nestjs/common'
import { TenantSeedingService } from './tenant-seeding.service.js'

@Module({
  providers: [TenantSeedingService],
  exports: [TenantSeedingService],
})
export class TenantSeedingModule {}
