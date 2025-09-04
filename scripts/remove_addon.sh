#!/usr/bin/env bash
set -euo pipefail
MOD="${1:-}"
if [[ -z "$MOD" ]]; then
  echo "Usage: $0 <module_name>"; exit 1
fi

ADDONS_DIR="addons"

# Module, die du NICHT löschen willst (Kernbedarf):
PROTECTED=( product uom stock stock_account sale sale_management purchase account contacts mail portal report auth_signup )

if [[ ! -d "$ADDONS_DIR/$MOD" ]]; then
  echo "❌ Modul '$MOD' existiert nicht unter $ADDONS_DIR"; exit 2
fi

for p in "${PROTECTED[@]}"; do
  if [[ "$MOD" == "$p" ]]; then
    echo "⛔ '$MOD' ist geschützt und sollte nicht gelöscht werden."; exit 3
  fi
done

echo "=== DRY RUN ==="
echo "Würde löschen: $ADDONS_DIR/$MOD"
read -p "Zum Löschen 'yes' tippen: " ans
[[ "$ans" == "yes" ]] || { echo "Abgebrochen."; exit 0; }

rm -rf -- "$ADDONS_DIR/$MOD"
echo "✅ Gelöscht: $ADDONS_DIR/$MOD"
