import type { RedisClient } from 'bun'
import type { DateRange, PlanningCache } from '#/application/ports.ts'
import type { Booking } from '#/domain/types.ts'

interface CacheOptions {
  ttlSeconds?: number
  timeoutMs?: number
  prefix?: string
}

const UNAVAILABLE = Symbol('unavailable')

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Valkey timeout')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

function parseBookings(raw: string): Booking[] {
  const items = JSON.parse(raw) as (Omit<Booking, 'start' | 'end'> & {
    start: string
    end: string
  })[]
  return items.map((item) => ({
    ...item,
    start: new Date(item.start),
    end: new Date(item.end),
  }))
}

export class ValkeyPlanningCache implements PlanningCache {
  private readonly ttlSeconds: number
  private readonly timeoutMs: number
  private readonly prefix: string

  constructor(
    private readonly client: RedisClient,
    options: CacheOptions = {},
  ) {
    this.ttlSeconds = options.ttlSeconds ?? 60
    this.timeoutMs = options.timeoutMs ?? 300
    this.prefix = options.prefix ?? 'riff'
  }

  async getOrLoad(
    roomId: string,
    range: DateRange,
    load: () => Promise<Booking[]>,
  ): Promise<Booking[]> {
    const version = await this.safely(() =>
      this.client.get(this.versionKey(roomId)),
    )
    if (version === UNAVAILABLE) {
      return load()
    }

    const key = this.planningKey(roomId, version ?? '0', range)
    const cached = await this.safely(() => this.client.get(key))
    if (typeof cached === 'string') {
      return parseBookings(cached)
    }

    const bookings = await load()
    await this.safely(() =>
      this.client.set(key, JSON.stringify(bookings), 'EX', this.ttlSeconds),
    )
    return bookings
  }

  async invalidate(roomId: string): Promise<void> {
    await this.safely(() => this.client.incr(this.versionKey(roomId)))
  }

  private versionKey(roomId: string) {
    return `${this.prefix}:planning-version:${roomId}`
  }

  private planningKey(roomId: string, version: string, range: DateRange) {
    const from = range.from?.toISOString() ?? ''
    const to = range.to?.toISOString() ?? ''
    return `${this.prefix}:planning:${roomId}:v${version}:${from}:${to}`
  }

  private async safely<T>(
    command: () => Promise<T>,
  ): Promise<T | typeof UNAVAILABLE> {
    try {
      return await withTimeout(command(), this.timeoutMs)
    } catch (error) {
      console.warn(
        'Valkey unavailable, falling back to PostgreSQL:',
        String(error),
      )
      return UNAVAILABLE
    }
  }
}
