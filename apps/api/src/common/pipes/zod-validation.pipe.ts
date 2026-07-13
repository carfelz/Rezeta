import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import type { ZodSchema } from 'zod'
import { ErrorCode } from '@rezeta/shared'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  // Validates `@Body` and `@Query` arguments only. It deliberately does NOT
  // touch `param` or `custom` args: `@UsePipes(new ZodValidationPipe(schema))`
  // broadcasts the pipe to EVERY handler argument, so validating the
  // `@Param('id')` string or the `@TenantId()`/`@CurrentUser()` args against a
  // body schema would reject valid requests (they lack the body's fields).
  // Params are validated by `ParseUUIDPipe`; auth/context args by the guard.
  // (A prior version short-circuited on `!== 'body'`, which silently ignored
  // `@Query` schemas; the opposite over-reach then broke every write endpoint.)
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' && metadata.type !== 'query') return value
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: result.error.flatten(),
      })
    }
    return result.data as unknown
  }
}
