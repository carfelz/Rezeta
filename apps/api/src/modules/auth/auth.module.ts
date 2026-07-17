import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { UsersModule } from '../users/index.js'
import { PermissionsModule } from '../permissions/index.js'

@Module({
  imports: [UsersModule, PermissionsModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthFeatureModule {}
