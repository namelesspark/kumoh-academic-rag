"""받은 학번·비밀번호를 시연 계정 세 개와 견준다.

전시장 입구의 방명록 책상과 같다. 미리 만들어 둔 이름표 세 장 중 하나와 글자가
똑같을 때만 그 이름표를 내준다. 누가 받아 갔는지는 적어 두지 않는다.

비밀번호는 화면이 채워 주는 공개 값이다. 학교 인증과 연결하지 않으며, 로그인 상태를
기억하는 값(세션·토큰·쿠키)도 만들지 않는다.
"""

from hashlib import sha256
from hmac import compare_digest


# (학번, 비밀번호, 학생 목록의 id). 이슈 #79에서 합의한 값이다.
# 학번은 실제 학번처럼 2로 시작하는 여덟 자리다. 실제 학생과 겹치지 않게 입학연도가 없는 2099를 쓴다.
DEMO_ACCOUNTS = (
    ("20990002", "demo-d02-pass", "demo-d02"),
    ("20990003", "demo-d03-pass", "demo-d03"),
    ("20990004", "demo-d04-pass", "demo-d04"),
)
LOGIN_FAILED_MESSAGE = "학번 또는 비밀번호가 맞지 않아요"


def _digest(value: str) -> bytes:
    """문자열을 길이가 고정된 요약값(SHA-256)으로 바꾼다.

    `compare_digest`는 한글처럼 ASCII 밖의 글자가 든 문자열을 받으면 TypeError를 낸다.
    그래서 바이트로 바꾼 뒤 견준다. 짝이 맞지 않는 대리 문자(surrogate)는 UTF-8로
    바꿀 수 없어 오류가 나므로 `surrogatepass`로 그대로 통과시킨다.
    """

    return sha256(value.encode("utf-8", "surrogatepass")).digest()


def match_demo_account(student_number: str, password: str) -> str | None:
    """두 값이 한 계정과 글자 그대로 같으면 그 학생의 id를, 아니면 None을 돌려준다.

    공백을 떼거나 대소문자를 맞추지 않는다. 다른 계정의 비밀번호도 통과하지 못한다.
    """

    number_digest, password_digest = _digest(student_number), _digest(password)
    matched = None
    for number, secret, student_id in DEMO_ACCOUNTS:
        if compare_digest(number_digest, _digest(number)) & compare_digest(
            password_digest, _digest(secret)
        ):
            matched = student_id
    return matched
