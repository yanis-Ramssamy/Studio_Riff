import type { Pool, PoolClient, QueryResultRow } from 'pg'
import { Conflict } from '#/domain/errors.ts'
import type { Booking, BookingStatus, Room } from '#/domain/types.ts'
import type {
  BookingStore,
  BookingTransaction,
  DateRange,
} from '#/application/ports.ts'

interface Queryable {
  query<R extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>
}

interface RoomRow {
  id: string
  name: string
  capacity: number
  maintenance_start: Date | null
  maintenance_end: Date | null
}

interface BookingRow {
  id: string
  room_id: string
  member_id: string
  start_at: Date
  end_at: Date
  status: BookingStatus
}

const BOOKING_COLUMNS = 'id, room_id, member_id, start_at, end_at, status'
const EXCLUSION_VIOLATION = '23P01'

function toRoom(row: RoomRow): Room {
  const maintenance =
    row.maintenance_start && row.maintenance_end
      ? { start: row.maintenance_start, end: row.maintenance_end }
      : null
  return { id: row.id, name: row.name, capacity: row.capacity, maintenance }
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    memberId: row.member_id,
    start: row.start_at,
    end: row.end_at,
    status: row.status,
  }
}

async function findRoom(db: Queryable, id: string): Promise<Room | null> {
  const { rows } = await db.query<RoomRow>(
    'SELECT * FROM rooms WHERE id = $1',
    [id],
  )
  return rows[0] ? toRoom(rows[0]) : null
}

class PostgresTransaction implements BookingTransaction {
  constructor(private readonly client: PoolClient) {}

  findRoom(id: string) {
    return findRoom(this.client, id)
  }

  async lockMember(id: string) {
    const { rows } = await this.client.query(
      'SELECT id FROM members WHERE id = $1 FOR UPDATE',
      [id],
    )
    return rows.length > 0
  }

  async countUpcoming(memberId: string, now: Date) {
    const { rows } = await this.client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM bookings
       WHERE member_id = $1 AND status = 'confirmed' AND start_at > $2`,
      [memberId, now],
    )
    return rows[0]!.total
  }

  async insertBooking(booking: Booking) {
    try {
      await this.client.query(
        `INSERT INTO bookings (${BOOKING_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          booking.id,
          booking.roomId,
          booking.memberId,
          booking.start,
          booking.end,
          booking.status,
        ],
      )
    } catch (error) {
      if ((error as { code?: string }).code === EXCLUSION_VIOLATION) {
        throw new Conflict('The room is already booked during this slot')
      }
      throw error
    }
  }

  async findBookingForUpdate(id: string) {
    const { rows } = await this.client.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1 FOR UPDATE`,
      [id],
    )
    return rows[0] ? toBooking(rows[0]) : null
  }

  async updateStatus(id: string, status: BookingStatus) {
    await this.client.query('UPDATE bookings SET status = $2 WHERE id = $1', [
      id,
      status,
    ])
  }
}

export class PostgresBookingStore implements BookingStore {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(work: (tx: BookingTransaction) => Promise<T>) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work(new PostgresTransaction(client))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async listRooms() {
    const { rows } = await this.pool.query<RoomRow>(
      'SELECT * FROM rooms ORDER BY id',
    )
    return rows.map(toRoom)
  }

  findRoom(id: string) {
    return findRoom(this.pool, id)
  }

  async findBooking(id: string) {
    const { rows } = await this.pool.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1`,
      [id],
    )
    return rows[0] ? toBooking(rows[0]) : null
  }

  async memberExists(id: string) {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM members WHERE id = $1',
      [id],
    )
    return rows.length > 0
  }

  async listRoomBookings(roomId: string, range: DateRange) {
    const conditions = ['room_id = $1', "status = 'confirmed'"]
    const values: unknown[] = [roomId]
    if (range.from) {
      values.push(range.from)
      conditions.push(`end_at > $${values.length}`)
    }
    if (range.to) {
      values.push(range.to)
      conditions.push(`start_at < $${values.length}`)
    }
    const { rows } = await this.pool.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} FROM bookings
       WHERE ${conditions.join(' AND ')} ORDER BY start_at`,
      values,
    )
    return rows.map(toBooking)
  }

  async listMemberBookings(memberId: string) {
    const { rows } = await this.pool.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} FROM bookings
       WHERE member_id = $1 ORDER BY start_at`,
      [memberId],
    )
    return rows.map(toBooking)
  }
}
