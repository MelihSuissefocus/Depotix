#!/bin/bash

# Script to remove unwanted Odoo addons
# Keeps only the essential modules needed for Depotix

echo "Removing unwanted addons..."

# Define addons to remove
ADDONS_TO_REMOVE=(
    "analytic"
    "http_routing" 
    "l10n_de"
    "mail"
    "portal"
    "resource"
    "sale"
    "web"
)

# Change to the addons directory
cd /Users/melihoezkan/Library/Mobile\ Documents/com~apple~CloudDocs/project/Depotix/addons

# Remove each unwanted addon
for addon in "${ADDONS_TO_REMOVE[@]}"; do
    if [ -d "$addon" ]; then
        echo "Removing addon: $addon"
        rm -rf "$addon"
    else
        echo "Addon $addon not found, skipping..."
    fi
done

echo "Cleanup completed!"
echo ""
echo "Remaining addons:"
ls -la

echo ""
echo "Essential modules kept:"
echo "- account (Rechnungsstellung)"
echo "- contacts (Kontakte)" 
echo "- depotix_branding (Custom branding)"
echo "- l10n_ch (Schweiz – Buchhaltung)"
echo "- product (Produkte & Preislisten)"
echo "- purchase (Einkauf)"
echo "- purchase_stock (Einkauf Lager)"
echo "- sale_management (Verkauf)"
echo "- sale_stock (Verkaufs- und Lagerverwaltung)"
echo "- stock (Lager)"
echo "- stock_account (Lagerbuchführung)"
echo "- uom (Maßeinheiten)"