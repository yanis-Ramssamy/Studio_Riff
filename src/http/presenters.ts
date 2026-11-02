import type { Booking, Room } from '#/domain/types.ts'

function isoSeconds(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

export function presentBooking(booking: Booking) {
  return {
    id: booking.id,
    roomId: booking.roomId,
    memberId: booking.memberId,
    start: isoSeconds(booking.start),
    end: isoSeconds(booking.end),
    status: booking.status,
  }
}

export function presentRoom(room: Room) {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    maintenance: room.maintenance && {
      start: isoSeconds(room.maintenance.start),
      end: isoSeconds(room.maintenance.end),
    },
  }
}
