"""설계 문서의 손글씨 「넣기」 절이 30초 기한의 범위(#158)를 적었는지 확인한다.

화면(`chat.js`)은 넣기 한 번에 PNG 만들기(`toBlob`)부터 업로드와 응답 본문 받기까지 30초 기한 하나를
쓴다. 문서가 「시간 제한은 30초다」라고만 적으면 PNG 만들기가 기한 밖이라고 읽혀, `toBlob` 콜백이
오지 않을 때 패드가 「글씨를 읽는 중…」에 멈추는 일을 다시 만들 수 있다. 이 테스트는 이슈 #158의 두
문장이 「### 넣기」 절에 글자 그대로 한 번씩 있고, 옛 문장이 없고, 「30초」가 이 절에 한 번만 나오는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다.

실행(저장소 루트):
    python -B -m unittest api.tests.test_handwriting_timeout_doc
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"
PAD_HEADING = "## 손글씨 입력 필기 패드 (#134)"
SECTION_HEADING = "### 넣기"

# 이슈 #158의 두 문장. 낱말을 따로 찾으면 뜻을 뒤집은 문장도 통과해 글자 그대로 본다.
SCOPE_SENTENCE = "시간 제한 30초는 PNG 만들기(`toBlob`)부터 업로드와 응답 본문 받기까지 한 번에 잰다."
LATE_SENTENCE = (
    "PNG가 기한 안에 나오지 않아도 시간 초과로 끝내고 획을 남기며, "
    "늦게 온 `toBlob` 결과와 이전 시도의 결과는 버린다."
)
OLD_SENTENCE = "시간 제한은 30초다."


def visible_text(text):
    """HTML 주석(`<!-- … -->`)을 걷어 낸 글. 닫히지 않은 주석은 문서 끝까지 숨은 것으로 본다.

    주석 안 글은 렌더링한 문서에 보이지 않는다. 그 안에 문장을 숨기고 검사를 통과하면 안 된다.
    """
    return re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.DOTALL)


def insert_section(text):
    """손글씨 패드 절 안의 `### 넣기` 머리부터 다음 제목(`#`~`###`) 앞(없으면 끝)까지를 돌려준다.

    다른 절에도 `### 넣기`가 생길 수 있어 손글씨 패드 절 머리 뒤에서 찾는다.
    """
    pad = text.index(PAD_HEADING)
    match = re.search(r"^" + re.escape(SECTION_HEADING) + r"[ \t]*$", text[pad:], re.MULTILINE)
    if match is None:
        raise ValueError(f"{SECTION_HEADING} 절이 없다")
    start = pad + match.start()
    body = start + len(match.group(0))
    following = re.search(r"^#{1,3} ", text[body:], re.MULTILINE)
    end = len(text) if following is None else body + following.start()
    return text[start:end]


class InsertSectionTest(unittest.TestCase):
    """절 자르기와 주석 걷기를 가상 문서로 확인한다."""

    def test_section_stops_at_next_heading(self):
        doc = f"{PAD_HEADING}\n\n{SECTION_HEADING}\n\n- 가\n\n### 대비\n\n- 30초\n"
        section = insert_section(doc)
        self.assertIn("- 가", section)
        self.assertNotIn("대비", section)

    def test_insert_heading_before_pad_section_is_ignored(self):
        doc = f"{SECTION_HEADING}\n\n- 다른 절\n\n{PAD_HEADING}\n\n{SECTION_HEADING}\n\n- 패드\n"
        section = insert_section(doc)
        self.assertIn("- 패드", section)
        self.assertNotIn("다른 절", section)

    def test_comments_hide_sentences(self):
        self.assertNotIn(SCOPE_SENTENCE, visible_text(f"<!-- {SCOPE_SENTENCE} -->"))
        self.assertNotIn(LATE_SENTENCE, visible_text(f"<!-- 닫지 않은 주석\n{LATE_SENTENCE}"))


class HandwritingTimeoutDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.section = insert_section(visible_text(UI_NOTES.read_text(encoding="utf-8")))

    def test_scope_sentence_appears_once(self):
        self.assertEqual(self.section.count(SCOPE_SENTENCE), 1)

    def test_late_result_sentence_appears_once(self):
        self.assertEqual(self.section.count(LATE_SENTENCE), 1)

    def test_old_sentence_is_gone(self):
        self.assertNotIn(OLD_SENTENCE, self.section)

    def test_thirty_seconds_is_written_once(self):
        # 기한을 두 곳에 적으면 한쪽만 고쳐 서로 다른 값이 남는다.
        self.assertEqual(self.section.count("30초"), 1)


if __name__ == "__main__":
    unittest.main()
