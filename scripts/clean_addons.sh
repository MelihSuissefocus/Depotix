#!/bin/bash

# Whitelist für Depotix: Kern, Business, Localization, Optional
WHITELIST=(
    "base"
    "web"
    "mail"
    "report"
    "resource"
    "http_routing"
    "stock"
    "stock_account"
    "sale"
    "sale_management"
    "sale_stock"
    "purchase"
    "purchase_stock"
    "account"
    "contacts"
    "product"
    "uom"
    "l10n_ch"
    "l10n_de"
    "analytic"
    "portal"
    "depotix_branding"  # Falls vorhanden
)

ADDONS_DIR="./addons"

# Funktion, um zu prüfen, ob ein Verzeichnis in der Whitelist ist
is_whitelisted() {
    local dir=$1
    for item in "${WHITELIST[@]}"; do
        if [[ "$dir" == "$item" ]]; then
            return 0
        fi
    done
    return 1
}

# Dry-Run: Zeige, was gelöscht werden würde
echo "Dry-Run: Folgende Verzeichnisse würden gelöscht werden:"
TO_DELETE=()
for dir in "$ADDONS_DIR"/*/; do
    dir_name=$(basename "$dir")
    if ! is_whitelisted "$dir_name"; then
        echo "  würde löschen: $dir_name"
        TO_DELETE+=("$dir")
    fi
done

if [ ${#TO_DELETE[@]} -eq 0 ]; then
    echo "Keine Verzeichnisse zu löschen."
    exit 0
fi

# Interaktive Bestätigung
read -p "Möchten Sie die oben genannten Verzeichnisse wirklich löschen? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Abbruch. Keine Änderungen vorgenommen."
    exit 0
fi

# Echte Löschung
echo "Lösche Verzeichnisse..."
for dir in "${TO_DELETE[@]}"; do
    echo "Lösche: $dir"
    rm -rf "$dir"
done

echo "Bereinigung abgeschlossen."
