import { z } from 'zod'
import { RECORD_SECTION_KEYS } from '../types/consultation-record.js'

export const UpdateRecordSectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        key: z.enum(RECORD_SECTION_KEYS),
        content: z.string().max(20_000),
      }),
    )
    .min(1),
})

export type UpdateRecordSectionsDto = z.infer<typeof UpdateRecordSectionsSchema>
