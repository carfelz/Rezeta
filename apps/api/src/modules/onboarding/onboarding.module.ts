import { Module } from '@nestjs/common'
import { OnboardingController } from './onboarding.controller.js'
import { OnboardingService } from './onboarding.service.js'
import { TenantSeedingModule } from '../tenant-seeding/index.js'
import { AuthFeatureModule } from '../auth/index.js'
import { UsersModule } from '../users/index.js'

@Module({
  imports: [TenantSeedingModule, AuthFeatureModule, UsersModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
