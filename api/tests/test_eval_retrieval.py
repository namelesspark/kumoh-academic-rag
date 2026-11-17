"""검색 적중률 평가 도구(`api/scripts/eval_retrieval.py`)를 가상 규정으로 확인한다.

실제 규정 목록 대신 저장소의 가상 목록 파일과 메모리에 둔 가상 규정을 쓴다. 파일은 읽기만
하고, 서버와 AI는 부르지 않는다. 모든 문장은 지어낸 것이다.
"""

import io
import json
import unittest
from contextlib import redirect_stderr
from datetime import date
from pathlib import Path
from unittest import mock

from api.regulation_app import build_regulations_retrieval
from api.scripts import eval_retrieval
from api.scripts.eval_retrieval import (
    BUILD_FAILED_TEXT,
    MISSING_TEXT,
    QUESTIONS_FAILED_TEXT,
    QUESTIONS_PATH,
    SEARCH_FAILED_TEXT,
    Expected,
    Question,
    article_number,
    evaluate,
    is_hit,
    load_questions,
    main,
    parse_questions,
    same_document,
)
from api.local_serve import MANIFEST_ENV


FIXTURES = Path(__file__).resolve().parent / "fixtures"
FICTIONAL_MANIFEST = FIXTURES / "fictional_manifest.json"
FICTIONAL_TEXTS = (
    (FIXTURES / "fictional_manifest_first.txt").read_text(encoding="utf-8"),
    (FIXTURES / "fictional_manifest_second.txt").read_text(encoding="utf-8"),
)
# 읽기만 시도하는 없는 경로. 출력에 경로 조각이 실리는지 보려고 눈에 띄는 이름을 쓴다.
MISSING_MANIFEST = FIXTURES / "가상-비밀폴더-없는목록.json"

RULE_RETRY = "제3조(구름 재등록) 가상의 구름학생은 보름날에 구름 재등록을 청한다."
RULE_FOG = "제33조(안개 산책) 가상의 안개정원은 새벽에 연다."
GUIDE_RETRY = "제5조(구름 재등록 허가) 가상의 구름 재등록은 별지기가 허가한다."
RULES = {
    "source": f"가상 별빛 학칙\n\n{RULE_RETRY}\n{RULE_FOG}\n",
    "document_title": "가상 별빛 학칙 제9차",
    "effective_date": date(2099, 4, 5),
    "source_url": "https://example.invalid/regulations/starlight",
}
GUIDE = {
    "source": f"가상 별빛 운영 규정\n\n{GUIDE_RETRY}\n",
    "document_title": "가상 별빛 운영 규정",
    "effective_date": date(2099, 4, 6),
    "source_url": "https://example.invalid/regulations/starlight-guide",
}


def run_main(**kwargs):
    out = io.StringIO()
    err = io.StringIO()
    with redirect_stderr(err):
        code = main(out=out, **kwargs)
    return code, out.getvalue(), err.getvalue()


class QuestionFileTests(unittest.TestCase):
    def test_question_file_has_eleven_questions_with_expected_lists(self):
        questions = load_questions()

        self.assertEqual(len(questions), 11)
        for item in questions:
            with self.subTest(question=item.question):
                self.assertTrue(item.expected)
                for expected in item.expected:
                    self.assertIsNotNone(article_number(expected.article))
                    self.assertEqual(article_number(expected.article), expected.article)

    def test_question_file_holds_only_names_and_article_numbers(self):
        data = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
        for entry in data:
            with self.subTest(question=entry["question"]):
                self.assertEqual(set(entry), {"question", "expected"})
                for expected in entry["expected"]:
                    self.assertEqual(set(expected), {"document", "article"})
                    self.assertLessEqual(len(expected["document"]), 20)

    def test_questions_with_two_accepted_articles(self):
        by_question = {item.question: item.expected for item in load_questions()}

        self.assertEqual(
            by_question["재입학할 수 있나요"],
            (Expected("학칙", "제33조"), Expected("학사운영 규정", "제5조")),
        )
        self.assertEqual(
            by_question["전과는 언제 할 수 있나요"],
            (Expected("학칙", "제49조"), Expected("학사운영 규정", "제19조")),
        )
        self.assertEqual(
            by_question["계절학기는 몇 학점까지 들을 수 있나요"],
            (Expected("학사운영 규정", "제206조"),),
        )

    def test_malformed_question_lists_are_rejected(self):
        good = {"question": "가상 질문", "expected": [{"document": "가상 학칙", "article": "제3조"}]}
        cases = (
            [],
            {"questions": [good]},
            [{"question": "가상 질문"}],
            [{**good, "expected": []}],
            [{**good, "extra": 1}],
            [{**good, "question": " "}],
            [{**good, "expected": [{"document": "가상 학칙", "article": "제3조 ①"}]}],
            [{**good, "expected": [{"document": "가상 학칙", "article": "3조"}]}],
            [{**good, "expected": [{"document": "", "article": "제3조"}]}],
            [{**good, "expected": [{"document": "가상 학칙", "article": "제3조", "text": "본문"}]}],
        )
        for data in cases:
            with self.subTest(data=data):
                with self.assertRaises(eval_retrieval._QuestionsError):
                    parse_questions(data)


