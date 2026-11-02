import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { RedisClient } from 'bun'
import { requireEnv } from '#/config.ts'
import { PostgresBookingStore } from '#/infrastructure/postgres-booking-store.ts'
import { ValkeyPlanningCache } from '#/infrastructure/valkey-planning-cache.ts'
import { buildApp, pool, resetDatabase } from '../support/app.ts'

const PREFIX = 'riff-test'
const PLANNING = '/rooms/room-1/bookings'

class CountingStore extends PostgresBookingStore {
  planningReads = 0

  override listRoomBookings(
    ...args: Parameters<PostgresBookingStore['listRoomBookings']>
  ) {
    this.planningReads += 1
    return super.listRoomBookings(...args)
  }
}

const valkey = new RedisClient(requireEnv('VALKEY_URL'))

function setup() {
  const store = new CountingStore(pool)
  const cache = new ValkeyPlanningCache(valkey, { prefix: PREFIX })
  return { store, api: buildApp(cache, store) }
}

async function ids(response: Response) {
  return ((await response.json()) as { id: string }[]).map((b) => b.id)
}

beforeEach(async () => {
  await resetDatabase()
  const keys = (await valkey.send('KEYS', [`${PREFIX}:*`])) as string[]
  if (keys.length > 0) {
    await valkey.send('DEL', keys)
  }
})

afterAll(() => valkey.close())

describe('planning cache', () => {
  test('serves the second request from Valkey', async () => {
    const { store, api } = setup()

    await api.get(PLANNING)
    await api.get(PLANNING)

    expect(store.planningReads).toBe(1)
  })

  test('gives the entry a limited lifetime', async () => {
    const { api } = setup()
    await api.get(PLANNING)

    const [key] = (await valkey.send('KEYS', [
      `${PREFIX}:planning:room-1:v*`,
    ])) as string[]
    const ttl = (await valkey.send('TTL', [key!])) as number

    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(60)
  })

  test('shows a new booking immediately', async () => {
    const { api } = setup()
    await api.get(PLANNING)

    const created = await api.post(PLANNING, {
      memberId: 'member-3',
      start: '2026-11-04T14:00:00Z',
      end: '2026-11-04T16:00:00Z',
    })
    const { id } = await created.json()

    expect(await ids(await api.get(PLANNING))).toContain(id)
  })

  test('removes a cancelled booking immediately', async () => {
    const { api } = setup()
    expect(await ids(await api.get(PLANNING))).toEqual(['booking-1'])

    await api.delete('/bookings/booking-1')

    expect(await ids(await api.get(PLANNING))).toEqual([])
  })

  test('keeps the plannings of other rooms cached', async () => {
    const { store, api } = setup()
    await api.get('/rooms/room-2/bookings')

    await api.post(PLANNING, {
      memberId: 'member-3',
      start: '2026-11-04T14:00:00Z',
      end: '2026-11-04T16:00:00Z',
    })
    await api.get('/rooms/room-2/bookings')

    expect(store.planningReads).toBe(1)
  })
})

describe('when Valkey is unavailable', () => {
  function setupWithoutValkey() {
    const unreachable = new RedisClient('redis://127.0.0.1:1')
    const store = new CountingStore(pool)
    const cache = new ValkeyPlanningCache(unreachable, {
      prefix: PREFIX,
      timeoutMs: 100,
    })
    return { store, api: buildApp(cache, store) }
  }

  test('the planning is read from PostgreSQL', async () => {
    const { api } = setupWithoutValkey()
    const response = await api.get(PLANNING)

    expect(response.status).toBe(200)
    expect(await ids(response)).toEqual(['booking-1'])
  })

  test('bookings and cancellations still work', async () => {
    const { api } = setupWithoutValkey()

    const created = await api.post(PLANNING, {
      memberId: 'member-3',
      start: '2026-11-04T14:00:00Z',
      end: '2026-11-04T16:00:00Z',
    })
    const deleted = await api.delete('/bookings/booking-1')

    expect(created.status).toBe(201)
    expect(deleted.status).toBe(204)
    expect(await ids(await api.get(PLANNING))).toEqual([
      (await created.json()).id,
    ])
  })
})
