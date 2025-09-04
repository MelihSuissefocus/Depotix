#!/bin/bash

# Script to check if blocker addon directories exist

BLOCKERS=("crm" "website" "mass_mailing" "event" "hr" "point_of_sale" "mrp" "project" "documents" "helpdesk" "livechat")

echo "Checking blocker addon directories..."

for blocker in "${BLOCKERS[@]}"; do
    if [ -d "addons/$blocker" ]; then
        echo "✓ Blocker for $blocker exists"
    else
        echo "✗ Blocker for $blocker missing"
        exit 1
    fi
done

echo "All blocker directories exist."