class MatchingTests(unittest.TestCase):
    def test_article_number_ignores_paragraph_marks_and_titles(self):
        cases = (
            ("제38조(가상 휴식) ②", "제38조"),
            ("제12조의2(가상 연장)", "제12조의2"),
            ("제３조(전각)", "제3조"),
            ("가상 부칙", None),
        )
        for path, expected in cases:
            with self.subTest(path=path):
                self.assertEqual(article_number(path), expected)

    def test_similar_article_numbers_are_different_articles(self):
        top = [("가상 학칙", "제33조"), ("가상 학칙", "제12조의2")]

        self.assertFalse(is_hit([Expected("가상 학칙", "제3조")], top))
        self.assertFalse(is_hit([Expected("가상 학칙", "제12조")], top))
        self.assertTrue(is_hit([Expected("가상 학칙", "제33조")], top))
        self.assertTrue(is_hit([Expected("가상 학칙", "제12조의2")], top))

    def test_document_name_matches_except_spacing_and_revision_mark(self):
        for title in ("가상 학칙", "가상 학칙 제9차", "가상 학칙(제9차)", "가상학칙", "가상 학칙 제９차"):
            with self.subTest(title=title):
                self.assertTrue(same_document("가상 학칙", title))
        self.assertTrue(same_document("가상학사 규정", "가상 학사규정"))
        self.assertFalse(same_document("가상 학칙", "가상 운영 규정"))
        self.assertFalse(same_document(" ", "가상 학칙"))
        self.assertFalse(is_hit([Expected("가상 운영 규정", "제3조")], [("가상 학칙", "제3조")]))

    def test_a_title_containing_the_expected_name_is_another_document(self):
        # 검토 지적: 부분 일치로 보면 '학칙'이 '학칙 시행세칙'과도 맞았다.
        for title in ("가상 학칙 시행세칙", "가상 대학원 학칙", "가상 학칙 시행세칙 제9차"):
            with self.subTest(title=title):
                self.assertFalse(same_document("가상 학칙", title))
                self.assertFalse(is_hit([Expected("가상 학칙", "제3조")], [(title, "제3조")]))

    def test_any_expected_article_in_the_top_three_counts(self):
        expected = [Expected("가상 학칙", "제9조"), Expected("가상 운영 규정", "제5조")]

        self.assertTrue(is_hit(expected, [("가상 학칙", "제1조"), ("가상 운영 규정", "제5조")]))
        self.assertFalse(is_hit(expected, [("가상 학칙", "제5조"), ("가상 운영 규정", "제9조")]))
        self.assertFalse(is_hit(expected, []))


class EvaluateTests(unittest.TestCase):
    def setUp(self):
        self.retrieval = build_regulations_retrieval([RULES, GUIDE]).chat_retrieval

    def test_lines_show_expected_top_three_and_hit_rate(self):
        questions = (
            Question(
                "구름 재등록을 하려면",
                (Expected("가상 별빛 학칙", "제33조"), Expected("가상 별빛 운영 규정", "제5조")),
            ),
            Question("안개정원은 언제 여나요", (Expected("가상 별빛 학칙", "제33조"),)),
            # 1위가 제3조여도 기대한 제33조가 아니면 놓침이다.
            Question("구름 재등록", (Expected("가상 별빛 학칙", "제33조"),)),
            Question("얼룩말 풍금", (Expected("가상 별빛 학칙", "제3조"),)),
        )

        lines, hits = evaluate(self.retrieval, questions)

        self.assertEqual(hits, 2)
        self.assertEqual(len(lines), 4)
        self.assertTrue(lines[0].startswith("[적중] 구름 재등록을 하려면 | 기대: "))
        self.assertIn("가상 별빛 학칙 제9차 제3조", lines[0])
        self.assertIn("가상 별빛 운영 규정 제5조", lines[0])
        self.assertTrue(lines[1].startswith("[적중] 안개정원은 언제 여나요"))
        self.assertTrue(lines[2].startswith("[놓침] 구름 재등록 | 기대: 가상 별빛 학칙 제33조"))
        self.assertEqual(
            lines[3], "[놓침] 얼룩말 풍금 | 기대: 가상 별빛 학칙 제3조 | 상위 3개: 없음"
        )
        self.assertEqual(eval_retrieval.summary(hits, len(questions)), "적중률: 2/4 (50.0%)")
        for text in (RULE_RETRY, RULE_FOG, GUIDE_RETRY, "구름학생", "별지기"):
            with self.subTest(text=text):
                self.assertNotIn(text, "\n".join(lines))

    def test_top_three_comes_from_the_relaxed_citations(self):
        inner = self.retrieval
        calls = []

        class Recording:
            def build_result(self, message, session_id, *, relaxed=False):
                calls.append(relaxed)
                return inner.build_result(message, session_id, relaxed=relaxed)

        top = eval_retrieval.top_articles(Recording(), "구름 재등록")

        self.assertEqual(calls, [True])
        citations = inner.build_result("구름 재등록", None, relaxed=True)["citations"]
        self.assertEqual(
            top, [(c["document"], article_number(c["article_path"])) for c in citations[:3]]
        )
        self.assertEqual(
            sorted(number for _, number in top), ["제3조", "제5조"]
        )


