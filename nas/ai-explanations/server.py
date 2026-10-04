"""Private NAS persistence/claims only. AI credentials and generation stay on Vercel."""
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

KEY = re.compile(r"^[a-f0-9]{64}$")
MAX_BODY = 32_768


class Cache:
    def __init__(self, path, daily=200, monthly=500, user_daily=30, concurrent=4):
        self.path = str(path)
        self.limits = (daily, monthly, user_daily, concurrent)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS explanations (
                    key TEXT PRIMARY KEY, state TEXT NOT NULL, lease TEXT NOT NULL,
                    user_hash TEXT NOT NULL, created REAL NOT NULL, day TEXT NOT NULL,
                    month TEXT NOT NULL, payload TEXT);
                CREATE INDEX IF NOT EXISTS idx_explanations_day ON explanations(day);
                CREATE INDEX IF NOT EXISTS idx_explanations_month ON explanations(month);
                CREATE INDEX IF NOT EXISTS idx_explanations_user_day ON explanations(user_hash, day);
            """)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        db.row_factory = sqlite3.Row
        return db

    @staticmethod
    def reply(row):
        if not row:
            return {"status": "missing"}
        # Never reclaim timed-out calls automatically: the provider may have billed.
        if row["state"] == "generating" and time.time() - row["created"] > 180:
            return {"status": "failed", "message": "생성 상태 확인이 필요합니다. 중복 비용 방지를 위해 자동 재생성하지 않습니다."}
        return json.loads(row["payload"]) if row["payload"] else {"status": row["state"]}

    def get(self, key):
        with closing(self.connect()) as db:
            return self.reply(db.execute("SELECT * FROM explanations WHERE key=?", (key,)).fetchone())

    def claim(self, key, user_hash, requested_lease=None):
        if requested_lease is not None and (not isinstance(requested_lease, str) or not KEY.fullmatch(requested_lease)):
            raise ValueError("lease_invalid")
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        month = day[:7]
        with closing(self.connect()) as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                row = db.execute("SELECT * FROM explanations WHERE key=?", (key,)).fetchone()
                if row:
                    # An immediate transport retry by the SAME caller can recover its
                    # committed claim. Other calls never receive the owner's lease.
                    if (requested_lease and row["state"] == "generating" and row["lease"] == requested_lease
                            and row["user_hash"] == user_hash and time.time() - row["created"] <= 180):
                        db.commit()
                        return {"status": "claimed", "lease": requested_lease}
                    payload = json.loads(row["payload"]) if row["payload"] else {}
                    if not (row["state"] == "failed" and payload.get("retryable") is True):
                        db.commit()
                        return self.reply(row)
                daily, monthly, user_daily, concurrent = self.limits
                counts = [db.execute(sql, args).fetchone()[0] for sql, args in [
                    ("SELECT count(*) FROM explanations WHERE day=? AND key<>?", (day, key)),
                    ("SELECT count(*) FROM explanations WHERE month=? AND key<>?", (month, key)),
                    ("SELECT count(*) FROM explanations WHERE day=? AND user_hash=? AND key<>?", (day, user_hash, key)),
                    ("SELECT count(*) FROM explanations WHERE state='generating' AND created>?", (time.time() - 180,)),
                ]]
                if any(count >= limit for count, limit in zip(counts, (daily, monthly, user_daily, concurrent))):
                    db.rollback()
                    return {"status": "limited"}
                lease = requested_lease or secrets.token_hex(32)
                if row:
                    db.execute("UPDATE explanations SET state='generating',lease=?,user_hash=?,created=?,day=?,month=?,payload=NULL WHERE key=?",
                               (lease, user_hash, time.time(), day, month, key))
                else:
                    db.execute("INSERT INTO explanations VALUES (?, 'generating', ?, ?, ?, ?, ?, NULL)",
                               (key, lease, user_hash, time.time(), day, month))
                db.commit()  # Durable claim BEFORE any paid API call.
                return {"status": "claimed", "lease": lease}
            except Exception:
                db.rollback()
                raise

    def finish(self, key, lease, payload):
        if payload.get("status") not in ("ready", "refused", "failed"):
            raise ValueError("invalid_state")
        if "retryable" in payload and (payload["status"] != "failed" or payload["retryable"] is not True):
            raise ValueError("invalid_retryable")
        if payload["status"] == "ready":
            item = payload.get("explanation", {})
            if type(item.get("correctAnswer")) is not int or not 0 <= item["correctAnswer"] <= 3:
                raise ValueError("invalid_explanation")
            if not isinstance(item.get("summary"), str) or not 10 <= len(item["summary"]) <= 2200:
                raise ValueError("invalid_explanation")
            reasons = item.get("choiceReasons")
            if not isinstance(reasons, list) or len(reasons) != 4 or not all(isinstance(s, str) and 5 <= len(s) <= 900 for s in reasons):
                raise ValueError("invalid_explanation")
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode()) > MAX_BODY - 1024:
            raise ValueError("payload_too_large")
        with closing(self.connect()) as db:
            # Compare-and-set; an old or duplicated completion cannot replace a result.
            cursor = db.execute("UPDATE explanations SET state=?,payload=? WHERE key=? AND lease=? AND state='generating'",
                                (payload["status"], encoded, key, lease))
            if cursor.rowcount != 1:
                row = db.execute("SELECT lease,payload FROM explanations WHERE key=?", (key,)).fetchone()
                if row and row["lease"] == lease and row["payload"] == encoded:
                    return {"ok": True}
                raise ValueError("lease_invalid")
        return {"ok": True}


def handler(cache, token):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):
            pass  # Never log Authorization, user IDs, prompts or model output.

        def send(self, status, body):
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(data)
            self.close_connection = True

        def authorized(self):
            return hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token)

        def do_GET(self):
            if self.path == "/health":
                return self.send(200, {"ok": True})
            if not self.authorized():
                return self.send(401, {"error": "unauthorized"})
            match = re.fullmatch(r"/v1/([a-f0-9]{64})", self.path)
            if not match:
                return self.send(404, {"error": "not_found"})
            try:
                self.send(200, cache.get(match[1]))
            except sqlite3.Error:
                self.send(503, {"error": "storage_unavailable"})

        def do_POST(self):
            if not self.authorized():
                return self.send(401, {"error": "unauthorized"})
            match = re.fullmatch(r"/v1/([a-f0-9]{64})/(claim|finish)", self.path)
            if not match:
                return self.send(404, {"error": "not_found"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= MAX_BODY:
                    return self.send(413, {"error": "body_too_large"})
                if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    return self.send(415, {"error": "json_required"})
                self.connection.settimeout(10)
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError("object_required")
                if match[2] == "claim":
                    if not isinstance(body.get("userHash"), str) or not KEY.fullmatch(body["userHash"]):
                        raise ValueError("user_hash_required")
                    result = cache.claim(match[1], body["userHash"], body.get("lease"))
                else:
                    if not isinstance(body.get("lease"), str) or not KEY.fullmatch(body["lease"]) or not isinstance(body.get("payload"), dict):
                        raise ValueError("lease_required")
                    result = cache.finish(match[1], body["lease"], body["payload"])
                self.send(200, result)
            except (ValueError, TypeError, UnicodeError):
                self.send(400, {"error": "invalid_request"})
            except (sqlite3.Error, OSError):
                self.send(503, {"error": "storage_unavailable"})

    return Handler


if __name__ == "__main__":
    token = os.environ.get("PASSMATE_AI_CACHE_TOKEN", "")
    if len(token) < 32 or token == "CHANGE_ME_WITH_64_HEX_RANDOM_CHARACTERS":
        raise SystemExit("A private cache token of at least 32 characters is required")
    cache = Cache(os.environ.get("PASSMATE_AI_CACHE_DB", "/data/explanations.sqlite3"),
                  daily=int(os.environ.get("PASSMATE_AI_DAILY_LIMIT", "200")),
                  monthly=int(os.environ.get("PASSMATE_AI_MONTHLY_LIMIT", "500")),
                  user_daily=int(os.environ.get("PASSMATE_AI_USER_DAILY_LIMIT", "30")))
    ThreadingHTTPServer(("0.0.0.0", 8090), handler(cache, token)).serve_forever()
