import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'

/**
 * Parses an optional numeric param (query/param) as an integer >= 1.
 * Undefined passes through unchanged (mirrors `ParseIntPipe`'s
 * `{ optional: true }`), but unlike the bare `ParseIntPipe`, 0 and negative
 * values are rejected rather than silently accepted as well-formed integers.
 */
@Injectable()
export class ParsePositiveIntPipe
  implements PipeTransform<string | undefined, number | undefined>
{
  transform(value: string | undefined, metadata: ArgumentMetadata): number | undefined {
    if (value === undefined) return undefined
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: { field: metadata.data, reason: 'must be an integer >= 1' },
      })
    }
    return parsed
  }
}