class MainTests(unittest.TestCase):
    def test_missing_setting_prints_one_line_and_exits_zero(self):
        for environ in ({}, {MANIFEST_ENV: ""}, {MANIFEST_ENV: "  "}):
            with self.subTest(environ=environ):
                code, out, err = run_main(environ=environ)
                self.assertEqual(code, 0)
                self.assertEqual(out, MISSING_TEXT + "\n")
                self.assertEqual(err, "")

    def test_fictional_manifest_prints_one_line_per_question_and_the_rate(self):
        code, out, err = run_main(environ={MANIFEST_ENV: str(FICTIONAL_MANIFEST)})

        self.assertEqual(code, 0)
        self.assertEqual(err, "")
        lines = out.splitlines()
        self.assertEqual(len(lines), 12)
        for line, item in zip(lines, load_questions()):
            with self.subTest(question=item.question):
                self.assertRegex(line, r"^\[(적중|놓침)\] ")
                self.assertIn(item.question, line)
                self.assertIn(" | 기대: ", line)
                self.assertIn(" | 상위 3개: ", line)
        self.assertRegex(lines[-1], r"^적중률: [0-9]+/11 \([0-9.]+%\)$")
        self.assertNotIn(str(FIXTURES), out)
        self.assertNotIn("fictional_manifest", out)
        for text in FICTIONAL_TEXTS:
            for sentence in text.splitlines()[2:]:
                with self.subTest(sentence=sentence):
                    self.assertNotIn(sentence, out)

    def test_unreadable_manifest_prints_only_a_fixed_line(self):
        code, out, err = run_main(environ={MANIFEST_ENV: str(MISSING_MANIFEST)})

        self.assertEqual(code, 1)
        self.assertEqual(out, BUILD_FAILED_TEXT + "\n")
        self.assertEqual(err, "")
        self.assertNotIn("비밀폴더", out)

    def test_builder_error_text_is_not_printed(self):
        secret = "가상 원문 비밀 문장 C:\\가상\\비밀폴더"
        with mock.patch(
            "api.regulation_app.build_regulations_retrieval", side_effect=ValueError(secret)
        ):
            code, out, err = run_main(environ={MANIFEST_ENV: str(FICTIONAL_MANIFEST)})

        self.assertEqual(code, 1)
        self.assertEqual(out, BUILD_FAILED_TEXT + "\n")
        self.assertEqual(err, "")
        self.assertNotIn("Traceback", out)

    def test_search_error_text_is_not_printed(self):
        with mock.patch.object(
            eval_retrieval, "top_articles", side_effect=RuntimeError("가상 원문 비밀 문장")
        ):
            code, out, err = run_main(environ={MANIFEST_ENV: str(FICTIONAL_MANIFEST)})

        self.assertEqual(code, 1)
        self.assertEqual(out, SEARCH_FAILED_TEXT + "\n")
        self.assertEqual(err, "")

    def test_unreadable_question_file_prints_only_a_fixed_line(self):
        for path in (FIXTURES / "fictional_manifest_first.txt", MISSING_MANIFEST):
            with self.subTest(path=path.name):
                code, out, err = run_main(
                    environ={MANIFEST_ENV: str(FICTIONAL_MANIFEST)}, questions_path=path
                )
                self.assertEqual(code, 1)
                self.assertEqual(out, QUESTIONS_FAILED_TEXT + "\n")
                self.assertEqual(err, "")

    def test_in_memory_questions_with_several_expected_articles(self):
        # 가상 목록의 문서 두 건. 둘째 기대값만 맞아도 적중이다.
        questions = [
            Question(
                "대패는 누가 내어 주나요",
                (Expected("가상 달무리 천문대 규정", "제1조"), Expected("가상 은여울 목공방 규정", "제1조")),
            ),
        ]
        code, out, _ = run_main(environ={MANIFEST_ENV: str(FICTIONAL_MANIFEST)}, questions=questions)

        self.assertEqual(code, 0)
        lines = out.splitlines()
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[0].startswith("[적중] 대패는 누가 내어 주나요"))
        self.assertIn("상위 3개: 가상 은여울 목공방 규정 제1조", lines[0])
        self.assertEqual(lines[1], "적중률: 1/1 (100.0%)")


if __name__ == "__main__":
    unittest.main()
