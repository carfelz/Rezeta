import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module.js'
import { PlatformUsersRepository } from './platform-users.repository.js'
import { PlatformUsersService } from './platform-users.service.js'
import { StaffPlatformUsersController } from './staff-platform-users.controller.js'

@Module({
  imports: [UsersModule],
  controllers: [StaffPlatformUsersController],
  providers: [PlatformUsersRepository, PlatformUsersService],
  exports: [PlatformUsersRepository, PlatformUsersService],
})
export class PlatformUsersModule {}
