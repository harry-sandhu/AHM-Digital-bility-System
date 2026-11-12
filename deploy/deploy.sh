#!/bin/bash
# Updates the running app to the latest `production` branch. Used by the GitHub deploy job
# (the SSH key there is locked to this script) and fine to run by hand on the server.
# Everything is inside main() so git changing this file mid-run cannot confuse bash.
main() {
  set -euo pipefail
  cd /opt/bilty
  git fetch --quiet origin production
  git reset --hard origin/production        # .env is not tracked, so it is kept
  cd deploy
  docker compose pull
  docker compose up -d --remove-orphans
  docker image prune -f >/dev/null || true

  domain=$(grep -E '^API_DOMAIN=' .env | cut -d= -f2)
  for _ in $(seq 1 40); do
    if out=$(curl -fsS -m 5 "https://$domain/api/health" 2>/dev/null); then
      echo "healthy: $out"
      docker compose ps
      return 0
    fi
    sleep 3
  done
  echo "backend did not become healthy in 2 minutes" >&2
  docker compose ps >&2
  docker compose logs --tail 40 backend >&2
  return 1
}
main "$@"
exit $?
