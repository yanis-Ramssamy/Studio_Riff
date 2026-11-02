import type { Booking, Slot } from '#/domain/types.ts'

export const NOW = new Date('2026-11-02T09:00:00Z')

export const slot = (start: string, end: string): Slot => ({
  start: new Date(start),
  end: new Date(end),
})

export const aBooking = (start: string, end: string): Booking => ({
  id: 'booking-x',
  roomId: 'room-1',
  memberId: 'member-1',
  start: new Date(start),
  end: new Date(end),
  status: 'confirmed',
})

export const onDay = (day: string, startHour: number, endHour: number) => ({
  start: `2026-11-${day}T${String(startHour).padStart(2, '0')}:00:00Z`,
  end: `2026-11-${day}T${String(endHour).padStart(2, '0')}:00:00Z`,
})
