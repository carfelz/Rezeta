import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common'

export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ tenantId: string }>()
  return request.tenantId
})
