import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import type { ZodSchema } from 'zod'
import { ErrorCode } from '@rezeta/shared'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  // Validates whatever argument it is attached to (`@Body`, `@Query`, or
  // `@Param`). Previously this short-circuited on `metadata.type !== 'body'`,
  // so a schema attached to `@Query`/`@Param` was silently ignored and a
  // malformed value (e.g. a non-UUID `?categoryId=`) reached Prisma and
  // surfaced as a 500 instead of a 400.
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
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
