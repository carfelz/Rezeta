import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common'
import type { ZodSchema } from 'zod'
import { ErrorCode } from '@rezeta/shared'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') return value
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: result.error.flatten(),
      })
    }
    return result.data
  }
}
