#!/usr/bin/env bash
set -euo pipefail

FILE="${1:?Usage: ./restore.sh <backup.dump> [new_database]}"
TARGET="${2:-studio_riff_restored}"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
DB_USER="${POSTGRES_USER:-studio}"
SOURCE="${POSTGRES_DB:-studio_riff}"

if [ "$TARGET" = "$SOURCE" ]; then
  echo "Refusing to restore over the original database $SOURCE" >&2
  exit 1
fi

count_rows() {
  docker compose exec -T postgres psql -U "$DB_USER" -d "$1" -Atc "SELECT count(*) FROM $2"
}

docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$TARGET\""
docker compose exec -T postgres pg_restore -U "$DB_USER" -d "$TARGET" --no-owner < "$FILE"

echo
printf '%-12s %12s %12s\n' table "$SOURCE" "$TARGET"
status=0
for table in rooms members bookings; do
  original=$(count_rows "$SOURCE" "$table")
  restored=$(count_rows "$TARGET" "$table")
  printf '%-12s %12s %12s\n' "$table" "$original" "$restored"
  if [ "$original" != "$restored" ]; then
    status=1
  fi
done

if [ "$status" -eq 0 ]; then
  echo "Restore verified: row counts match"
else
  echo "Restore mismatch: row counts differ" >&2
fi
exit "$status"
