import type { Booking, Slot } from '#/domain/types.ts'

export function newBooking(
  id: string,
  roomId: string,
  memberId: string,
  slot: Slot,
): Booking {
  return { id, roomId, memberId, ...slot, status: 'confirmed' }
}
