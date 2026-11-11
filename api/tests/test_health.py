import sys, pathlib; _T = pathlib.Path(__file__).resolve().parent; sys.path[:0] = [str(_T.parent), str(_T)]  # noqa: E401,E702  api/, api/tests

import unittest

from asgi_harness import call_app
from app.main import app


class HealthEndpointTest(unittest.TestCase):
    def test_health_returns_fixed_payload(self):
        resp = call_app(app, "GET", "/api/v1/health")

        self.assertEqual(resp.status, 200)
        self.assertTrue(resp.headers.get("content-type", "").startswith("application/json"))
        self.assertEqual(
            resp.json(),
            {"status": "ok", "index_loaded": False, "chunk_count": 0},
        )

    def test_health_rejects_post(self):
        resp = call_app(app, "POST", "/api/v1/health")
        self.assertEqual(resp.status, 405)


if __name__ == "__main__":
    unittest.main()
