import {
  Injectable,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common'
import type { AuthUser, OnboardingCustomInput } from '@rezeta/shared'
import { TenantSeedingService } from '../tenant-seeding/tenant-seeding.service.js'
import { AuthService } from '../auth/auth.service.js'
import { UsersRepository } from '../users/users.repository.js'
import { getStarterFixtures } from '../../lib/starter-fixtures/index.js'

export interface StarterCandidate {
  clientId: string
  name: string
  schema: object
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(TenantSeedingService) private seeder: TenantSeedingService,
    @Inject(AuthService) private authService: AuthService,
    @Inject(UsersRepository) private users: UsersRepository,
  ) {}

  getStarters(locale: 'es' | 'en' = 'es'): StarterCandidate[] {
    return getStarterFixtures(locale).map((f, i) => ({
      clientId: `starter-${i}`,
      name: f.name,
      schema: f.schema,
    }))
  }

  async seedDefault(externalUid: string, locale: 'es' | 'en' = 'es'): Promise<AuthUser> {
    // Resolve tenantId from the authenticated user's tenant
    const user = await this.users.findByExternalUid(externalUid)
    if (!user) throw new InternalServerErrorException('User not found after auth')
    await this.seeder.seedDefault(user.tenantId, locale)
    const refreshed = await this.users.findByExternalUid(externalUid)
    if (!refreshed) throw new InternalServerErrorException('User not found after seeding')
    return this.authService.toAuthUser(refreshed)
  }

  async seedCustom(externalUid: string, input: OnboardingCustomInput): Promise<AuthUser> {
    const user = await this.users.findByExternalUid(externalUid)
    if (!user) throw new InternalServerErrorException('User not found after auth')
    await this.seeder.seedCustom(
      user.tenantId,
      input.templates.map((t) => ({
        clientId: t.clientId,
        name: t.name,
        ...(t.suggestedSpecialty !== undefined ? { suggestedSpecialty: t.suggestedSpecialty } : {}),
        schema: t.schema,
      })),
    )
    const refreshed = await this.users.findByExternalUid(externalUid)
    if (!refreshed) throw new InternalServerErrorException('User not found after seeding')
    return this.authService.toAuthUser(refreshed)
  }
}
