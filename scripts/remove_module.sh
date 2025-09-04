#!/usr/bin/env bash
set -euo pipefail
MOD="${1:-}"
if [[ -z "$MOD" ]]; then
  echo "Usage: $0 <module_name>"; exit 1
fi

ADDONS_DIR="odoo/addons"

# Module, die NIEMALS gelöscht werden dürfen:
PROTECTED=(
  base web mail product uom contacts
  stock stock_account sale sale_management purchase account
  report portal auth_signup resource
)

# prüfen
if [[ ! -d "$ADDONS_DIR/$MOD" ]]; then
  echo "❌ Modul '$MOD' existiert nicht unter $ADDONS_DIR"; exit 2
fi

# Schutz prüfen
for p in "${PROTECTED[@]}"; do
  if [[ "$MOD" == "$p" ]]; then
    echo "⛔ '$MOD' ist geschützt und darf nicht gelöscht werden."; exit 3
  fi
done

echo "=== DRY RUN ==="
echo "Würde löschen: $ADDONS_DIR/$MOD"
read -p "Zum Löschen 'yes' tippen: " ans
if [[ "$ans" != "yes" ]]; then
  echo "Abgebrochen."; exit 0
fi

# wirklich löschen
rm -rf -- "$ADDONS_DIR/$MOD"
echo "✅ Gelöscht: $ADDONS_DIR/$MOD"
