#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AD="$ROOT/addons"

# Liste der Module, die NICHT sichtbar/installierbar sein sollen
BLOCK=(
  crm website mass_mailing event hr point_of_sale mrp project documents helpdesk im_livechat
  livechat website_livechat website_crm website_event website_mass_mailing
  hr_timesheet hr_holidays hr_attendance hr_recruitment project_timesheet
  crm_iap mass_mailing_sms survey fleet maintenance timesheet
  calendar discuss lunch survey_crm project_forecast pos_restaurant
  website_blog website_forum website_slides website_sale
  pos_hr pos_loyalty pos_mercury pos_adyen pos_six payment
  website_payment website_payment_stripe payment_stripe payment_paypal
  delivery stock_delivery mrp_plm mrp_maintenance quality quality_control
  website_appointment appointment calendar_sms voip social_media
  website_enterprise website_studio studio web_studio web_cohort
)

mkdir -p "$AD"
for m in "${BLOCK[@]}"; do
  d="$AD/$m"
  mkdir -p "$d"
  # Minimaler Platzhalter mit gleicher Modul-ID, aber nicht installierbar
  cat > "$d/__manifest__.py" <<PY
{
  "name": "Blocked: $m",
  "version": "17.0.0.0",
  "summary": "Depotix blockiert dieses Modul.",
  "installable": False,
  "application": False
}
PY
  : > "$d/__init__.py"
  echo "✔ Blocker erzeugt: $m"
done
