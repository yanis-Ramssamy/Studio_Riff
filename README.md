# Studio Riff

API de réservation des salles de répétition de l'association Studio Riff.
Elle est écrite avec Bun, TypeScript et Hono, et les données sont dans PostgreSQL.

## Ce qu'il faut avoir installé

- [Bun](https://bun.sh) 1.3 ou plus
- Docker avec Docker Compose
- Git Bash si vous êtes sous Windows (pour les scripts `.sh`)

## Démarrer le projet

```bash
cp .env.example .env
bun install
docker compose up -d --wait
docker compose exec postgres createdb -U studio studio_riff_test
bun run migrate
bun run seed
bun run dev
```

L'API tourne ensuite sur http://127.0.0.1:3000.

Ce que fait chaque commande :

- `bun run migrate` crée les tables dans une base vide. Si elle est relancée, elle n'applique que les migrations qui manquent.
- `bun run seed` remet la base dans l'état de départ : 4 salles, 3 membres, 4 réservations. Les tables sont vidées avant.
- `docker compose down` arrête les bases et garde les données. `docker compose down -v` arrête aussi les bases et supprime les données.

Le fichier `.env.example` ne contient que des valeurs d'exemple. Le vrai fichier `.env` n'est pas versionné.

## Lancer les tests

```bash
bun run test
```

Les tests utilisent la base `studio_riff_test` (variable `TEST_DATABASE_URL`), il faut donc que Docker tourne. Avant chaque test, la base est remise dans l'état de départ et l'horloge est fixée au lundi 2 novembre 2026, 9 h UTC.

Pour vérifier les types : `bun run check`.

## Essayer l'API

```bash
curl http://127.0.0.1:3000/rooms
curl "http://127.0.0.1:3000/rooms/room-1/bookings?from=2026-11-01T00:00:00Z&to=2026-11-08T00:00:00Z"
curl -i -X POST http://127.0.0.1:3000/rooms/room-1/bookings \
  -H 'Content-Type: application/json' \
  -d '{"memberId":"member-3","start":"2026-11-04T14:00:00Z","end":"2026-11-04T16:00:00Z"}'
curl -i -X DELETE http://127.0.0.1:3000/bookings/booking-1
```

Sous PowerShell, utilisez `curl.exe` à la place de `curl`.

| Route | Succès | Erreurs possibles |
| --- | --- | --- |
| `GET /rooms` | 200 | |
| `GET /rooms/:id/bookings?from=&to=` | 200 | 400, 404 |
| `POST /rooms/:id/bookings` | 201 avec l'en-tête `Location` | 400, 404, 409 |
| `GET /bookings/:id` | 200 | 404 |
| `DELETE /bookings/:id` | 204 | 404, 409 |
| `GET /members/:id/bookings` | 200 | 404 |

## Sauvegarde et restauration

À lancer dans Git Bash (ou n'importe quel terminal bash) :

```bash
./backup.sh                          # écrit backups/studio_riff_<date>.dump
./restore.sh backups/<fichier>.dump  # restaure dans studio_riff_restored et compare le nombre de lignes
```

La restauration se fait dans une nouvelle base, jamais dans la base d'origine. Pour la refaire, supprimez d'abord la base restaurée :

```bash
docker compose exec postgres dropdb -U studio studio_riff_restored
```

## Mesure de performance

```bash
docker compose exec -T postgres psql -U studio -d studio_riff < perf/generate-bookings.sql
docker compose exec -T postgres psql -U studio -d studio_riff < perf/explain-planning.sql
```

Les résultats avant et après l'index sont dans `REPORT.md`. Relancer `bun run seed` supprime les réservations générées.

## Organisation du code

```
src/domain/          règles métier, types, erreurs (aucune dépendance)
src/application/     le service de réservation et les interfaces
src/infrastructure/  accès à PostgreSQL, lecture des fichiers SQL
src/http/            routes Hono, validation, format des réponses
src/main.ts          assemblage et démarrage
sql/                 migrations et données de départ
perf/                scripts de mesure
test/                tests des règles et tests des routes
```

Les choix de conception sont dans `DECISIONS.md` et les mesures dans `REPORT.md`.
