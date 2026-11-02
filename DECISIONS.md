# DECISIONS

Choix de conception de l'API Studio Riff, écrits avant l'implémentation et ajustés pendant.

## 1. Où vit chaque règle métier

| Règle | Implémentation | Pourquoi là |
| --- | --- | --- |
| Créneau de 1 h à 4 h, heure pleine, début entre 10 h et 23 h (UTC) | `src/domain/slot.ts` : `checkSlot` (erreur 400). Un `CHECK` en base borne aussi la durée. | Règle pure, sans accès à la base : un test unitaire suffit. Le `CHECK` est un filet de sécurité si on insère hors de l'API. |
| Pas de chevauchement dans une même salle, même en parallèle | **Base de données** : contrainte `EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (status = 'confirmed')`. L'erreur `23P01` est traduite en 409 dans `postgres-booking-store.ts`. | Vérifier « puis insérer » côté application laisse une fenêtre entre la lecture et l'écriture : deux requêtes simultanées passent toutes les deux. Seule la base peut trancher de façon atomique. L'intervalle `[)` autorise un créneau qui commence quand le précédent finit. Les réservations annulées ne bloquent plus la salle. |
| Maximum 2 réservations à venir par membre | Décision dans le domaine (`src/domain/member-quota.ts`, `checkMemberQuota`). Le service ouvre une transaction, verrouille la ligne du membre (`SELECT … FOR UPDATE`), compte ses réservations confirmées qui commencent après `clock.now()`, puis appelle la règle. | La règle porte sur plusieurs lignes et dépend de l'heure : ni `CHECK` ni `UNIQUE` ne peuvent l'exprimer, et un trigger ne se teste pas avec une horloge fixe. Sans verrou, deux requêtes simultanées lisent chacune « 1 » et insèrent toutes les deux : le membre en a 3. Le verrou ne sérialise que les réservations d'un même membre. |
| Annulation : statut `cancelled` ou `late_cancelled` (moins de 24 h), pas deux fois | `cancelBooking(booking, now)` dans `src/domain/cancellation.ts`. Le service lit la réservation avec `FOR UPDATE` avant de la modifier. | Le calcul dépend de l'heure, donc `now` est un paramètre. Le verrou garantit qu'une seule de deux annulations simultanées réussit, l'autre reçoit 409. |
| Salle en maintenance | `checkRoomAvailable(room, slot)` dans `src/domain/maintenance.ts`, qui réutilise `overlaps` (`slot.ts`). | La période de maintenance est une donnée de la salle, chargée dans la même transaction. Aucune concurrence particulière à gérer. |
| Heures en UTC | Validation HTTP (`isoTimestamp`, converti en `Date`), domaine en `getUTCHours`, colonnes `timestamptz`, réponses terminées par `Z`. | Un seul fuseau dans tout le code, pas de conversion cachée. |
| Règles qui dépendent de l'heure | Le service reçoit une `Clock` ; le domaine reçoit `now` en paramètre. | Les tests fixent l'horloge au 2 novembre 2026, 9 h. |

Codes HTTP : `InvalidInput` donne 400, `NotFound` donne 404, `Conflict` donne 409. La correspondance est faite à un seul endroit, dans `app.onError`.

Choix de lecture du sujet :

- Un début à 23 h est accepté (« entre 10 h et 23 h » est lu de façon inclusive). Le créneau peut alors se terminer après minuit.
- La durée est comprise entre 1 h et 4 h sans obligation de finir à l'heure pleine.
- Le planning d'une salle (`GET /rooms/:id/bookings`) liste les réservations `confirmed` : une annulation libère le créneau. Les réservations annulées restent visibles dans `GET /bookings/:id` et `GET /members/:id/bookings`.
- Sans `from` ni `to`, le planning n'est pas borné. Une date invalide ou `from` après `to` donne 400.

## 2. Schéma des couches

