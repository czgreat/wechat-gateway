#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
LEGACY_DATA_DIR="${LEGACY_DATA_DIR:-/app/legacy-data}"

mkdir -p "$DATA_DIR"

bootstrap_needed=0
if [ ! -f "$DATA_DIR/config.json" ] || [ ! -f "$DATA_DIR/integrations.json" ]; then
  bootstrap_needed=1
fi

if [ "$bootstrap_needed" -eq 1 ] && [ -d "$LEGACY_DATA_DIR" ] && [ -f "$LEGACY_DATA_DIR/config.json" ]; then
  echo "[entrypoint] Bootstrapping runtime data from legacy volume: $LEGACY_DATA_DIR"
  cp -a "$LEGACY_DATA_DIR"/. "$DATA_DIR"/
fi

exec "$@"
