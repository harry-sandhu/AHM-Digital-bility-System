#!/bin/bash
# Daily dump of the MongoDB database to ./backups (keeps 14 days).
# Run from this folder (needs the .env next to it). Example cron entry:
#   17 3 * * *  cd /opt/bilty/deploy && ./backup.sh >> backup.log 2>&1
# Copy ./backups OFF this server too (another machine or cloud storage).
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
mkdir -p backups
docker run --rm -v "$PWD/backups:/backups" mongo:7 \
  mongodump --uri="$MONGO_URI" --gzip --archive="/backups/bilty-$(date +%F).gz"
find backups -name 'bilty-*.gz' -mtime +14 -delete
ls -lh backups | tail -3
