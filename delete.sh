#!/bin/bash
set -e

cd "$(dirname "$0")/addons"

# 20 unnötige Module für Depotix löschen
rm -rf crm \
       event \
       event_sale \
       event_crm \
       event_sms \
       event_booth \
       event_booth_sale \
       hr \
       hr_contract \
       hr_expense \
       hr_holidays \
       hr_recruitment \
       hr_skills \
       hr_timesheet \
       mass_mailing \
       mass_mailing_event \
       mass_mailing_crm \
       pos_restaurant \
       pos_self_order \
       website

echo "✅ Erste 20 unnötige Module gelöscht. Bitte docker compose down && docker compose up -d ausführen und in Odoo App-Liste aktualisieren."