```
requête HTTP
     │
     ▼
┌───────────────────────────┐
│ http/                     │  routes Hono, validation Valibot, présentation JSON,
│ app.ts  validation.ts     │  traduction des erreurs en codes HTTP
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ application/              │  BookingService : orchestre les cas d'usage
│ booking-service.ts        │  (transaction, horloge, cache)
│ ports.ts (interfaces)     │
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐        ┌────────────────────────────────┐
│ domain/                   │        │ infrastructure/                │
│ slot maintenance quota... │◄───────│ PostgresBookingStore (pg)      │
│ aucune dépendance         │ types  │ ValkeyPlanningCache            │
└───────────────────────────┘        │ implémentent les ports         │
                                     └────────────────────────────────┘

main.ts assemble le tout (seul fichier qui connaît toutes les couches)
```

Sens des dépendances : `domain` n'importe rien ; `application` importe `domain` et définit les interfaces (`ports.ts`) ; `http` et `infrastructure` importent `application` et `domain` ; personne n'importe `http` ni `infrastructure`, sauf `main.ts`.

## 3. Modèle relationnel

```
rooms    (id PK, name, capacity > 0, maintenance_start, maintenance_end)
members  (id PK, name)
bookings (id PK, room_id FK → rooms, member_id FK → members,
          start_at, end_at, status ∈ {confirmed, cancelled, late_cancelled})

rooms 1 ──── * bookings * ──── 1 members
```

Contraintes de `bookings` : `end_at - start_at` entre 1 h et 4 h, statut limité à trois valeurs, exclusion de chevauchement par salle sur les réservations `confirmed`. Contraintes de `rooms` : maintenance renseignée en entier ou pas du tout, fin après début.

La migration `001` crée le schéma, la migration `002` ajoute l'index `bookings_room_start (room_id, start_at)` après la mesure du rapport.

## 4. ADR

### ADR 1 : driver `pg` et SQL écrit à la main, sans ORM

- **Contexte** : le sujet laisse le choix du driver, de l'ORM ou du query builder. Le schéma repose sur une contrainte d'exclusion, un type `tstzrange`, des verrous `FOR UPDATE` et un index à mesurer avec `EXPLAIN ANALYZE`.
- **Décision** : `pg` (node-postgres) avec des requêtes SQL paramétrées, dans un seul fichier d'infrastructure. Les lignes sont converties en objets du domaine par deux fonctions.
- **Conséquences** : le schéma vit dans les migrations SQL, pas dans une description TypeScript qu'il faudrait synchroniser. Les verrous et les transactions sont visibles dans le code. Le prix : pas de typage automatique des requêtes, les types de lignes sont écrits à la main. Avec une dizaine de requêtes, c'est acceptable.
- **Écartés** : Drizzle et Kysely (vus en cours) apportent peu pour si peu de requêtes et gèrent mal `EXCLUDE` et `FOR UPDATE` ; ils demanderaient du SQL brut pour les parties importantes.

### ADR 2 : refus du conteneur d'injection, du type `Result` et du bus d'événements

- **Contexte** : le projet vu en cours utilise un conteneur d'injection, des types `Result`/`Option`, un bus d'événements et plusieurs contextes. Ces patterns répondent à des besoins qu'on n'a pas ici : un seul contexte métier, aucun effet de bord à propager vers un autre module.
- **Décision** : l'assemblage se fait à la main dans `main.ts` (injection par constructeur), les échecs métier sont des exceptions typées (`InvalidInput`, `NotFound`, `Conflict`) traduites en HTTP à un seul endroit, et il n'y a pas de bus.
- **Conséquences** : moins de fichiers, flux lisible de la route à la requête SQL. Les ports (`BookingStore`, `PlanningCache`, `Clock`) restent des interfaces, donc le test avec horloge fixe et le remplacement du cache restent possibles. Si l'application grossissait (notifications, plusieurs contextes), on reconsidérerait le bus.
