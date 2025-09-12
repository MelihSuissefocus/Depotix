#!/usr/bin/env bash
set -euo pipefail
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
echo "Done. Log into Django admin at https://api.depotix.ch/admin/"