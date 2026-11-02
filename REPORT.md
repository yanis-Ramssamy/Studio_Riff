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

### Après `CREATE INDEX bookings_room_start ON bookings (room_id, start_at)` (migration 002)

Après `bun run migrate` et `ANALYZE bookings`, seconde exécution :

```
 Sort  (cost=1652.96..1663.77 rows=4322 width=51) (actual time=0.869..0.873 rows=91 loops=1)
   Sort Key: start_at
   Sort Method: quicksort  Memory: 32kB
   ->  Bitmap Heap Scan on bookings  (cost=144.99..1391.97 rows=4322 width=51) (actual time=0.830..0.843 rows=91 loops=1)
         Recheck Cond: ((room_id = 'room-1'::text) AND (start_at < '2028-03-08 00:00:00+00'::timestamp with time zone))
         Filter: ((end_at > '2028-03-01 00:00:00+00'::timestamp with time zone) AND (status = 'confirmed'::text))
         Rows Removed by Filter: 5526
         Heap Blocks: exact=255
         ->  Bitmap Index Scan on bookings_room_start  (cost=0.00..143.91 rows=5549 width=0) (actual time=0.152..0.152 rows=5617 loops=1)
               Index Cond: ((room_id = 'room-1'::text) AND (start_at < '2028-03-08 00:00:00+00'::timestamp with time zone))
 Planning Time: 0.327 ms
 Execution Time: 0.905 ms
```

### Lecture

- Avant : PostgreSQL lit toute la table (`Seq Scan`) et écarte 99 913 lignes pour en garder 91 (`Rows Removed by Filter`). Temps d'exécution : 5,279 ms.
- Après : un `Bitmap Index Scan` sur `bookings_room_start` repère les 5 617 lignes de `room-1` qui commencent avant la fin de la semaine, puis seules les pages concernées sont lues (`Heap Blocks: exact=255`). Temps d'exécution : 0,905 ms, soit environ 6 fois moins. Le filtre sur `end_at` reste appliqué après l'index : 5 526 lignes sont encore écartées, contre 99 913 avant.
- Le coût estimé par PostgreSQL baisse aussi, de 3 409 à 1 663 (unités arbitraires).
- L'index porte `(room_id, start_at)` : l'égalité sur la salle en premier, puis la borne `start_at < …`. `end_at` n'est pas dans l'index, car la condition `end_at > …` ne réduit presque pas les lignes en plus de la salle et de la borne de début.
- Les durées sont de l'ordre de la milliseconde parce que la table est petite. L'écart entre les deux plans compte plus que le chiffre : il grandit avec la taille de la table.

## 3. Sauvegarde et restauration (étape 7)

### Commandes

```
./backup.sh                          # pg_dump au format custom dans backups/
./restore.sh backups/<fichier>.dump  # crée studio_riff_restored, restaure, compare
```

La restauration se fait dans une nouvelle base (`studio_riff_restored`) ; le script refuse de restaurer sur la base d'origine.

### Résultat constaté (base contenant 100 004 réservations)

Les lignes d'avertissement de Docker Compose sur le nom du projet ont été retirées de la sortie.

```
$ ./backup.sh
Backup written to backups/studio_riff_20261102T152728Z.dump (499759 bytes)

$ ./restore.sh backups/studio_riff_20261102T152728Z.dump
CREATE DATABASE

table         studio_riff studio_riff_restored
rooms                   4            4
members                 3            3
bookings           100004       100004
Restore verified: row counts match
```

Durée de la restauration mesurée avec `time ./restore.sh ...` : 8,8 s (création de la base, restauration, reconstruction des index et comparaison des nombres de lignes). Les mêmes nombres de lignes dans les deux bases prouvent que les trois tables ont été restaurées dans une base distincte de la base d'origine.

### RPO, RTO et rétention

| Indicateur | Valeur | Justification |
| --- | --- | --- |
| RPO (perte de données acceptable) | 24 heures | Sauvegarde quotidienne la nuit. Perdre une journée de réservations est pénible mais rattrapable : les membres ont reçu une confirmation et peuvent ressaisir leurs créneaux. Une banque ne peut pas accepter cela et vise un RPO proche de zéro avec une réplication continue. |
| RTO (durée d'indisponibilité acceptable) | 4 heures | L'association n'a pas de service critique : les répétitions se préparent en journée. Les bénévoles ont besoin de quelques heures pour s'apercevoir de la panne et lancer `restore.sh` ; la restauration elle-même prend environ 9 secondes pour 100 004 réservations (mesure ci-dessus). |
| Rétention | 30 jours de sauvegardes quotidiennes | Une erreur humaine (suppression d'une salle, mauvaise manipulation) peut n'être remarquée qu'au bout de quelques semaines. Une sauvegarde pèse environ 0,5 Mo : 30 copies représentent environ 15 Mo. |
