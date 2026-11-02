import { Conflict } from '#/domain/errors.ts'
import { overlaps } from '#/domain/slot.ts'
import type { Room, Slot } from '#/domain/types.ts'

export function checkRoomAvailable(room: Room, slot: Slot): void {
  if (room.maintenance && overlaps(room.maintenance, slot)) {
    throw new Conflict('The room is under maintenance during this slot')
  }
}
