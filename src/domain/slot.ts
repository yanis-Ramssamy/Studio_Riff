import { InvalidInput } from '#/domain/errors.ts'
import type { Slot } from '#/domain/types.ts'

const HOUR = 60 * 60 * 1000
const FIRST_START_HOUR = 10
const LAST_START_HOUR = 23
const MIN_DURATION = HOUR
const MAX_DURATION = 4 * HOUR

export function overlaps(a: Slot, b: Slot): boolean {
  return (
    a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
  )
}

export function checkSlot(slot: Slot): void {
  const startsOnTheHour = slot.start.getTime() % HOUR === 0
  const startHour = slot.start.getUTCHours()
  const duration = slot.end.getTime() - slot.start.getTime()

  if (!startsOnTheHour) {
    throw new InvalidInput('A slot must start on the hour')
  }
  if (startHour < FIRST_START_HOUR || startHour > LAST_START_HOUR) {
    throw new InvalidInput('A slot must start between 10:00 and 23:00 UTC')
  }
  if (duration < MIN_DURATION || duration > MAX_DURATION) {
    throw new InvalidInput('A slot lasts between 1 and 4 hours')
  }
}
