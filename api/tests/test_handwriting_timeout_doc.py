"""손글씨를 넣을 때 30초를 어디부터 재는지 설계 문서에서 확인한다."""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"
PAD_HEADING = "## 손글씨 입력 필기 패드 (#134)"
SECTION_HEADING = "### 넣기"
HEADING = re.compile(r"#{2,4}(?=[ \t]|$)")

SCOPE_SENTENCE = "시간 제한 30초는 PNG 만들기(`toBlob`)부터 업로드와 응답 본문 받기까지 한 번에 잰다."
LATE_SENTENCE = (
    "PNG가 기한 안에 나오지 않아도 시간 초과로 끝내고 획을 남기며, "
    "늦게 온 `toBlob` 결과와 이전 시도의 결과는 버린다."
)
OLD_SENTENCE = "시간 제한은 30초다."


def timeout_doc_problems(text):
    """「넣기」 절의 위치나 시간 제한 문구가 기준과 다르면 문제를 돌려준다."""
    lines = text.splitlines()
    starts = [index for index, line in enumerate(lines) if line == SECTION_HEADING]
    if len(starts) != 1:
        return ["「### 넣기」 제목이 문서에 한 번 있어야 한다."]
    start = starts[0]

    headings = [
        (index, len(match[0]))
        for index, line in enumerate(lines)
        if (match := HEADING.match(line))
    ]
    parent = next(
        (lines[index] for index, level in reversed(headings) if index < start and level == 2),
        None,
    )
    if parent != PAD_HEADING:
        return ["「### 넣기」 절은 손글씨 입력 필기 패드 제목 아래에 있어야 한다."]

    end = next((index for index, _ in headings if index > start), len(lines))
    section = "\n".join(lines[start + 1 : end])
    problems = [
        f"「넣기」 절에 {phrase!r}이(가) 한 번 있어야 한다."
        for phrase in (SCOPE_SENTENCE, LATE_SENTENCE, "30초")
        if section.count(phrase) != 1
    ]
    if OLD_SENTENCE in section:
        problems.append(f"「넣기」 절에 옛 문장 {OLD_SENTENCE!r}이 남아 있다.")
    return problems


class HandwritingTimeoutDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = UI_NOTES.read_text(encoding="utf-8")

    def test_timeout_sentences_in_insert_section(self):
        self.assertEqual(timeout_doc_problems(self.doc), [])

    def test_rejects_changes_to_either_sentence(self):
        for sentence in (SCOPE_SENTENCE, LATE_SENTENCE):
            without_sentence = self.doc.replace(sentence, "", 1)
            moved = without_sentence.replace(
                "\n### 대비\n", f"\n### 대비\n\n{sentence}\n", 1
            )
            changes = {
                "삭제": without_sentence,
                "한 글자 변경": self.doc.replace(sentence, sentence[:-1] + "!", 1),
                "중복": self.doc.replace(sentence, f"{sentence} {sentence}", 1),
                "대비 절로 이동": moved,
            }
            for heading in ("## 다른 절", "##\t다른 절", "### 다른 절", "####"):
                changes[heading] = self.doc.replace(sentence, f"\n{heading}\n{sentence}", 1)

            for change, modified in changes.items():
                with self.subTest(sentence=sentence, change=change):
                    self.assertTrue(timeout_doc_problems(modified))

    def test_rejects_extra_timeout_text(self):
        for extra in (OLD_SENTENCE, "30초"):
            with self.subTest(extra=extra):
                modified = self.doc.replace(LATE_SENTENCE, f"{LATE_SENTENCE} {extra}", 1)
                self.assertTrue(timeout_doc_problems(modified))
