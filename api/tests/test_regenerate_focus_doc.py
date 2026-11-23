"""「다시 답하기 뒤 초점 복원 (#203)」 절에 복원 규칙이 그대로 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다. 숨은 줄(최상위 코드 블록·HTML 블록)과
제목 판정은 `test_chat_history_limit_doc.py`의 CommonMark 줄 규칙을 그대로 가져다 쓴다.

- 절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 장 안에서 `### 수정 성공 뒤 초점 복원 (#200)` 바로 다음 3단계 절이다.
  끝은 시작 제목 뒤에 나오는 다음 제목이며, 단계와 상관없이 끊는다. 이 절은 #140~#170 문법 제한 구간(#170 절 끝까지) 밖에 있다.
- 규칙 줄은 숨지 않은 줄과 문자열 전체로 비교한다. 문장 일부만 찾으면 조건을 바꾸거나 단서를 붙여도 통과한다.
- #200 절의 제외 줄이 수정 버튼 규칙에만 해당한다고 고친 문장인지도 같은 방식으로 본다.
규칙을 고칠 때는 아래 줄도 함께 고친다.
"""

import unittest
from pathlib import Path

from test_chat_history_limit_doc import block_lines, headings, split_lines

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"

PARENT_HEADING = "## 질문 수정·다시 답하기와 답변 버전 (#140)"
PREVIOUS_HEADING = "### 수정 성공 뒤 초점 복원 (#200)"
SECTION_HEADING = "### 다시 답하기 뒤 초점 복원 (#203)"
LATER_HEADING = "## 학사일정 월 달력 보기 (#143)"

RULE_LINES = {
    "복원 대상": "- 대상: 다시 답하기를 누른 그 문답의 버튼이다. "
             "성공하면 「다시 답하기」, 최종 실패하면 이름이 바뀐 같은 버튼 「다시 시도」다.",
    "기록 시작 조건": "- 복원 기록: 초점이 「다시 답하기」나 「다시 시도」 버튼에 있는 채로 요청을 시작했을 때만 남긴다. "
               "편집 폼의 「저장하고 묻기」 흐름은 #200 규칙을 그대로 따른다.",
    "성공·실패": "- 성공·실패: 성공하면 같은 문답의 「다시 답하기」로, 최종 실패하면 「다시 시도」로 초점을 돌려준다. "
             "「다시 시도」를 눌렀을 때도 같은 규칙을 쓴다.",
    "판정 시점": "- 판정 시점: 응답 콜백이 버전을 고르거나 답을 다시 그리기 전에 한 번만 판정한다. "
             "현재 대화가 그 문답의 대화이고, 요청을 시작한 뒤 그 대화를 다시 열지 않았고, 문답이 화면에 붙어 있고, "
             "초점이 문서 본문에 있을 때만 기록이 남는다.",
    "1회 제한": "- 1회 제한: 버튼이 풀린 첫 조작 줄 갱신에서 기록을 지우고 초점을 한 번 준다. 조건이 맞지 않으면 기록만 지운다. "
              "그 뒤 언어나 테마를 바꿔 조작 줄을 다시 그려도 초점을 다시 가져가지 않는다.",
    "바깥 초점": "- 바깥 초점: 대기 중에 질문 입력창처럼 응답 뒤에도 켜져 있는 요소로 옮긴 초점은 그 자리에 둔다. "
             "사이드바 대화 열기 버튼이나 이전 답의 출처 링크에 있던 초점은 판정 때 본문에 있지 않아 기록이 남지 않으므로, "
             "응답 처리가 그 요소를 지워 본문으로 떨어져도 버튼으로 가져오지 않는다.",
    "제외": "- 제외: 정지, 다른 대화로 옮기기, 늦게 도착해 버리는 응답에서는 초점을 돌려주지 않는다. "
          "나중에 그 대화로 돌아와도 마찬가지다.",
    "저장 규칙": "- 저장: 성공하면 질문과 답 버전 한 쌍을 더한다. 실패하거나 정지하면 질문, 답, 선택 번호, 저장 기록을 그대로 둔다.",
    "전역 감시 없음": "- 전역 초점 감시나 타이머는 두지 않는다. 서버 API, 기록 저장 형식, 스타일은 바꾸지 않는다.",
    "남는 한계": "- 남는 한계: 대기 중에 다른 이유로 문서 본문까지 떨어진 초점은 콜백 시점에 따로 구분하지 않는다. "
             "그런 초점도 판정 때 본문에 있으면 버튼으로 돌아온다. 반대로 대기 중에 사이드바에서 지금 대화를 다시 열면, "
             "목록을 다시 그리며 초점이 본문으로 떨어져도 화면 전환으로 보고 버튼으로 돌려주지 않는다.",
}

