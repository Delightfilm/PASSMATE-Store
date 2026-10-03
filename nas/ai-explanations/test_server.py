import json
import sqlite3
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from http.server import ThreadingHTTPServer
from server import Cache, handler


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "cache.sqlite3"
        self.cache = Cache(self.path)
        self.key = "a" * 64
        self.user = "b" * 64

    def tearDown(self):
        self.temp.cleanup()

    def test_concurrent_claim_and_restart(self):
        with ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(lambda _: self.cache.claim(self.key, self.user), range(32)))
        owners = [r for r in results if r["status"] == "claimed"]
        self.assertEqual(len(owners), 1)
        payload = {"status": "ready", "explanation": {"correctAnswer": 0, "summary": "등록 정답을 설명하는 테스트 해설입니다.", "choiceReasons": ["보기 설명 테스트입니다."] * 4}}
        self.cache.finish(self.key, owners[0]["lease"], payload)
        restarted = Cache(self.path)
        self.assertEqual(restarted.get(self.key), payload)
        self.assertEqual(restarted.claim(self.key, "c" * 64), payload)
        with self.assertRaises(ValueError):
            restarted.finish(self.key, owners[0]["lease"], {"status": "failed"})
        self.assertEqual(restarted.get(self.key), payload)

    def test_failed_and_stale_never_reclaim(self):
        owner = self.cache.claim(self.key, self.user)
        with closing(self.cache.connect()) as db:
            db.execute("UPDATE explanations SET created=? WHERE key=?", (time.time() - 1000, self.key))
        self.assertEqual(self.cache.claim(self.key, self.user)["status"], "failed")
        self.cache.finish(self.key, owner["lease"], {"status": "refused", "message": "검수 보류"})
        self.assertEqual(self.cache.claim(self.key, self.user)["status"], "refused")

    def test_limits_are_persistent_and_hits_are_free(self):
        cache = Cache(self.path, daily=2, monthly=2, user_daily=1)
        owner = cache.claim(self.key, self.user)
        cache.finish(self.key, owner["lease"], {"status": "failed"})
        self.assertEqual(Cache(self.path, user_daily=1).claim("c" * 64, self.user)["status"], "limited")
        cache.claim("c" * 64, "d" * 64)
        self.assertEqual(cache.claim("e" * 64, "f" * 64)["status"], "limited")
        self.assertEqual(cache.claim(self.key, "f" * 64)["status"], "failed")

    def test_wrong_lease_and_invalid_payload(self):
        self.cache.claim(self.key, self.user)
        with self.assertRaises(ValueError):
            self.cache.finish(self.key, "c" * 64, {"status": "failed"})
        with self.assertRaises(ValueError):
            self.cache.finish(self.key, "c" * 64, {"status": "ready", "explanation": {"correctAnswer": 4}})

    def test_http_authorization_and_path_boundary(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler(self.cache, "secret-token-test-only"))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with self.assertRaises(urllib.error.HTTPError) as failure:
                urllib.request.urlopen(base + "/v1/" + self.key)
            self.assertEqual(failure.exception.code, 401)
            request = urllib.request.Request(base + "/v1/" + self.key + "/claim", data=json.dumps({"userHash": self.user}).encode(),
                headers={"Authorization": "Bearer secret-token-test-only", "Content-Type": "application/json"})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(json.load(response)["status"], "claimed")
            request = urllib.request.Request(base + "/v1/../../private", headers={"Authorization": "Bearer secret-token-test-only"})
            with self.assertRaises(urllib.error.HTTPError) as failure:
                urllib.request.urlopen(request)
            self.assertEqual(failure.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
