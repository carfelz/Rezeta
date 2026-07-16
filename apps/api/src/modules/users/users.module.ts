import { Module } from '@nestjs/common'
import { UsersController } from './users.controller.js'
import { UsersManagementController } from './users-management.controller.js'
import { UsersService } from './users.service.js'
import { UsersRepository } from './users.repository.js'
import { InvitationMailerService } from './invitation-mailer.service.js'

@Module({
  controllers: [UsersController, UsersManagementController],
  providers: [UsersService, UsersRepository, InvitationMailerService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
