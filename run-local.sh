#!/usr/bin/env bash
# Skinanator local (non-Docker) launcher.
#
# Creates a virtualenv on first run and starts the app with the Flask dev
# server. By default it binds to localhost only. To expose it on the LAN
# without Docker, set HOST=0.0.0.0:
#
#   ./run-local.sh                 # localhost only
#   HOST=0.0.0.0 ./run-local.sh    # reachable on the LAN
#   PORT=8080 ./run-local.sh       # different port

set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

# Generate example presets on first run if they're missing.
if [ ! -f "presets/presets.json" ]; then
  echo "Generating example presets..."
  .venv/bin/python generate_presets.py
fi

exec .venv/bin/python app.py
