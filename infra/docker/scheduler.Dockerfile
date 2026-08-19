FROM python:3.14.7-slim-bookworm@sha256:23c59390fc717bf09f9336908199a0ae75d9c4264bf296123f94ad772fea3b52 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    PATH=/opt/venv/bin:$PATH

RUN groupadd --system --gid 10001 league \
    && useradd --system --uid 10001 --gid league --home-dir /nonexistent --shell /usr/sbin/nologin league \
    && python -m venv /opt/venv

WORKDIR /app
COPY services/scheduler/requirements.runtime.lock ./requirements.runtime.lock
RUN pip install --disable-pip-version-check --no-cache-dir --requirement requirements.runtime.lock
COPY services/scheduler/src ./src

USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]

CMD ["uvicorn", "league_scheduler.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
