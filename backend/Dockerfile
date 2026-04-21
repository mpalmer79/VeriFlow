# VeriFlow backend — production image.
# Single-stage because the backend has no build step beyond pip install.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System packages needed to build psycopg2 wheels.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Run as a non-root user. Evidence dir is created on startup.
RUN useradd --system --uid 1001 veriflow \
    && mkdir -p /var/lib/veriflow/evidence \
    && chown -R veriflow:veriflow /app /var/lib/veriflow

USER veriflow

ENV EVIDENCE_STORAGE_DIR=/var/lib/veriflow/evidence

# EXPOSE is optional in Railway, but harmless
EXPOSE 8080

# 🔥 CRITICAL FIX: use $PORT + run migrations
CMD ["sh", "-c", "python -m scripts.ensure_alembic_baseline && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
