FROM python:3.12

WORKDIR /app
COPY . .

# Minimal setup
RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

# WICHTIG: setuptools ZUERST installieren
RUN pip install --upgrade pip setuptools wheel

# Dann requirements
RUN if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
RUN if [ -f requirements-prod.txt ]; then pip install -r requirements-prod.txt; fi

# Sicherstellen dass wichtige Packages da sind
RUN pip install django djangorestframework psycopg2-binary gunicorn

# Test dass pkg_resources funktioniert
RUN python -c "import pkg_resources; print('pkg_resources OK')"

# Einfaches Entrypoint
RUN echo '#!/bin/sh\nset -e\npython manage.py migrate --noinput || true\npython manage.py collectstatic --noinput || true\nexec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 60 depotix_api.wsgi:application' > /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000
CMD ["/entrypoint.sh"]
