# REPORT

Mesures et justifications du projet Studio Riff. Environnement : PostgreSQL et Valkey lancés avec `compose.yaml`, API lancée avec Bun.

## 1. Mesure d'une requête (étape 5)

### Jeu de données

Les 4 réservations de départ ont été complétées par 100 000 réservations générées (`perf/generate-bookings.sql`, `INSERT … SELECT … generate_series(0, 99999)`), puis `ANALYZE bookings`. La table contient 100 004 lignes, sans chevauchement : la contrainte d'exclusion aurait refusé l'insertion sinon.

### Requête mesurée

Planning de `room-1` pour la semaine du 1er au 8 mars 2028, avec des comparaisons sur `start_at` et `end_at` (`perf/explain-planning.sql`) :

```sql
EXPLAIN ANALYZE
SELECT id, room_id, member_id, start_at, end_at, status
FROM bookings
WHERE room_id = 'room-1'
  AND status = 'confirmed'
  AND start_at < '2028-03-08 00:00+00'
  AND end_at > '2028-03-01 00:00+00'
ORDER BY start_at;
```

### Avant l'index (migration 001 seule)

Seconde exécution (la première sert à chauffer le cache de PostgreSQL) :

```
 Sort  (cost=3399.04..3409.91 rows=4351 width=51) (actual time=5.247..5.251 rows=91 loops=1)
   Sort Key: start_at
   Sort Method: quicksort  Memory: 32kB
   ->  Seq Scan on bookings  (cost=0.00..3136.08 rows=4351 width=51) (actual time=1.288..5.220 rows=91 loops=1)
         Filter: ((start_at < '2028-03-08 00:00:00+00'::timestamp with time zone) AND (end_at > '2028-03-01 00:00:00+00'::timestamp with time zone) AND (room_id = 'room-1'::text) AND (status = 'confirmed'::text))
         Rows Removed by Filter: 99913
 Planning Time: 0.265 ms
 Execution Time: 5.279 ms
```
