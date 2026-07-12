import {
  Injectable,
  Inject,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common'
import type { AuthUser, OnboardingCustomInput } from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import { TenantSeedingService } from '../tenant-seeding/tenant-seeding.service.js'
import { AuthService } from '../auth/auth.service.js'
import { UsersRepository } from '../users/users.repository.js'
import { getStarterFixtures } from '../../lib/starter-fixtures/index.js'

export interface StarterCandidate {
  clientId: string
  name: string
  categoryName: string
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
      categoryName: f.categoryName,
      schema: f.schema,
    }))
  }

  async seedDefault(externalUid: string, locale: 'es' | 'en' = 'es'): Promise<AuthUser> {
    // Resolve tenantId from the authenticated user's tenant
    const user = await this.users.findByExternalUid(externalUid)
    if (!user) throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'User not found after auth',
      })
    await this.seeder.seedDefault(user.tenantId, locale)
    const refreshed = await this.users.findByExternalUid(externalUid)
    if (!refreshed) throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'User not found after seeding',
      })
    return this.authService.toAuthUser(refreshed)
  }

  async seedCustom(externalUid: string, input: OnboardingCustomInput): Promise<AuthUser> {
    // Validate cross-references before hitting the DB
    const templateClientIds = new Set(input.templates.map((t) => t.clientId))
    for (const type of input.types) {
      if (!templateClientIds.has(type.templateClientId)) {
        throw new BadRequestException({
          code: ErrorCode.ONBOARDING_UNKNOWN_TEMPLATE,
          message: `Type "${type.name}" references unknown templateClientId "${type.templateClientId}"`,
        })
      }
    }

    const user = await this.users.findByExternalUid(externalUid)
    if (!user) throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'User not found after auth',
      })
    await this.seeder.seedCustom(
      user.tenantId,
      input.templates.map((t) => ({
        clientId: t.clientId,
        name: t.name,
        schema: t.schema,
      })),
      input.types,
    )
    const refreshed = await this.users.findByExternalUid(externalUid)
    if (!refreshed) throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'User not found after seeding',
      })
    return this.authService.toAuthUser(refreshed)
  }
}
