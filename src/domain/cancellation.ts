import { Conflict } from '#/domain/errors.ts'
import type { Booking } from '#/domain/types.ts'

const LATE_CANCELLATION_DELAY = 24 * 60 * 60 * 1000

export function cancelBooking(booking: Booking, now: Date): Booking {
  if (booking.status !== 'confirmed') {
    throw new Conflict('The booking is already cancelled')
  }
  const delay = booking.start.getTime() - now.getTime()
  const status =
    delay < LATE_CANCELLATION_DELAY ? 'late_cancelled' : 'cancelled'
  return { ...booking, status }
}
