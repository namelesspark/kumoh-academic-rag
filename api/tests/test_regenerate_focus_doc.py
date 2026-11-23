"""「다시 답하기 뒤 초점 복원 (#203)」 절에 복원 규칙이 그대로 적혀 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 한 파일만 읽는다. 숨은 줄(최상위 코드 블록·HTML 블록)과
제목 판정은 `test_chat_history_limit_doc.py`의 CommonMark 줄 규칙을 그대로 가져다 쓴다.

- 절은 `## 질문 수정·다시 답하기와 답변 버전 (#140)` 장 안에서 `### 수정 성공 뒤 초점 복원 (#200)` 바로 다음 3단계 절이다.
  끝은 시작 제목 뒤에 나오는 다음 제목이며, 단계와 상관없이 끊는다. 이 절은 #140~#170 문법 제한 구간(#170 절 끝까지) 밖에 있다.
- 규칙 줄은 숨지 않은 줄과 문자열 전체로 비교한다. 문장 일부만 찾으면 조건을 바꾸거나 단서를 붙여도 통과한다.
- #200 절의 제외 줄이 수정 버튼 규칙에만 해당한다고 고친 문장인지도 같은 방식으로 본다.
- 다시 답하기 성공·최종 실패 뒤 사이드바 대화 열기 버튼의 초점을 지키는 규칙(#209)도 규칙 줄로 본다.
  그 전의 「가져오지 않는다」 사이드바 문장은 문서 어디에 남아 있어도(코드 블록·주석 포함) 실패한다.
  옛 문장은 공백과 줄바꿈을 한 칸으로 줄여 찾으므로 문단 안에서 줄을 나눠도 잡는다.
- 「사이드바 초점」 줄은 #212 보관함 조건까지 본다.
  「보관함이 펼쳐져 있으면 보관함 안 대화 열기 버튼도 같은 규칙을 따르고, 접힌 보관함은 버튼이 숨어 있어 대상이 아니다.」
- 질문 수정도 사이드바 규칙의 대상이다(#215). #203 절은 「사이드바 초점」 줄과 검사 문단의 다시 답하기·질문 수정 사이드바 경로 줄을, #200 절은
  편집 폼 밖 초점을 수정 버튼으로 옮기지 않는다는 줄, 수정 버튼 복원과 사이드바 초점 유지의 적용 시점 줄,
  대화 열기 버튼이 새 버튼으로 바뀐다는 줄을 숨지 않은 줄과 문자열 전체로 본다.
  #200 절의 끝은 다음 제목(#203 절 제목)이다. 질문 수정을 사이드바 규칙에서 빼던 옛 문장(OLD_EDIT_EXCLUSIONS)은
  옛 사이드바 문장과 같이 공백을 줄여 문서 전체(코드 블록·주석 포함)에서 찾는다.
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
             "이전 답의 출처 링크에 있던 초점은 판정 때 본문에 있지 않아 기록이 남지 않으므로, "
             "답을 바꿔 그리며 링크가 사라져 본문으로 떨어져도 다시 답하기 버튼으로 가져오지 않는다.",
    "사이드바 초점": "- 사이드바 초점: 다시 답하기나 질문 수정이 성공하거나(스트림, JSON 대체 응답) 최종 실패해 대화 목록을 다시 그릴 때, "
               "초점이 대화 열기 버튼(`.conversation-open`)에 있으면 그 대화 ID를 기억했다가 "
               "사이드바가 보이고 같은 ID의 새 버튼이 있을 때 `preventScroll`로 초점을 준다. "
               "목록 순서가 바뀌어도 ID로 찾고, 버튼을 못 찾으면 입력창이나 새 대화 버튼으로 대신 옮기지 않는다. "
               "보관함이 펼쳐져 있으면 보관함 안 대화 열기 버튼도 같은 규칙을 따르고, "
               "접힌 보관함은 버튼이 숨어 있어 대상이 아니다.",
    "사이드바 예외": "- 사이드바 예외: 정지, 늦게 도착해 버리는 응답, 대기 중에 다른 대화로 옮기거나 대화를 직접 다시 여는 경우, "
               "사이드바가 숨은 경우에는 대화 열기 버튼의 초점을 지키지 않는다. 새 질문 전송과 첫 답의 다시 시도도 대상이 아니다.",
    "제외": "- 제외: 정지, 다른 대화로 옮기기, 늦게 도착해 버리는 응답에서는 초점을 돌려주지 않는다. "
          "나중에 그 대화로 돌아와도 마찬가지다.",
    "저장 규칙": "- 저장: 성공하면 질문과 답 버전 한 쌍을 더한다. 실패하거나 정지하면 질문, 답, 선택 번호, 저장 기록을 그대로 둔다.",
    "전역 감시 없음": "- 전역 초점 감시나 타이머는 두지 않는다. 서버 API, 기록 저장 형식, 스타일은 바꾸지 않는다.",
    "남는 한계": "- 남는 한계: 대기 중에 다른 이유로 문서 본문까지 떨어진 초점은 콜백 시점에 따로 구분하지 않는다. "
             "그런 초점도 판정 때 본문에 있으면 버튼으로 돌아온다. 반대로 대기 중에 사이드바에서 지금 대화를 다시 열면, "
             "목록을 다시 그리며 초점이 본문으로 떨어져도 화면 전환으로 보고 버튼으로 돌려주지 않는다.",
    "다시 답하기 검사 문단": "대기 중 대화 열기 버튼으로 옮긴 초점은 가상 대화 여러 개의 시각을 바꿔 목록 순서가 달라진 채로, "
                    "스트림 성공·JSON 대체 성공·최종 실패 뒤 같은 대화 ID의 새 버튼에 남는지 본다. "
                    "보관함을 펼치고 보관한 가상 대화 두 개의 순서를 뒤집은 경우도 같은 세 경로로 본다. "
                    "출처 링크에 있던 초점은 본문으로 떨어지는지도 본다.",
    "검사 문단": "질문 수정도 스트림 성공·JSON 대체 성공·최종 실패 뒤 일반 목록과 펼친 보관함의 같은 대화 ID 새 버튼에 초점이 남는지 본다.",
}

# #200 절에 있어야 하는 줄. 수정 버튼 복원과 사이드바 초점 유지가 각각 언제 쓰이는지 적는다.
# 「편집 폼 밖 초점」 줄은 폼 안 초점만 기록하는 chat.js의 수정 버튼 복원 조건과 맞아야 한다.
PREVIOUS_SIDEBAR_LINES = {
    "편집 폼 밖 초점": "- 이 규칙은 성공 직전까지 편집 폼 밖에 있는 초점을 수정 버튼으로 옮기지 않는다. "
                 "질문 입력창처럼 응답 뒤에도 남아 있고 켜져 있는 요소에 있으면 그 자리에 머문다.",
    "사이드바 적용 시점": "- 사이드바 초점: 「수정」 버튼 복원은 성공 직전 편집 폼이 초점을 품고 있을 때만 쓴다. "
             "사이드바 대화 열기 버튼 초점 유지는 질문 수정이 성공하거나(스트림, JSON 대체 응답) 최종 실패해 "
             "대화 목록을 다시 그릴 때 초점이 대화 열기 버튼에 있으면 쓰고, "
             "조건과 예외는 아래 #203 절의 「사이드바 초점」·「사이드바 예외」 줄과 같다.",
    "사이드바 새 버튼": "  사이드바 대화 열기 버튼은 목록을 다시 그릴 때 새 버튼으로 바뀌고, "
            "초점은 아래 「사이드바 초점」 줄에 따라 같은 대화의 새 버튼으로 옮긴다.",
}

# #215 전에 질문 수정을 사이드바 규칙에서 빼던 문장들. 문서 어디에 남아도 실패한다.
OLD_EDIT_EXCLUSIONS = {
    "#200 사라짐": "사이드바 대화 목록의 대화 열기 버튼은 목록을 다시 그릴 때, "
                "같은 문답의 이전 답 안 출처 링크는 답을 바꿔 그릴 때 사라진다.",
    "#203 예외": "질문 수정(#200) 흐름에서는 대화 열기 버튼의 초점을 지키지 않는다.",
    "#203 한계": "질문 수정 중 대화 열기 버튼에 둔 초점도 목록을 다시 그릴 때 본문으로 떨어진다.",
    "#203 검사": "질문 수정 중 대화 열기 버튼의 초점은 #200 규칙 그대로인지도 본다.",
}

# #209 전 「바깥 초점」 줄의 사이드바 문장. 다시 답하기 뒤 사이드바 초점을 지키는 새 규칙과 어긋나므로
# 목록 기호 없는 문단이나 코드 블록, 다른 절에 남아도 문서 어디에서든 실패한다.
OLD_SIDEBAR_RULE = (
    "사이드바 대화 열기 버튼이나 이전 답의 출처 링크에 있던 초점은 판정 때 본문에 있지 않아 기록이 남지 않으므로, "
    "응답 처리가 그 요소를 지워 본문으로 떨어져도 버튼으로 가져오지 않는다."
)

# #200 절의 제외 줄. 예전 문장(OLD)은 다시 답하기 복원 전체를 막는 것으로 읽혀 남아 있으면 안 된다.
PREVIOUS_RULE = (
    "- 실패와 정지에서는 수정 버튼으로 돌려주지 않는다. 「다시 답하기」도 수정 버튼으로는 돌려주지 않는다. "
    "이 제외는 수정 버튼 규칙에만 해당하고, 다시 답하기 버튼의 복원은 아래 「다시 답하기 뒤 초점 복원 (#203)」 절을 따른다. "
    "새 요청을 시작하거나 실패·정지를 받으면 기록을 지운다. 실패 뒤 초안 유지 같은 기존 동작은 그대로다."
)
# 목록 기호 없이 문단에 남아도 잡도록 문장만 둔다. 문서 어디에 남아 있어도 실패한다.
OLD_PREVIOUS_RULE = "실패, 정지, 「다시 답하기」에서는 돌려주지 않는다."


def squeeze(text):
    return " ".join(text.split())


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
    # #200 제목은 위에서 바로 앞 3단계 절로 확인했으므로 한 번만 있다. 끝은 다음 제목, 곧 #203 제목이다.
    previous = visible_body(lines, hidden, section_bounds(lines, marks, PREVIOUS_HEADING))
    if PREVIOUS_RULE not in previous:
        problems.append("#200 절의 제외 줄이 수정 버튼 규칙에만 해당한다는 문장이 아니다.")
    problems += [f"#200 절에 {case} 줄이 그대로 없다."
                 for case, line in PREVIOUS_SIDEBAR_LINES.items() if line not in previous]
    # 문단 안 줄바꿈은 화면에서 공백 하나로 보이므로, 공백과 줄바꿈을 한 칸으로 줄인 뒤 옛 문장을 찾는다.
    flat = squeeze(notes)
    if squeeze(OLD_PREVIOUS_RULE) in flat:
        problems.append("문서에 다시 답하기 전체를 제외하는 #200 예전 문장이 남아 있다.")
    if squeeze(OLD_SIDEBAR_RULE) in flat:
        problems.append("문서에 사이드바 초점을 가져오지 않는다는 #203 예전 문장이 남아 있다.")
    problems += [f"문서에 질문 수정을 사이드바 규칙에서 빼던 {case} 옛 문장이 남아 있다."
                 for case, line in OLD_EDIT_EXCLUSIONS.items() if squeeze(line) in flat]
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
        previous_start = cls.notes.index(PREVIOUS_HEADING + "\n")
        cls.previous_section = cls.notes[previous_start : cls.notes.index(SECTION_HEADING + "\n", previous_start)]

    def replace(self, old, new, text=None):
        source = self.notes if text is None else text
        modified = source.replace(old, new, 1)
        self.assertNotEqual(modified, source)
        return modified

    def in_section(self, old, new):
        """#203 절 안에서만 바꾼다. 「전역 초점 감시…」 줄처럼 #200 절에 같은 줄이 먼저 있을 수 있다."""
        self.assertIn(old, self.section)
        return self.replace(self.section, self.section.replace(old, new, 1))

    def in_previous(self, old, new):
        """#200 절 안에서만 바꾼다."""
        self.assertIn(old, self.previous_section)
        return self.replace(self.previous_section, self.previous_section.replace(old, new, 1))

    def test_previous_sidebar_lines_are_checked(self):
        for case, line in PREVIOUS_SIDEBAR_LINES.items():
            with self.subTest(case=case):
                self.assertIn(f"#200 절에 {case} 줄이 그대로 없다.",
                              regenerate_doc_problems(self.in_previous(line, "- 가상 글")))

    def test_previous_sidebar_conditions_changed_fail(self):
        changes = {
            # 교차 검토 재현: 폼 밖 초점도 수정 버튼으로 옮긴다고 뒤집으면 chat.js의 기록 조건과 어긋난다.
            "폼 밖 초점 이동으로 뒤집음": ("편집 폼 밖에 있는 초점을 수정 버튼으로 옮기지 않는다.",
                                 "편집 폼 밖에 있는 초점을 수정 버튼으로 옮긴다."),
            "입력창 초점 유지 삭제": (" 질문 입력창처럼 응답 뒤에도 남아 있고 켜져 있는 요소에 있으면 그 자리에 머문다.", ""),
            "수정 버튼 조건 삭제": ("「수정」 버튼 복원은 성공 직전 편집 폼이 초점을 품고 있을 때만 쓴다. ", ""),
            "실패 조건 삭제": ("성공하거나(스트림, JSON 대체 응답) 최종 실패해 대화 목록", "성공해 대화 목록"),
            "예외 연결 삭제": ("·「사이드바 예외」 줄과", " 줄과"),
            "새 버튼 대신 사라짐": ("새 버튼으로 바뀌고, 초점은 아래 「사이드바 초점」 줄에 따라 같은 대화의 새 버튼으로 옮긴다.",
                            "사라진다."),
        }
        for case, (old, new) in changes.items():
            with self.subTest(case=case):
                self.assertTrue(regenerate_doc_problems(self.in_previous(old, new)))

    def test_previous_sidebar_lines_moved_out_fail(self):
        # 교차 검토 재현: #200 절의 사이드바 줄을 지우고 이웃 절·하위 절·코드 블록·주석에만 둔다.
        for case, line in PREVIOUS_SIDEBAR_LINES.items():
            emptied = self.in_previous(line, "- 가상 글")
            places = {
                "#203 절": self.replace(SECTION_HEADING + "\n", f"{SECTION_HEADING}\n\n{line}\n", emptied),
                "#200 하위 절": self.replace(SECTION_HEADING, f"#### 가상 하위 절\n\n{line}\n\n{SECTION_HEADING}", emptied),
                "#200 코드 블록": self.replace(SECTION_HEADING, f"```text\n{line}\n```\n\n{SECTION_HEADING}", emptied),
                "#200 주석": self.replace(SECTION_HEADING, f"<!--\n{line}\n-->\n\n{SECTION_HEADING}", emptied),
            }
            for place, modified in places.items():
                with self.subTest(case=case, place=place):
                    self.assertIn(f"#200 절에 {case} 줄이 그대로 없다.", regenerate_doc_problems(modified))

    def test_old_edit_exclusion_anywhere_fails(self):
        # 새 규칙 줄은 모두 두고, 질문 수정을 빼던 옛 문장을 여러 자리에 남긴다.
        for case, line in OLD_EDIT_EXCLUSIONS.items():
            places = {
                "#200 절 문단": self.replace(PREVIOUS_RULE, f"{PREVIOUS_RULE}\n\n{line}"),
                "#203 절 목록 줄": self.in_section(RULE_LINES["사이드바 예외"], f"{RULE_LINES['사이드바 예외']}\n- {line}"),
                "다음 장 코드 블록": self.replace(LATER_HEADING, f"{LATER_HEADING}\n\n```text\n{line}\n```"),
                "주석": self.replace(LATER_HEADING, f"<!--\n{line}\n-->\n\n{LATER_HEADING}"),
                "줄 나눈 문단": self.replace(LATER_HEADING, LATER_HEADING + "\n\n" + line.replace(" ", "\n", 1)),
            }
            for place, modified in places.items():
                with self.subTest(case=case, place=place):
                    self.assertIn(f"문서에 질문 수정을 사이드바 규칙에서 빼던 {case} 옛 문장이 남아 있다.",
                                  regenerate_doc_problems(modified))

    def test_old_edit_exception_line_restored_fails(self):
        # 「사이드바 예외」·「남는 한계」 줄을 #215 전 문장으로 되돌린다.
        old_exception = ("- 사이드바 예외: 정지, 늦게 도착해 버리는 응답, 대기 중에 대화를 직접 다시 여는 경우, "
                         + OLD_EDIT_EXCLUSIONS["#203 예외"])
        modified = self.in_section(RULE_LINES["사이드바 예외"], old_exception)
        modified = self.replace(RULE_LINES["남는 한계"], f"{RULE_LINES['남는 한계']} {OLD_EDIT_EXCLUSIONS['#203 한계']}",
                                modified)
        problems = regenerate_doc_problems(modified)
        for case in ("사이드바 예외", "남는 한계"):
            self.assertIn(f"#203 절에 {case} 규칙 줄이 그대로 없다.", problems)
        for case in ("#203 예외", "#203 한계"):
            self.assertIn(f"문서에 질문 수정을 사이드바 규칙에서 빼던 {case} 옛 문장이 남아 있다.", problems)

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
            "사이드바 성공 조건 삭제": ("질문 수정이 성공하거나(스트림, JSON 대체 응답) 최종 실패해", "질문 수정이 최종 실패해"),
            "사이드바 실패 조건 삭제": ("성공하거나(스트림, JSON 대체 응답) 최종 실패해", "성공해"),
            "사이드바 JSON 대체 삭제": ("(스트림, JSON 대체 응답)", "(스트림)"),
            "사이드바 대체 이동 허용": ("입력창이나 새 대화 버튼으로 대신 옮기지 않는다.", "입력창으로 옮긴다."),
            "사이드바 수정 흐름 빠짐": ("다시 답하기나 질문 수정이 성공하거나", "다시 답하기가 성공하거나"),
            "사이드바 수정 예외 되살림": ("사이드바가 숨은 경우에는", "사이드바가 숨은 경우, 질문 수정 흐름에서는"),
            "사이드바 숨김 예외 삭제": (" 사이드바가 숨은 경우에는", "에는"),
            "검사 문단 보관함 삭제": ("일반 목록과 펼친 보관함의", "일반 목록의"),
            # 교차 검토 재현: 질문 수정 검사 줄의 경로를 바꾸거나 앞 줄을 가리키는 말로 되돌린다.
            "검사 문단 실패를 정지로": ("질문 수정도 스트림 성공·JSON 대체 성공·최종 실패 뒤",
                                "질문 수정도 스트림 성공·JSON 대체 성공·정지 뒤"),
            "검사 문단 대체 경로 삭제": ("질문 수정도 스트림 성공·JSON 대체 성공·최종 실패 뒤", "질문 수정도 스트림 성공·최종 실패 뒤"),
            # 교차 검토 재현: 다시 답하기 사이드바 검사 줄의 경로를 바꾸면 보관함의 「같은 세 경로」도 함께 바뀐다.
            "다시 답하기 검사 실패를 정지로": ("목록 순서가 달라진 채로, 스트림 성공·JSON 대체 성공·최종 실패 뒤",
                                    "목록 순서가 달라진 채로, 스트림 성공·JSON 대체 성공·정지 뒤"),
            "다시 답하기 검사 대체 경로 삭제": ("목록 순서가 달라진 채로, 스트림 성공·JSON 대체 성공·최종 실패 뒤",
                                     "목록 순서가 달라진 채로, 스트림 성공·최종 실패 뒤"),
            "다시 답하기 검사 보관함 삭제": (" 보관함을 펼치고 보관한 가상 대화 두 개의 순서를 뒤집은 경우도 같은 세 경로로 본다.", ""),
            "검사 문단 앞 줄 참조": ("질문 수정도 스트림 성공·JSON 대체 성공·최종 실패 뒤", "질문 수정도 같은 세 경로에서"),
            "보관함 조건 삭제": (" 보관함이 펼쳐져 있으면 보관함 안 대화 열기 버튼도 같은 규칙을 따르고, "
                           "접힌 보관함은 버튼이 숨어 있어 대상이 아니다.", ""),
            "접힌 보관함 포함": ("접힌 보관함은 버튼이 숨어 있어 대상이 아니다.", "접힌 보관함도 같은 규칙을 따른다."),
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
        split = self.replace(PREVIOUS_RULE, PREVIOUS_RULE + "\n\n" + OLD_PREVIOUS_RULE.replace(", ", ",\n", 1))
        self.assertIn("문서에 다시 답하기 전체를 제외하는 #200 예전 문장이 남아 있다.", regenerate_doc_problems(split))

    def test_old_sidebar_sentence_anywhere_fails(self):
        # 새 규칙 줄은 모두 두고 #209 전 사이드바 문장만 여러 자리에 남긴다.
        cases = {
            "#203 절 문단": self.in_section(RULE_LINES["사이드바 예외"],
                                         f"{RULE_LINES['사이드바 예외']}\n\n{OLD_SIDEBAR_RULE}"),
            "#203 절 목록 줄": self.in_section(RULE_LINES["사이드바 예외"],
                                          f"{RULE_LINES['사이드바 예외']}\n- {OLD_SIDEBAR_RULE}"),
            "#200 절 문단": self.replace(PREVIOUS_RULE, f"{PREVIOUS_RULE}\n\n{OLD_SIDEBAR_RULE}"),
            "다음 장 코드 블록": self.replace(LATER_HEADING, f"{LATER_HEADING}\n\n```text\n{OLD_SIDEBAR_RULE}\n```"),
            "주석": self.replace(LATER_HEADING, f"<!--\n{OLD_SIDEBAR_RULE}\n-->\n\n{LATER_HEADING}"),
            # 교차 검토 재현: #143 제목 아래 문단에서 쉼표 뒤 공백을 줄바꿈으로 바꾼다.
            "다음 장 줄 나눈 문단": self.replace(
                LATER_HEADING, LATER_HEADING + "\n\n" + OLD_SIDEBAR_RULE.replace(", ", ",\n", 1)),
        }
        for case, modified in cases.items():
            with self.subTest(case=case):
                problems = regenerate_doc_problems(modified)
                self.assertIn("문서에 사이드바 초점을 가져오지 않는다는 #203 예전 문장이 남아 있다.", problems)

    def test_old_outside_focus_line_restored_fails(self):
        # 「바깥 초점」 줄을 #209 전 문장으로 되돌리고 사이드바 두 줄을 지운다.
        old_line = ("- 바깥 초점: 대기 중에 질문 입력창처럼 응답 뒤에도 켜져 있는 요소로 옮긴 초점은 그 자리에 둔다. "
                    + OLD_SIDEBAR_RULE)
        modified = self.in_section(RULE_LINES["바깥 초점"], old_line)
        for case in ("사이드바 초점", "사이드바 예외"):
            modified = self.replace(RULE_LINES[case] + "\n", "", modified)
        problems = regenerate_doc_problems(modified)
        for case in ("바깥 초점", "사이드바 초점", "사이드바 예외"):
            self.assertIn(f"#203 절에 {case} 규칙 줄이 그대로 없다.", problems)
        self.assertIn("문서에 사이드바 초점을 가져오지 않는다는 #203 예전 문장이 남아 있다.", problems)

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
