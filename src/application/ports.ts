import type { Booking, BookingStatus, Room } from '#/domain/types.ts'

export interface Clock {
  now(): Date
}

export interface DateRange {
  from?: Date
  to?: Date
}

export interface BookingTransaction {
  findRoom(id: string): Promise<Room | null>
  lockMember(id: string): Promise<boolean>
  countUpcoming(memberId: string, now: Date): Promise<number>
  insertBooking(booking: Booking): Promise<void>
  findBookingForUpdate(id: string): Promise<Booking | null>
  updateStatus(id: string, status: BookingStatus): Promise<void>
}

export interface BookingStore {
  transaction<T>(work: (tx: BookingTransaction) => Promise<T>): Promise<T>
  listRooms(): Promise<Room[]>
  findRoom(id: string): Promise<Room | null>
  findBooking(id: string): Promise<Booking | null>
  memberExists(id: string): Promise<boolean>
  listRoomBookings(roomId: string, range: DateRange): Promise<Booking[]>
  listMemberBookings(memberId: string): Promise<Booking[]>
}

export interface PlanningCache {
  getOrLoad(
    roomId: string,
    range: DateRange,
    load: () => Promise<Booking[]>,
  ): Promise<Booking[]>
  invalidate(roomId: string): Promise<void>
}
