export type BookingStatus = 'confirmed' | 'cancelled' | 'late_cancelled'

export interface Slot {
  start: Date
  end: Date
}

export interface Room {
  id: string
  name: string
  capacity: number
  maintenance: Slot | null
}

export interface Booking {
  id: string
  roomId: string
  memberId: string
  start: Date
  end: Date
  status: BookingStatus
}
