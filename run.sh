#!/usr/bin/env bash
# Skinanator launcher (Docker).
#
# Builds and runs the app in a Docker container and publishes it on the LAN so
# you can reach it from other devices at http://<machine-name>:<PORT>.
#
#   ./run.sh              # build + run on port 5000
#   PORT=8080 ./run.sh    # use a different host port
#
# For a non-Docker dev workflow, use ./run-local.sh instead.

set -e
cd "$(dirname "$0")"

PORT="${PORT:-5000}"
export PORT

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not on PATH." >&2
  echo "Use ./run-local.sh to run without Docker." >&2
  exit 1
fi

# Prefer the compose plugin, fall back to legacy docker-compose.
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Error: docker compose is not available." >&2
  exit 1
fi

# Best-effort discovery of this machine's LAN address/name for the hint below.
HOSTNAME_SHORT="$(hostname 2>/dev/null || echo localhost)"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

echo "Building and starting Skinanator (Docker)..."
$COMPOSE up --build -d

echo
echo "  Skinanator is running in Docker."
echo "  On this machine:      http://localhost:${PORT}"
[ -n "$HOSTNAME_SHORT" ] && echo "  On your LAN (name):   http://${HOSTNAME_SHORT}:${PORT}"
[ -n "$LAN_IP" ]         && echo "  On your LAN (IP):     http://${LAN_IP}:${PORT}"
echo
echo "  View logs:  $COMPOSE logs -f"
echo "  Stop:       $COMPOSE down"
