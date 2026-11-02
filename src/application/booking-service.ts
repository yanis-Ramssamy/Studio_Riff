import { newBooking } from '#/domain/booking.ts'
import { cancelBooking } from '#/domain/cancellation.ts'
import { InvalidInput, NotFound } from '#/domain/errors.ts'
import { checkMemberQuota } from '#/domain/member-quota.ts'
import { checkRoomAvailable } from '#/domain/maintenance.ts'
import { checkSlot } from '#/domain/slot.ts'
import type { Booking, Room } from '#/domain/types.ts'
import type {
  BookingStore,
  Clock,
  DateRange,
  PlanningCache,
} from '#/application/ports.ts'

export interface BookingRequest {
  roomId: string
  memberId: string
  start: Date
  end: Date
}

export class BookingService {
  constructor(
    private readonly store: BookingStore,
    private readonly cache: PlanningCache,
    private readonly clock: Clock,
    private readonly newId: () => string,
  ) {}

  listRooms(): Promise<Room[]> {
    return this.store.listRooms()
  }

  async getPlanning(roomId: string, range: DateRange): Promise<Booking[]> {
    if (range.from && range.to && range.from >= range.to) {
      throw new InvalidInput('"from" must be before "to"')
    }
    return this.cache.getOrLoad(roomId, range, async () => {
      if (!(await this.store.findRoom(roomId))) {
        throw new NotFound('Room not found')
      }
      return this.store.listRoomBookings(roomId, range)
    })
  }

  async getBooking(id: string): Promise<Booking> {
    const booking = await this.store.findBooking(id)
    if (!booking) {
      throw new NotFound('Booking not found')
    }
    return booking
  }

  async listMemberBookings(memberId: string): Promise<Booking[]> {
    if (!(await this.store.memberExists(memberId))) {
      throw new NotFound('Member not found')
    }
    return this.store.listMemberBookings(memberId)
  }

  async book(request: BookingRequest): Promise<Booking> {
    const slot = { start: request.start, end: request.end }
    checkSlot(slot)

    const booking = await this.store.transaction(async (tx) => {
      const room = await tx.findRoom(request.roomId)
      if (!room) {
        throw new NotFound('Room not found')
      }
      if (!(await tx.lockMember(request.memberId))) {
        throw new NotFound('Member not found')
      }
      checkRoomAvailable(room, slot)
      checkMemberQuota(
        await tx.countUpcoming(request.memberId, this.clock.now()),
      )

      const created = newBooking(this.newId(), room.id, request.memberId, slot)
      await tx.insertBooking(created)
      return created
    })

    await this.cache.invalidate(booking.roomId)
    return booking
  }

  async cancel(id: string): Promise<void> {
    const cancelled = await this.store.transaction(async (tx) => {
      const booking = await tx.findBookingForUpdate(id)
      if (!booking) {
        throw new NotFound('Booking not found')
      }
      const result = cancelBooking(booking, this.clock.now())
      await tx.updateStatus(id, result.status)
      return result
    })

    await this.cache.invalidate(cancelled.roomId)
  }
}
