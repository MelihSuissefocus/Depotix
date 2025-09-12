FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# System deps for WeasyPrint/QR rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libcairo2 libpango-1.0-0 libgdk-pixbuf2.0-0 libffi-dev \
    libjpeg62-turbo zlib1g fonts-dejavu-core curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ .

# Collect static if WhiteNoise is used (safe if absent)
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000
CMD ["gunicorn", "depotix_api.wsgi:application", "--bind", "0.0.0.0:8000", "--timeout", "120"]