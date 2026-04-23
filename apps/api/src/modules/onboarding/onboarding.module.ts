import { Module } from '@nestjs/common'
import { OnboardingController } from './onboarding.controller.js'
import { OnboardingService } from './onboarding.service.js'
import { TenantSeedingModule } from '../tenant-seeding/index.js'
import { AuthModule } from '../auth/index.js'

@Module({
  imports: [TenantSeedingModule, AuthModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
