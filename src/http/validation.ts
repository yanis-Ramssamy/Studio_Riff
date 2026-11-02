import * as v from 'valibot'
import { InvalidInput } from '#/domain/errors.ts'

const timestamp = v.pipe(
  v.string(),
  v.isoTimestamp('Expected an ISO date-time with a timezone'),
  v.transform((value) => new Date(value)),
  v.check((date) => !Number.isNaN(date.getTime()), 'Invalid date-time'),
)

export const rangeQuerySchema = v.object({
  from: v.optional(timestamp),
  to: v.optional(timestamp),
})

export const bookingBodySchema = v.strictObject({
  memberId: v.pipe(v.string(), v.nonEmpty()),
  start: timestamp,
  end: timestamp,
})

export function parse<TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    throw new InvalidInput(result.issues[0].message)
  }
  return result.output
}
