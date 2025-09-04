#!/usr/bin/env bash
set -euo pipefail

# =========================
# Einstellungen (änderbar)
# =========================
IMAGE_REPO="${IMAGE_REPO:-depotix}"                 # lokaler Name
REGISTRY_PREFIX="${REGISTRY_PREFIX:-}"              # z.B. "yourdockeruser/" oder leer
DB_NAME="${DB_NAME:-depotix}"
CONF_PATH="${CONF_PATH:-/etc/odoo/odoo.conf}"
CORE_MODULES="${CORE_MODULES:-stock,stock_account,sale,sale_management,sale_stock,purchase,purchase_stock,account,contacts,product,uom,l10n_ch}"

# Flags
AMD64="auto"     # auto | yes | no
INIT_DB="no"     # yes | no
INSTALL_CORE="no"

# ============== Argumente ==============
usage() {
  cat <<USAGE
Usage: $(basename "$0") [--amd64 auto|yes|no] [--init-db] [--install-core]
Buildt Image aus Repo, setzt IMAGE_NAME in .env, startet compose neu.
Optionen:
  --amd64 auto|yes|no   Build für linux/amd64 (auto erkennt arm64-Mac)
  --init-db             Erst-Init: DB anlegen + base installieren
  --install-core        Kernmodule installieren (${CORE_MODULES})
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --amd64) AMD64="${2:-auto}"; shift 2 ;;
    --init-db) INIT_DB="yes"; shift ;;
    --install-core) INSTALL_CORE="yes"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 2 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# =========================
# Tag generieren
# =========================
cd "$ROOT_DIR"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")"
DATE_TAG="$(date +%Y%m%d-%H%M)"
TAG="local-${DATE_TAG}-${GIT_SHA}"
FULL_IMAGE="${REGISTRY_PREFIX}${IMAGE_REPO}:${TAG}"

# =========================
# Build-Plattform bestimmen
# =========================
PLATFORM_ARG=()
if [[ "$AMD64" == "yes" ]]; then
  PLATFORM_ARG=(--platform linux/amd64)
elif [[ "$AMD64" == "auto" ]]; then
  ARCH="$(uname -m || echo "")"
  if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
    PLATFORM_ARG=(--platform linux/amd64)
  fi
fi

echo "==> Building image: ${FULL_IMAGE}"
docker build "${PLATFORM_ARG[@]}" -t "${FULL_IMAGE}" .

# =========================
# IMAGE_NAME in .env setzen
# =========================
ENV_FILE="${ROOT_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  # IMAGE_NAME Zeile ersetzen oder anhängen
  if grep -qE '^IMAGE_NAME=' "$ENV_FILE"; then
    sed -i.bak "s|^IMAGE_NAME=.*$|IMAGE_NAME=${FULL_IMAGE}|" "$ENV_FILE"
  else
    echo "IMAGE_NAME=${FULL_IMAGE}" >> "$ENV_FILE"
  fi
else
  echo "IMAGE_NAME=${FULL_IMAGE}" > "$ENV_FILE"
fi
echo "==> .env aktualisiert: IMAGE_NAME=${FULL_IMAGE}"

# =========================
# Stack neu starten
# =========================
echo "==> docker compose down"
docker compose down
echo "==> docker compose up -d"
docker compose up -d
docker compose ps

# =========================
# Optional: DB init
# =========================
if [[ "$INIT_DB" == "yes" ]]; then
  echo "==> Initialisiere DB '${DB_NAME}' (falls nicht vorhanden)"
  docker compose exec db bash -lc "createdb -U odoo ${DB_NAME} || true"
  echo "==> Odoo base installieren (ohne Demo, Sprache de_CH)"
  docker compose exec web odoo -c "$CONF_PATH" -d "$DB_NAME" -i base --without-demo=all --load-language=de_CH --stop-after-init
fi

# =========================
# Optional: Kernmodule installieren
# =========================
if [[ "$INSTALL_CORE" == "yes" ]]; then
  echo "==> Installiere Kernmodule: ${CORE_MODULES}"
  docker compose exec web odoo -c "$CONF_PATH" -d "$DB_NAME" -i "$CORE_MODULES" --stop-after-init
fi

echo "✅ Fertig. Läuft auf http://localhost:8069  (DB-Selector je nach list_db)."
echo "   Aktuelles Image: ${FULL_IMAGE}"
