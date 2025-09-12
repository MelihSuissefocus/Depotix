#!/usr/bin/env bash
# Start Depotix backend (Django) and frontend (Next.js) with one command.
# - If one is already running, only start the missing one and inform the user.
# - macOS/zsh friendly.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

log() { printf "[%s] %s\n" "$(date '+%H:%M:%S')" "$*"; }

is_port_listening() {
  local port="$1"
  lsof -i TCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"; local seconds="${2:-20}"
  for _ in $(seq 1 "$seconds"); do
    # Consider any HTTP response (status != 000) as service up
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
    if [[ "$code" != "000" ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_backend() {
  if is_port_listening "$BACKEND_PORT"; then
    log "✔ Backend läuft bereits auf Port $BACKEND_PORT"
    return 0
  fi

  # Prefer project venv, then api/venv, then system python3
  local PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
  if [ ! -x "$PYTHON_BIN" ]; then
    if [ -x "$ROOT_DIR/api/venv/bin/python" ]; then
      PYTHON_BIN="$ROOT_DIR/api/venv/bin/python"
    else
      PYTHON_BIN="python3"
    fi
  fi

  log "▶ Starte Backend (Django) auf Port $BACKEND_PORT ..."
  (
    cd "$ROOT_DIR/api"
    # Ensure migrations are applied (best effort; won't fail the whole script)
    "$PYTHON_BIN" manage.py migrate >/dev/null 2>&1 || true
    # Run server without reloader when backgrounded
    "$PYTHON_BIN" manage.py runserver 0.0.0.0:"$BACKEND_PORT" --noreload \
      > "$ROOT_DIR/api/runserver.log" 2>&1 & echo $! > "$ROOT_DIR/api/runserver.pid"
  )

  if wait_for_http "http://127.0.0.1:$BACKEND_PORT/api/" 20; then
    log "✔ Backend gestartet: http://localhost:$BACKEND_PORT"
  else
    log "⚠ Backend antwortet nicht. Prüfe Log: $ROOT_DIR/api/runserver.log"
  fi
}

start_frontend() {
  if is_port_listening "$FRONTEND_PORT"; then
    log "✔ Frontend läuft bereits auf Port $FRONTEND_PORT"
    return 0
  fi

  log "▶ Starte Frontend (Next.js) auf Port $FRONTEND_PORT ..."
  (
    cd "$ROOT_DIR"
    # Start Next.js dev server in background
    npm run dev -- --port "$FRONTEND_PORT" \
      > "$ROOT_DIR/frontend-dev.log" 2>&1 & echo $! > "$ROOT_DIR/frontend-dev.pid"
  )

  if wait_for_http "http://127.0.0.1:$FRONTEND_PORT" 20; then
    log "✔ Frontend gestartet: http://localhost:$FRONTEND_PORT"
  else
    log "⚠ Frontend antwortet nicht. Prüfe Log: $ROOT_DIR/frontend-dev.log"
  fi
}

log "Depotix Startskript wird ausgeführt ..."
start_backend
start_frontend

log "Fertig. Übersicht:"
log "- Backend:  http://localhost:$BACKEND_PORT  (Log: $ROOT_DIR/api/runserver.log)"
log "- Frontend: http://localhost:$FRONTEND_PORT (Log: $ROOT_DIR/frontend-dev.log)"
log "Stoppen (Ports frei geben): 'lsof -ti:$BACKEND_PORT -ti:$FRONTEND_PORT | xargs kill -9'"
