#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
FILE="${1:-$BACKUP_DIR/studio_riff_$(date -u +%Y%m%dT%H%M%SZ).dump}"

mkdir -p "$(dirname "$FILE")"

if ! docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$FILE"; then
  rm -f "$FILE"
  echo "Backup failed" >&2
  exit 1
fi

echo "Backup written to $FILE ($(wc -c < "$FILE") bytes)"
