"""
GET /api/v1/health 테스트.

실행 (저장소 루트에서):
    python -B -m unittest api/tests/test_health.py -v
"""

import sys
import unittest
from pathlib import Path


# ------------------------------------------------------------
# 경로 설정: 패키지 설치 없이 import 되게 한다.
#   api/        → `from app...` 용
#   api/tests/  → `from asgi_harness ...` 용
# ------------------------------------------------------------

TESTS_DIR = Path(__file__).resolve().parent

API_DIR = TESTS_DIR.parent

for folder in (API_DIR, TESTS_DIR):
    if str(folder) not in sys.path:
        sys.path.insert(0, str(folder))


# ------------------------------------------------------------
# 의존성 확인: 없으면 어떤 패키지가 왜 필요한지 한 줄로 알려 준다.
# (의존성이 없어도 테스트를 건너뛰지 않는다. 실패로 남겨야 0건 통과가 생기지 않는다.)
# ------------------------------------------------------------

from asgi_harness import call_app, require_dependencies  # noqa: E402

require_dependencies()

from app.main import app  # noqa: E402  (경로·의존성 확인 뒤에 import 해야 함)


class HealthTest(unittest.TestCase):
    """health 응답 계약."""

    def test_health_returns_fixed_body(self):
        """200 과 고정 본문을 돌려준다."""

        response = call_app(app, "GET", "/api/v1/health")

        self.assertEqual(response.status, 200)

        self.assertEqual(
            response.json(),
            {"status": "ok", "index_loaded": False, "chunk_count": 0},
        )

    def test_health_is_json(self):
        """content-type 이 JSON 이다."""

        response = call_app(app, "GET", "/api/v1/health")

        content_type = response.header("content-type") or ""

        self.assertTrue(content_type.startswith("application/json"))


if __name__ == "__main__":
    unittest.main()
