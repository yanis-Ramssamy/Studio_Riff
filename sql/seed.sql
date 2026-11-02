TRUNCATE bookings, members, rooms CASCADE;

INSERT INTO rooms (id, name, capacity, maintenance_start, maintenance_end) VALUES
  ('room-1', 'Salle Hendrix', 5, NULL, NULL),
  ('room-2', 'Salle Simone', 4, NULL, NULL),
  ('room-3', 'Salle Bowie', 6, NULL, NULL),
  ('room-4', 'Salle Björk', 3, '2026-11-05 00:00+00', '2026-11-08 00:00+00');

INSERT INTO members (id, name) VALUES
  ('member-1', 'Les Volts'),
  ('member-2', 'Café Noir'),
  ('member-3', 'Marée Basse');

INSERT INTO bookings (id, room_id, member_id, start_at, end_at, status) VALUES
  ('booking-1', 'room-1', 'member-1', '2026-11-03 18:00+00', '2026-11-03 20:00+00', 'confirmed'),
  ('booking-2', 'room-3', 'member-1', '2026-11-10 14:00+00', '2026-11-10 17:00+00', 'confirmed'),
  ('booking-3', 'room-2', 'member-2', '2026-11-02 19:00+00', '2026-11-02 21:00+00', 'confirmed'),
  ('booking-4', 'room-2', 'member-2', '2026-10-28 19:00+00', '2026-10-28 21:00+00', 'confirmed');
