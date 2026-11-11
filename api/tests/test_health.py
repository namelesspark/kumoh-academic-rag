"""서버가 살아 있는지 묻는 주소(GET /api/v1/health)가 약속한 모양대로 답하는지 확인하는 테스트.

여기서 약속(계약)은 명세 문서 API_SPEC.md에 적은 응답 형식을 가리킨다.
GET은 "읽기만 하겠다"는 뜻의 웹 요청 종류다.

실행(저장소 루트, FastAPI가 설치된 가상환경):
    python -m unittest api/tests/test_health.py -v
    python api/tests/test_health.py
"""

import pathlib
import sys
import unittest

# import 경로를 잡는다. 저장소 루트에서 실행해도 아래 두 import가 되게 한다.
#   api/        -> `from app.main import app`
#   api/tests/  -> `from asgi_harness import call_app`
TESTS_DIR = pathlib.Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from asgi_harness import call_app
from app.main import app


HEALTH = "/api/v1/health"

# API_SPEC.md에 적은 계약. 검색용 색인(인덱스) 연동 전이라 값이 고정이다.
EXPECTED_BODY = {"status": "ok", "index_loaded": False, "chunk_count": 0}


class HealthEndpointTest(unittest.TestCase):
    def test_health_returns_fixed_payload(self):
        """세 가지를 한 번에 본다: 성공 코드 200, 본문 형식 표시(content-type), 고정 본문.

        본문 형식은 중괄호와 따옴표로 값을 적는 텍스트 형식(JSON, JavaScript Object
        Notation)이어야 한다.
        """

        resp = call_app(app, "GET", HEALTH)

        self.assertEqual(resp.status, 200)
        self.assertTrue(resp.headers.get("content-type", "").startswith("application/json"))
        self.assertEqual(resp.json(), EXPECTED_BODY)

    def test_health_rejects_post(self):
        """GET만 열어 두었으니 데이터를 보내는 요청 종류(POST)는 "허용되지 않는 방식" 코드 405를 받아야 한다."""

        resp = call_app(app, "POST", HEALTH)

        self.assertEqual(resp.status, 405)


# `python api/tests/test_health.py`로 직접 실행할 때의 진입점.
if __name__ == "__main__":
    unittest.main()