# #200 절의 제외 줄. 예전 문장(OLD)은 다시 답하기 복원 전체를 막는 것으로 읽혀 남아 있으면 안 된다.
PREVIOUS_RULE = (
    "- 실패와 정지에서는 수정 버튼으로 돌려주지 않는다. 「다시 답하기」도 수정 버튼으로는 돌려주지 않는다. "
    "이 제외는 수정 버튼 규칙에만 해당하고, 다시 답하기 버튼의 복원은 아래 「다시 답하기 뒤 초점 복원 (#203)」 절을 따른다. "
    "새 요청을 시작하거나 실패·정지를 받으면 기록을 지운다. 실패 뒤 초안 유지 같은 기존 동작은 그대로다."
)
# 목록 기호 없이 문단에 남아도 잡도록 문장만 둔다. 문서 어디에 남아 있어도 실패한다.
OLD_PREVIOUS_RULE = "실패, 정지, 「다시 답하기」에서는 돌려주지 않는다."


def section_bounds(lines, marks, heading):
    """(시작 줄, 끝 줄) 또는 None. 제목은 숨지 않은 줄 가운데 정확히 한 번 있어야 한다.

    끝은 시작 제목 뒤 첫 제목이다. 단계와 상관없이 끊어야 `####` 하위 절로 옮긴 규칙을 이 절 것으로 세지 않는다.
    """
    starts = [index for index, _ in marks if lines[index] == heading]
    if len(starts) != 1:
        return None
    start = starts[0]
    end = next((index for index, _ in marks if index > start), len(lines))
    return start, end


def visible_body(lines, hidden, bounds):
    start, end = bounds
    return [lines[index] for index in range(start + 1, end) if index not in hidden]


def regenerate_doc_problems(notes):
    lines = split_lines(notes)
    fenced, html = block_lines(lines)
    hidden = fenced | html
    marks = headings(lines, hidden)
    bounds = section_bounds(lines, marks, SECTION_HEADING)
    if bounds is None:
        return [f"코드 블록·HTML 밖에 {SECTION_HEADING!r} 제목이 한 번 있어야 한다."]
    start = bounds[0]
    before = [(index, level) for index, level in marks if index < start]
    parent = next((index for index, level in reversed(before) if level <= 2), None)
    if parent is None or lines[parent] != PARENT_HEADING:
        return [f"{SECTION_HEADING!r}는 {PARENT_HEADING!r} 장 안에 있어야 한다."]
    sibling = next((index for index, level in reversed(before) if level <= 3), None)
    if sibling is None or lines[sibling] != PREVIOUS_HEADING:
        return [f"{SECTION_HEADING!r}는 {PREVIOUS_HEADING!r} 바로 다음 절이어야 한다."]
    problems = []
    body = visible_body(lines, hidden, bounds)
    problems += [f"#203 절에 {case} 규칙 줄이 그대로 없다." for case, line in RULE_LINES.items() if line not in body]
    previous = visible_body(lines, hidden, section_bounds(lines, marks, PREVIOUS_HEADING))
    if PREVIOUS_RULE not in previous:
        problems.append("#200 절의 제외 줄이 수정 버튼 규칙에만 해당한다는 문장이 아니다.")
    if OLD_PREVIOUS_RULE in notes:
        problems.append("문서에 다시 답하기 전체를 제외하는 #200 예전 문장이 남아 있다.")
    return problems


class RegenerateFocusDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        start = cls.notes.index(SECTION_HEADING + "\n")
        cls.section = cls.notes[start : cls.notes.index("\n" + LATER_HEADING, start) + 1]
        rules = list(RULE_LINES.values())
        cls.emptied = cls.section
        for line in rules:
            cls.emptied = cls.emptied.replace(line, "- 가상 글")
        cls.rules_text = "\n".join(rules)

    def replace(self, old, new, text=None):
        source = self.notes if text is None else text
        modified = source.replace(old, new, 1)
        self.assertNotEqual(modified, source)
        return modified

    def in_section(self, old, new):
        """#203 절 안에서만 바꾼다. 「전역 초점 감시…」 줄처럼 #200 절에 같은 줄이 먼저 있을 수 있다."""
        self.assertIn(old, self.section)
        return self.replace(self.section, self.section.replace(old, new, 1))

    def test_section_has_rules(self):
        self.assertEqual(regenerate_doc_problems(self.notes), [])

    def test_section_sits_after_history_limit_range(self):
        # #140~#170 문법 제한 구간은 #170 절 끝(「### 검사」)까지다. 새 절은 그 뒤, #200 절 뒤에 있다.
        order = [self.notes.index(heading) for heading in (
            PARENT_HEADING, "### 기록 40개 한도와 차례 단위 자르기 (#170)", "### 검사\n\n- `test_chat_versions_style.py`",
            PREVIOUS_HEADING, SECTION_HEADING, LATER_HEADING)]
        self.assertEqual(order, sorted(order))

    def test_each_rule_is_checked(self):
        for case, line in RULE_LINES.items():
            with self.subTest(case=case):
                self.assertTrue(regenerate_doc_problems(self.in_section(line, "- 가상 글")))

    def test_changed_conditions_fail(self):
        changes = {
            "성공만 복원": ("최종 실패하면 「다시 시도」로 초점을 돌려준다.", "실패하면 돌려주지 않는다."),
            "판정 시점 뒤로": ("답을 다시 그리기 전에 한 번만", "답을 다시 그린 뒤에 한 번만"),
            "초점 조건 삭제": ("문답이 화면에 붙어 있고, 초점이 문서 본문에 있을 때만", "문답이 화면에 붙어 있을 때만"),
            "1회 제한 풀림": ("초점을 다시 가져가지 않는다.", "초점을 다시 가져간다."),
            "정지 복원": ("- 제외: 정지, 다른 대화로 옮기기", "- 제외: 다른 대화로 옮기기"),
            "실패 때 저장": ("실패하거나 정지하면 질문, 답, 선택 번호, 저장 기록을 그대로 둔다.", "실패하면 버전을 더한다."),
            "단서 추가": ("- 전역 초점 감시나 타이머는 두지 않는다.", "- 전역 초점 감시나 타이머는 두지 않는다. 단, 실패 때는 타이머를 둔다."),
            "규칙 줄 쪼갬": ("남긴다. 편집 폼의", "남긴다.\n- 편집 폼의"),
        }
        for case, (old, new) in changes.items():
            with self.subTest(case=case):
                self.assertTrue(regenerate_doc_problems(self.in_section(old, new)))

    def test_rules_only_outside_the_section_fail(self):
        emptied = self.replace(self.section, self.emptied)
        cases = {
            "앞 절(#200)": self.replace(PREVIOUS_HEADING, f"{PREVIOUS_HEADING}\n\n{self.rules_text}", emptied),
            "다음 장(#143)": self.replace(LATER_HEADING, f"{LATER_HEADING}\n\n{self.rules_text}", emptied),
            "절 안 새 제목 뒤": self.replace(self.section, f"{self.emptied}### 다른 절\n\n{self.rules_text}\n\n"),
            "절 안 코드 블록": self.replace(self.section, f"{self.emptied}\n```text\n{self.rules_text}\n```\n\n"),
            "절 안 주석": self.replace(self.section, f"{self.emptied}\n<!--\n{self.rules_text}\n-->\n\n"),
            "들여쓴 목록 줄": self.replace(self.section, self.section.replace("\n- ", "\n    - ")),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(regenerate_doc_problems(modified))

    def test_rule_moved_to_subsection_fails(self):
        # 교차 검토 재현: 규칙 줄을 #143 직전의 `####` 하위 절로 옮긴다.
        for case, line in RULE_LINES.items():
            with self.subTest(case=case):
                moved = self.in_section(line, "- 가상 글")
                moved = self.replace("\n" + LATER_HEADING, f"\n#### 가상 하위 절\n\n{line}\n\n{LATER_HEADING}", moved)
                self.assertTrue(regenerate_doc_problems(moved))

    def test_old_exclusion_left_as_paragraph_fails(self):
        # 교차 검토 재현: 새 제외 줄은 두고 옛 문장을 목록 기호 없는 문단으로 #200 절에 남긴다.
        modified = self.replace(PREVIOUS_RULE, f"{PREVIOUS_RULE}\n\n{OLD_PREVIOUS_RULE}")
        self.assertTrue(regenerate_doc_problems(modified))

    def test_heading_hidden_moved_or_duplicated_fails(self):
        cases = {
            "삭제": self.replace(SECTION_HEADING, "### 다른 제목"),
            "중복": self.replace(SECTION_HEADING, f"{SECTION_HEADING}\n\n{SECTION_HEADING}"),
            "4단계로 내림": self.replace(SECTION_HEADING, "#" + SECTION_HEADING),
            "코드 블록 안 제목": self.replace(SECTION_HEADING, f"### 다른 절\n\n```\n{SECTION_HEADING}\n```"),
            "주석 안 제목": self.replace(SECTION_HEADING, f"### 다른 절\n\n<!--\n{SECTION_HEADING}\n-->"),
            "사이에 낀 절": self.replace(SECTION_HEADING, f"### 다른 절\n\n가상 글\n\n{SECTION_HEADING}"),
            "사이에 낀 장": self.replace(SECTION_HEADING, f"## 다른 장\n\n가상 글\n\n{SECTION_HEADING}"),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(regenerate_doc_problems(modified))

    def test_previous_exclusion_is_scoped_to_edit_button(self):
        cases = {
            "예전 문장으로 되돌림": self.replace(PREVIOUS_RULE, OLD_PREVIOUS_RULE + " 새 요청을 시작하거나 실패·정지를 받으면 기록을 지운다."),
            "예전 문장 덧붙임": self.replace(PREVIOUS_RULE, f"{PREVIOUS_RULE}\n{OLD_PREVIOUS_RULE}"),
            "새 문장을 #203 절로 옮김": self.replace(
                SECTION_HEADING + "\n", f"{SECTION_HEADING}\n\n{PREVIOUS_RULE}\n",
                self.replace(PREVIOUS_RULE, OLD_PREVIOUS_RULE)),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                self.assertTrue(regenerate_doc_problems(modified))


if __name__ == "__main__":
    unittest.main()
