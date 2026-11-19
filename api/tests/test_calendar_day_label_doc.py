"""설계 문서의 학사일정 달력 절이 날짜 버튼 이름 형식(#149)을 적었는지 확인한다.

화면(`chat.js`)과 문서는 같은 이슈 표를 보고 따로 고친다. 문서가 예전 형식(날짜 뒤 `· +N개`)을
설명하면 화면을 고치는 사람이 숨긴 막대 수를 이름에 다시 넣을 수 있다. 이 테스트는 이슈 표의
예시 9개(세 언어 × 0·1·3건)를 옮겨 두고, 달력 절에 글자 그대로 한 번씩 있는지 본다.

표준 라이브러리만 쓰고 `web/docs/UI_NOTES.md` 하나만 읽는다. 일정은 모두 가상이다.

실행(저장소 루트):
    python -B -m unittest api.tests.test_calendar_day_label_doc
"""

import re
import unittest
from pathlib import Path

UI_NOTES = Path(__file__).resolve().parents[2] / "web" / "docs" / "UI_NOTES.md"
SECTION_HEADING = "## 학사일정 월 달력 보기 (#143)"
DOT = "·"  # 가운뎃점. 화면 문구와 같은 글자다.

# 이슈 #149의 표. 가상 일정 3건(2028-02-26 기준)에서 29일 0건, 28일 1건, 27일 3건이다.
EXAMPLES = {
    "ko": (
        f"2028년 2월 29일 {DOT} 일정 0건",
        f"2028년 2월 28일 {DOT} 일정 1건",
        f"2028년 2월 27일 {DOT} 일정 3건",
    ),
    "en": (
        f"February 29 2028 {DOT} 0 events",
        f"February 28 2028 {DOT} 1 event",
        f"February 27 2028 {DOT} 3 events",
    ),
    "zh": (
        f"2028年2月29日 {DOT} 0项日程",
        f"2028年2月28日 {DOT} 1项日程",
        f"2028年2月27日 {DOT} 3项日程",
    ),
}


def calendar_section(text):
    """달력 절 머리부터 다음 `## ` 머리 앞(없으면 끝)까지를 돌려준다."""
    start = text.index(SECTION_HEADING)
    following = re.search(r"^## ", text[start + len(SECTION_HEADING):], re.MULTILINE)
    end = len(text) if following is None else start + len(SECTION_HEADING) + following.start()
    return text[start:end]


def count_whole(section, example):
    """앞뒤에 영문자·숫자가 붙지 않은 경우를 모두 센다.

    괄호·마침표·한글 조사 같은 문장부호나 글자가 붙어도 중복으로 센다. 영문자·숫자만 빼는 까닭은
    `1 event`를 `1 events` 안에서, `2028년 2월 2일`을 `2028년 2월 29일` 안에서 세지 않기 위해서다.
    """
    return len(re.findall(r"(?<![0-9A-Za-z])" + re.escape(example) + r"(?![0-9A-Za-z])", section))


class CountWholeTest(unittest.TestCase):
    """경계 판정 자체를 가상 문장으로 확인한다. 교차 검토에서 문장부호에 붙은 중복을 놓쳤다."""

    def test_counts_duplicates_attached_to_punctuation(self):
        example = f"February 28 2028 {DOT} 1 event"
        section = f"| `{example}` |\n- ({example}).\n- {example}, {example}"
        self.assertEqual(count_whole(section, example), 4)

    def test_counts_korean_and_chinese_attached_text(self):
        ko = f"2028년 2월 27일 {DOT} 일정 3건"
        zh = f"2028年2月27日 {DOT} 3项日程"
        self.assertEqual(count_whole(f"「{ko}」이다. {ko}이", ko), 2)
        self.assertEqual(count_whole(f"（{zh}）。", zh), 1)

    def test_longer_neighbours_are_not_counted(self):
        self.assertEqual(count_whole(f"`February 28 2028 {DOT} 1 events`", f"February 28 2028 {DOT} 1 event"), 0)
        self.assertEqual(count_whole(f"`12028년 2월 27일 {DOT} 일정 3건`", f"2028년 2월 27일 {DOT} 일정 3건"), 0)
        self.assertEqual(count_whole(f"`February 28 2028 {DOT} 1 event`", f"February 28 2028 {DOT} 1 event"), 1)


class CalendarDayLabelDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.section = calendar_section(UI_NOTES.read_text(encoding="utf-8"))

    def test_each_example_appears_once_in_the_calendar_section(self):
        for lang, examples in EXAMPLES.items():
            for example in examples:
                with self.subTest(lang=lang, example=example):
                    self.assertEqual(count_whole(self.section, example), 1)

    def test_examples_are_not_written_outside_the_calendar_section(self):
        # 다른 절에 같은 예시를 두면 고칠 때 한쪽만 바뀐다.
        text = UI_NOTES.read_text(encoding="utf-8")
        outside = text.replace(self.section, "")
        for examples in EXAMPLES.values():
            for example in examples:
                with self.subTest(example=example):
                    self.assertNotIn(example, outside)

    def test_name_format_is_stated_on_the_day_button_row(self):
        row = next(line for line in self.section.splitlines() if line.startswith("| `button.acal-day` |"))
        self.assertIn(f"`{{날짜}} {DOT} 일정 N건`", row)
        self.assertIn("aria-label", row)

    def test_visual_more_badge_is_kept_out_of_the_name(self):
        lines = [
            line for line in self.section.splitlines()
            if "+N개" in line and "이름에 넣지 않는다" in line
        ]
        self.assertTrue(lines, "「+N개」를 이름에 넣지 않는다는 문장이 달력 절에 없다")
        self.assertTrue(any("시각용" in line for line in lines), lines)

    def test_count_dots_and_list_share_one_filter(self):
        self.assertRegex(self.section, r"거르는 함수 하나[^\n]*점\(처음 3건\)[^\n]*고른 날 목록[^\n]*이 결과")


if __name__ == "__main__":
    unittest.main()
