FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/worker

RUN useradd --create-home --uid 10001 passmate

WORKDIR /app

COPY worker/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY --chown=passmate:passmate worker /app/worker

RUN mkdir -p /data/work /data/output /data/master \
    && chown -R passmate:passmate /data/work /data/output

USER passmate

HEALTHCHECK --interval=60s --timeout=10s --start-period=20s --retries=3 \
  CMD ["python", "-m", "passmate_worker.main", "--check-config"]

CMD ["python", "-m", "passmate_worker.main"]
