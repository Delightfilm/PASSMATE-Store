FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/worker

RUN useradd --create-home --uid 10001 passmate

WORKDIR /app

COPY worker /app/worker

RUN mkdir -p /data/work /data/output /data/master \
    && chown -R passmate:passmate /data/work /data/output

USER passmate

CMD ["python", "-m", "passmate_worker.main"]
