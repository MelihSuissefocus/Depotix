FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api/ .
CMD bash -lc "python manage.py migrate --noinput && \
              python manage.py collectstatic --noinput && \
              gunicorn depotix_api.wsgi:application -b 0.0.0.0:8000 --workers 3"
