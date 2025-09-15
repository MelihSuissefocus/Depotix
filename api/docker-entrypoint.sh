#!/usr/bin/env bash
set -euo pipefail
python manage.py migrate --noinput
python manage.py collectstatic --noinput
WSGI_MODULE=$(python - <<'PY'
import pathlib
c = [p for p in pathlib.Path('.').rglob('wsgi.py') if 'venv' not in str(p)]
print((c[0].parent.name + ".wsgi:application") if c else "inventory.wsgi:application")
PY
)
exec gunicorn "$WSGI_MODULE" -b 0.0.0.0:8000 --workers 3
