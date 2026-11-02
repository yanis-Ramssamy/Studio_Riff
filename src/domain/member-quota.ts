import { Conflict } from '#/domain/errors.ts'

export const MAX_UPCOMING_BOOKINGS = 2

export function checkMemberQuota(upcomingBookings: number): void {
  if (upcomingBookings >= MAX_UPCOMING_BOOKINGS) {
    throw new Conflict('A member can have at most 2 upcoming bookings')
  }
}
