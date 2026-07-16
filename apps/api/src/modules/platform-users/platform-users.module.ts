import { Module } from '@nestjs/common'
import { PlatformUsersRepository } from './platform-users.repository.js'

@Module({
  providers: [PlatformUsersRepository],
  exports: [PlatformUsersRepository],
})
export class PlatformUsersModule {}
