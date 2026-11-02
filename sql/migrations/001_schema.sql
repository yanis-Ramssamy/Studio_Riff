CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  maintenance_start TIMESTAMPTZ,
  maintenance_end TIMESTAMPTZ,
  CHECK ((maintenance_start IS NULL) = (maintenance_end IS NULL)),
  CHECK (maintenance_end IS NULL OR maintenance_end > maintenance_start)
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms (id),
  member_id TEXT NOT NULL REFERENCES members (id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'late_cancelled')),
  CHECK (end_at - start_at BETWEEN interval '1 hour' AND interval '4 hours'),
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status = 'confirmed')
);
