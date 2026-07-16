import { Module } from '@nestjs/common'
import { TenantSeedingModule } from '../tenant-seeding/index.js'
import { UsersModule } from '../users/index.js'
import { StaffController } from './staff.controller.js'
import { StaffService } from './staff.service.js'

@Module({
  imports: [TenantSeedingModule, UsersModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
