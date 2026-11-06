#!/usr/bin/env bash
# Vérifie l'image de l'API : démarrage, écriture, puis données intactes après recréation du conteneur.
set -euo pipefail

IMAGE=${1:-portfolio-matis-api}
VOLUME=portfolio-matis-smoke
ORIGIN=https://admin.example.test
PASSWORD=mot-de-passe-de-verification
BASE=http://127.0.0.1:3000
COOKIES=$(mktemp)

HASH=$(printf '%s\n' "$PASSWORD" | docker run -i --rm "$IMAGE" node apps/api/src/hash-password.ts 2>/dev/null)

cleanup() {
  docker rm -f portfolio-matis-smoke >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  rm -f "$COOKIES"
}
trap cleanup EXIT

start() {
  docker rm -f portfolio-matis-smoke >/dev/null 2>&1 || true
  docker run -d --name portfolio-matis-smoke -p 3000:3000 -v "$VOLUME:/data" \
    -e ADMIN_PASSWORD_HASH="$HASH" \
    -e SESSION_SECRET=secret-de-verification-assez-long-pour-demarrer \
    -e ADMIN_ORIGIN="$ORIGIN" \
    -e COOKIE_SECURE=false \
    "$IMAGE" >/dev/null
  for _ in $(seq 1 30); do
    if curl -fs "$BASE/health" >/dev/null; then return 0; fi
    sleep 1
  done
  echo "L'API n'a pas démarré :" >&2
  docker logs portfolio-matis-smoke >&2
  return 1
}

start
echo "Démarrage : ok"

curl -fs -c "$COOKIES" -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
  -d "{\"password\":\"$PASSWORD\"}" "$BASE/auth/login" >/dev/null
echo "Connexion : ok"

curl -fs -b "$COOKIES" -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
  -d '{"id":"verification","title":"Vérification","summary":"Écrit avant la recréation","categoryId":"perso"}' \
  "$BASE/admin/projects" >/dev/null
echo "Écriture : ok"

start
curl -fs -b "$COOKIES" "$BASE/admin/projects/verification" | grep -q 'Écrit avant la recréation'
echo "Données intactes après recréation du conteneur : ok"

curl -fs "$BASE/docs/json" >/dev/null
echo "Documentation : ok"
