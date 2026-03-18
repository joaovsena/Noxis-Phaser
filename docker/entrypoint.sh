#!/bin/sh

if [ "${PRISMA_DB_PUSH:-1}" = "1" ]; then
  echo "[app] Waiting for database and syncing schema..."
  prisma_db_push_attempt=1
  prisma_db_push_max_retries="${PRISMA_DB_PUSH_MAX_RETRIES:-45}"
  until npx prisma db push; do
    if [ "$prisma_db_push_attempt" -ge "$prisma_db_push_max_retries" ]; then
      echo "[app] prisma db push failed after ${prisma_db_push_attempt} attempts. Exiting."
      exit 1
    fi
    echo "[app] Database not ready yet. Retrying in 2s..."
    prisma_db_push_attempt=$((prisma_db_push_attempt + 1))
    sleep 2
  done
else
  echo "[app] Skipping prisma db push."
fi

if [ ! -f /app/node_modules/.prisma/client/index.js ]; then
  echo "[app] Prisma client missing. Generating..."
  npx prisma generate
  if [ $? -ne 0 ]; then
    echo "[app] Prisma generate failed"
    exit 1
  fi
else
  echo "[app] Prisma client already present. Skipping generate."
fi

echo "[app] Starting server..."
exec node --trace-uncaught dist/server/index.js
