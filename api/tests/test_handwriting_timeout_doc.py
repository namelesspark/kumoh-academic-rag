"""손글씨 「넣기」 절의 30초 측정 범위와 실패 뒤 초점 규칙(#179)을 설계 문서에서 확인한다."""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"
PAD_HEADING = "## 손글씨 입력 필기 패드 (#134)"
SECTION_HEADING = "### 넣기"
HEADING = re.compile(r"#{2,4}(?=[ \t]|$)")

TIMEOUT_RULE = "30초 규칙"
SCOPE_SENTENCE = "시간 제한 30초는 PNG 만들기(`toBlob`)부터 업로드와 응답 본문 받기까지 한 번에 잰다."
LATE_SENTENCE = (
    "PNG가 기한 안에 나오지 않아도 시간 초과로 끝내고 획을 남기며, "
    "늦게 온 `toBlob` 결과와 이전 시도의 결과는 버린다."
)
OLD_SENTENCE = "시간 제한은 30초다."

FOCUS_RULE = "실패 초점 규칙"
FOCUS_INSIDE_SENTENCE = (
    "실패했을 때 초점이 패드 안에 있거나 문서 어디에도 없으면(`null`·`body`) 넣기 버튼으로 초점을 옮긴다."
)
FOCUS_OUTSIDE_SENTENCE = (
    "실패했을 때 초점이 패드 밖에 있으면 그 초점을 옮기지 않고 질문 칸의 글과 선택 범위도 그대로 둔다."
)
OLD_FOCUS_SENTENCE = "실패하면 획을 그대로 두고 오류 문구를 띄운 뒤 넣기 버튼으로 초점을 옮긴다."
# 옛 문장의 조건 없는 부분. 앞뒤를 조금 고쳐 다른 절에 다시 적어도 잡도록 문서 전체에서 찾는다.
OLD_FOCUS_PHRASE = "오류 문구를 띄운 뒤 넣기 버튼으로 초점을 옮긴다"


def insert_section(text):
    """손글씨 패드 아래 「### 넣기」 절 본문과 구조 문제(없으면 None)를 돌려준다."""
    lines = text.splitlines()
    starts = [index for index, line in enumerate(lines) if line == SECTION_HEADING]
    if len(starts) != 1:
        return None, "「### 넣기」 제목이 문서에 한 번 있어야 한다."
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
        return None, "「### 넣기」 절은 손글씨 입력 필기 패드 제목 아래에 있어야 한다."

    end = next((index for index, _ in headings if index > start), len(lines))
    return "\n".join(lines[start + 1 : end]), None


def section_problems(text, rule, phrases, old_sentence):
    """「넣기」 절에 문구가 한 번씩 있고 옛 문장이 없는지 보고, 문제마다 규칙 이름을 붙인다."""
    section, problem = insert_section(text)
    if problem:
        return [f"{rule}: {problem}"]
    problems = [
        f"{rule}: 「넣기」 절에 {phrase!r}이(가) 한 번 있어야 한다."
        for phrase in phrases
        if section.count(phrase) != 1
    ]
    if old_sentence in section:
        problems.append(f"{rule}: 「넣기」 절에 옛 문장 {old_sentence!r}이 남아 있다.")
    return problems


def timeout_doc_problems(text):
    """「넣기」 절의 시간 제한 문구가 기준과 다르면 문제를 돌려준다."""
    return section_problems(
        text, TIMEOUT_RULE, (SCOPE_SENTENCE, LATE_SENTENCE, "30초"), OLD_SENTENCE
    )


def focus_doc_problems(text):
    """「넣기」 절의 실패 뒤 초점 문구가 기준과 다르면 문제를 돌려준다.

    두 문장은 각각 줄 맨 앞 `- `로 시작하는 목록 항목 하나 전체여야 한다. 들여 쓴 이어지는 줄이 붙으면
    같은 항목에 조건이 덧붙은 것으로 보고 실패한다. 옛 문장은 줄바꿈과 들여쓰기를 공백 하나로 접어
    문서 전체에서 찾는다.
    """
    section, problem = insert_section(text)
    if problem:
        return [f"{FOCUS_RULE}: {problem}"]
    lines = section.splitlines()
    problems = []
    for sentence in (FOCUS_INSIDE_SENTENCE, FOCUS_OUTSIDE_SENTENCE):
        items = [index for index, line in enumerate(lines) if line == f"- {sentence}"]
        if len(items) != 1 or section.count(sentence) != 1:
            problems.append(f"{FOCUS_RULE}: 「넣기」 절에 '- {sentence}' 한 줄 항목이 한 번 있어야 한다.")
            continue
        following = lines[items[0] + 1] if items[0] + 1 < len(lines) else ""
        if following[:1] in (" ", "\t") and following.strip():
            problems.append(f"{FOCUS_RULE}: {sentence!r} 항목에 이어지는 줄이 붙어 있다.")
    if OLD_FOCUS_PHRASE in re.sub(r"\s+", " ", text):
        problems.append(f"{FOCUS_RULE}: 문서에 옛 문장 {OLD_FOCUS_PHRASE!r}이 남아 있다.")
    return problems


def sentence_changes(doc, sentence):
    """문장 하나를 지우기·한 글자 바꾸기·두 번 쓰기·대비 절로 옮기기·앞에 제목 끼우기로 바꾼 문서들."""
    without_sentence = doc.replace(sentence, "", 1)
    changes = {
        "삭제": without_sentence,
        "한 글자 변경": doc.replace(sentence, sentence[:-1] + "!", 1),
        "중복": doc.replace(sentence, f"{sentence} {sentence}", 1),
        "대비 절로 이동": without_sentence.replace("\n### 대비\n", f"\n### 대비\n\n{sentence}\n", 1),
    }
    for heading in ("## 다른 절", "##\t다른 절", "### 다른 절", "####"):
        changes[heading] = doc.replace(sentence, f"\n{heading}\n{sentence}", 1)
    return changes


class HandwritingTimeoutDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = UI_NOTES.read_text(encoding="utf-8")

    def test_timeout_sentences_in_insert_section(self):
        self.assertEqual(timeout_doc_problems(self.doc), [])

    def test_rejects_changes_to_either_sentence(self):
        for sentence in (SCOPE_SENTENCE, LATE_SENTENCE):
            for change, modified in sentence_changes(self.doc, sentence).items():
                with self.subTest(sentence=sentence, change=change):
                    problems = timeout_doc_problems(modified)
                    self.assertTrue(problems)
                    self.assertTrue(all(p.startswith(f"{TIMEOUT_RULE}: ") for p in problems), problems)

    def test_rejects_extra_timeout_text(self):
        for extra in (OLD_SENTENCE, "30초"):
            with self.subTest(extra=extra):
                modified = self.doc.replace(LATE_SENTENCE, f"{LATE_SENTENCE} {extra}", 1)
                self.assertTrue(timeout_doc_problems(modified))


class HandwritingFailureFocusDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = UI_NOTES.read_text(encoding="utf-8")

    def test_focus_sentences_in_insert_section(self):
        self.assertEqual(focus_doc_problems(self.doc), [])

    def test_focus_sentences_avoid_timeout_phrases(self):
        # 30초 검사(정확히 한 번)와 웹 상수 비교(「시간 제한 N초」)를 흔들지 않는다.
        for sentence in (FOCUS_INSIDE_SENTENCE, FOCUS_OUTSIDE_SENTENCE):
            with self.subTest(sentence=sentence):
                self.assertNotIn("30초", sentence)
                self.assertIsNone(re.search(r"시간 제한 \d+초", sentence))

    def test_rejects_changes_to_either_focus_sentence(self):
        for sentence in (FOCUS_INSIDE_SENTENCE, FOCUS_OUTSIDE_SENTENCE):
            for change, modified in sentence_changes(self.doc, sentence).items():
                with self.subTest(sentence=sentence, change=change):
                    problems = focus_doc_problems(modified)
                    self.assertTrue(problems)
                    self.assertTrue(all(p.startswith(f"{FOCUS_RULE}: ") for p in problems), problems)

    def test_rejects_condition_prefixed_to_focus_sentence(self):
        # 앞에 조건을 붙이면 지금 동작에 적용할 규칙이 빠진다.
        for sentence in (FOCUS_INSIDE_SENTENCE, FOCUS_OUTSIDE_SENTENCE):
            with self.subTest(sentence=sentence):
                modified = self.doc.replace(sentence, f"이전 동작을 재현할 때만 {sentence}", 1)
                self.assertTrue(focus_doc_problems(modified))

    def test_rejects_condition_on_neighbor_line_of_same_item(self):
        # 같은 목록 항목 안에서 조건을 앞줄이나 뒷줄에 나눠 적어도 실패한다.
        for sentence in (FOCUS_INSIDE_SENTENCE, FOCUS_OUTSIDE_SENTENCE):
            item = f"- {sentence}"
            changes = {
                "앞줄": f"- 이전 동작을 재현할 때만\n  {sentence}",
                "뒷줄": f"{item}\n  단, 이전 동작을 재현할 때만 그렇다.",
            }
            for change, replacement in changes.items():
                with self.subTest(sentence=sentence, change=change):
                    modified = self.doc.replace(item, replacement, 1)
                    self.assertNotEqual(modified, self.doc)
                    self.assertTrue(focus_doc_problems(modified))

    def test_rejects_old_sentence_split_across_lines(self):
        split = OLD_FOCUS_SENTENCE.replace("뒤 넣기", "뒤\n  넣기")
        modified = self.doc.replace("\n### 대비\n", f"\n### 대비\n\n- {split}\n", 1)
        problems = focus_doc_problems(modified)
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("옛 문장", problems[0])

    def test_rejects_old_unconditional_sentence_anywhere(self):
        places = {
            "넣기 절": (FOCUS_OUTSIDE_SENTENCE, f"{FOCUS_OUTSIDE_SENTENCE}\n- {OLD_FOCUS_SENTENCE}"),
            "대비 절": ("\n### 대비\n", f"\n### 대비\n\n- {OLD_FOCUS_SENTENCE}\n"),
        }
        for place, (anchor, replacement) in places.items():
            with self.subTest(place=place):
                modified = self.doc.replace(anchor, replacement, 1)
                self.assertNotEqual(modified, self.doc)
                problems = focus_doc_problems(modified)
                self.assertEqual(len(problems), 1, problems)
                self.assertIn("옛 문장", problems[0])
                self.assertTrue(problems[0].startswith(f"{FOCUS_RULE}: "))

    def test_each_rule_reports_only_its_own_sentences(self):
        # 초점 문장을 지워도 30초 검사는 통과하고, 30초 문장을 지워도 초점 검사는 통과한다.
        without_focus = self.doc.replace(FOCUS_OUTSIDE_SENTENCE, "", 1)
        self.assertEqual(timeout_doc_problems(without_focus), [])
        self.assertTrue(focus_doc_problems(without_focus))
        without_timeout = self.doc.replace(SCOPE_SENTENCE, "", 1)
        self.assertEqual(focus_doc_problems(without_timeout), [])
        self.assertTrue(timeout_doc_problems(without_timeout))
