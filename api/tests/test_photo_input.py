"""소켓과 실제 자료 없이 사진 입력과 판독문 재질의를 검사한다."""

import asyncio
import builtins
import io
import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, call, patch
from urllib.parse import quote

from api.tests.asgi_harness import call_app
from api.tests.test_poster_lookup import InMemoryLoop, photo
from app.main import VALIDATION_ERROR_MESSAGE, create_app
from app.schemas.campus_guide import CampusPlace
from app.services.biskit_recommendations import KST, Program
from app.services.chat_retrieval import ChatRetrieval
from app.services.poster_recognition import Recognition


PHOTO_INPUT = "/api/v1/photo-input"
POSTER_LOOKUP = "/api/v1/poster-lookup"
PHOTO_QUESTION = "/api/v1/photo-question"
TITLE = "가상 별빛 인턴 설명회"
EVENT_TEXT = f"{TITLE}\n행사 일시 2031-11-23"
NOTICE = "https://example.kumoh.ac.kr/ko/sub0101.do?articleNo=101&mode=view"
NOTICE_QR = "https://example.kumoh.ac.kr/md/sub0101.do?articleNo=102&mode=view"
PROGRAM_PATH = "/ptfol/imng/icmpNsbjtPgm/findIcmpNsbjtPgmInfo.do?encSddpbSeq=103"
PROGRAM_QR = f"https://biskit.kumoh.ac.kr{PROGRAM_PATH}"
APPLICATION = f"https://biskit.kumoh.ac.kr/common/user/login.do?rtnUrl={quote(PROGRAM_PATH, safe='')}"
EVENT = Program(
    title=TITLE,
    audience="가상 참가자",
    eligible_statuses=frozenset({"undergraduate"}),
    apply_from=date(2031, 11, 1),
    apply_until=date(2031, 11, 22),
    event_on=date(2031, 11, 23),
    mileage_status="undisclosed",
    mileage_points=None,
    notice_url=NOTICE,
    application_url=APPLICATION,
    poster_keywords=("별빛", "인턴", "설명회"),
    poster_notice_aliases=(NOTICE_QR,),
)
PLACE = CampusPlace(
    id="fictional-hall",
    name="가상관",
    category="building",
    purpose="가상 실습 공간",
    location="정문 옆",
    sources=[{
        "title": "가상 캠퍼스 안내",
        "url": "https://example.invalid/campus",
        "checked_on": "2031-11-13",
    }],
)


async def run_inline(function, *args):
    return function(*args)


class PhotoInputTests(unittest.TestCase):
    def setUp(self):
        self.image = photo()
        self.app = create_app()
        self.initial_state = vars(self.app.state)["_state"].copy()
        self.reader = self.enterContext(patch(
            "app.api.v1.poster_lookup.recognize",
            return_value=Recognition("", (), True),
        ))
        self.worker = self.enterContext(patch(
            "app.api.v1.poster_lookup.run_in_threadpool", side_effect=run_inline,
        ))
        self.clock = self.enterContext(patch("app.api.v1.poster_lookup.datetime"))
        self.clock.now.return_value = datetime(2031, 11, 13, tzinfo=KST)
        self.enterContext(patch("app.services.poster_lookup.PROGRAMS", (EVENT,)))
        self.places = self.enterContext(patch(
            "app.services.photo_input.get_campus_places", new_callable=AsyncMock, return_value=[PLACE],
        ))

    def upload(self, body=None, *, path=PHOTO_INPUT, **headers):
        return call_app(
            self.app, "POST", path, raw_body=self.image if body is None else body,
            headers={"content-type": "image/png", **headers},
        )

    def question(self, recognized_text="", question=""):
        return call_app(self.app, "POST", PHOTO_QUESTION, json_body={
            "question": question, "recognized_text": recognized_text, "session_id": "s-1",
        })

    def assert_hold(self, response):
        self.assertEqual(response.status, 200)
        result = response.json()
        self.assertEqual(result["kind"], "hold")
        self.assertEqual(result["sources"], [])
        self.assertIsNone(result["event"])
        self.assertIsNone(result["answer"])
        self.assertTrue(result["hold_reason"])

    def test_size_boundary_and_false_content_length(self):
        limit = self.image.ljust(5_000_000, b"\0")
        self.assertEqual(self.upload(limit).status, 200)
        self.assertEqual(self.upload(limit + b"\0").status, 413)
        self.assertEqual(self.upload(limit + b"\0", **{"content-length": "1"}).status, 413)
        self.assertEqual(self.upload(**{"content-length": "5000001"}).status, 413)
        self.reader.assert_called_once()

    def test_image_error_releases_lock_for_other_route(self):
        self.assertEqual(self.upload(b"not a photo").status, 422)
        self.assertEqual(self.upload(path=POSTER_LOOKUP).status, 200)
        self.reader.assert_called_once()

    def test_same_card_from_event_text_and_each_qr_in_both_routes(self):
        expected_card = None
        for recognized, codes, clues in (
            (EVENT_TEXT, (), ["text"]),
            ("", (NOTICE_QR,), ["qr_notice"]),
            ("", (PROGRAM_QR,), ["qr_program"]),
            ("", (NOTICE_QR, PROGRAM_QR), ["qr_notice", "qr_program"]),
        ):
            with self.subTest(clues=clues):
                self.reader.return_value = Recognition(recognized, codes, True)
                photo_result = self.upload()
                legacy_result = self.upload(path=POSTER_LOOKUP)
                self.assertEqual(photo_result.status, 200)
                self.assertEqual(legacy_result.status, 200)
                result = photo_result.json()
                self.assertEqual(result, legacy_result.json())
                self.assertEqual(result["event_match"], "confirmed")
                self.assertEqual(result["identified_by"], clues)
                self.assertEqual(result["recognized_text"], recognized)
                self.assertEqual(result["event"]["notice_url"], NOTICE)
                self.assertEqual(result["event"]["application_url"], APPLICATION)
                if expected_card is None:
                    expected_card = result["event"]
                self.assertEqual(result["event"], expected_card)
                for code in codes:
                    self.assertNotIn(code, photo_result.text())

    def test_same_filename_without_event_evidence_has_no_event_links(self):
        headers = {"content-disposition": 'attachment; filename="fictional.png"'}
        self.reader.side_effect = lambda image: Recognition(
            EVENT_TEXT if image.getpixel((0, 0)) else "", (), True,
        )
        event = self.upload(photo(color=255), **headers).json()
        self.assertEqual(event["event_match"], "confirmed")
        landscape = self.upload(photo(color=0), **headers).json()
        self.assertEqual(landscape["event_match"], "needs_check")
        self.assertIsNone(landscape["event"])
        self.reader.side_effect = None
        self.reader.return_value = Recognition(TITLE, ("https://example.invalid/untrusted",), True)
        title_only = self.upload()
        self.assertIsNone(title_only.json()["event"])
        self.assertNotIn("https://example.invalid/untrusted", title_only.text())

    def test_recognized_text_omits_a_url_also_decoded_from_qr(self):
        printed_url = "https://example.invalid/printed"
        qr_url = "https://example.invalid/qr-only"
        self.reader.return_value = Recognition(f"{printed_url}\n{qr_url}", (qr_url,), True)
        result = self.upload()
        self.assertEqual(result.status, 200)
        self.assertIn(printed_url, result.json()["recognized_text"])
        self.assertNotIn(qr_url, result.text())
        self.assertIsNone(result.json()["event"])

    def test_different_poster_deadline_keeps_official_date_and_source(self):
        self.clock.now.return_value = datetime(2031, 11, 22, tzinfo=KST)
        recognized = f"{EVENT_TEXT}\n신청 마감 11월 20일"
        self.reader.return_value = Recognition(recognized, (), True)
        result = self.upload().json()
        self.assertEqual(result["event_match"], "confirmed")
        self.assertEqual(result["recognized_text"], recognized)
        self.assertEqual(result["reasons"], ["deadline_mismatch", "deadline_day"])
        self.assertEqual(result["event"]["official_deadline"], "2031-11-22")
        self.assertEqual(result["event"]["poster_deadline"], "11-20")
        self.assertEqual(result["event"]["application_state"], "needs_check")
        self.assertEqual(result["event"]["notice_url"], NOTICE)

    def test_corrected_event_text_returns_same_event_without_reader(self):
        response = self.question(EVENT_TEXT)
        self.assertEqual(response.status, 200)
        result = response.json()
        self.assertEqual(result["kind"], "event")
        self.assertEqual(result["event"]["title"], TITLE)
        self.assertEqual(result["event"]["notice_url"], NOTICE)
        self.assertIsNone(result["hold_reason"])
        self.reader.assert_not_called()

    def test_text_search_uses_existing_regulation_retrieval_and_explicit_question(self):
        answer = "가상 승인서를 제출합니다."
        search = Mock(return_value=[SimpleNamespace(
            chunk=SimpleNamespace(article_path="가상 제1조", start=0, end=len(answer)),
        )])
        self.app.state.chat_retrieval = ChatRetrieval(
            search=search,
            source=answer,
            document_title="가상 안내 규정",
            effective_date=date(2031, 11, 13),
            source_url="https://example.invalid/regulation",
        )
        response = self.question("가상 승인서", "어떤 서류가 필요해요?")
        self.assertEqual(response.status, 200)
        result = response.json()
        self.assertEqual(result["kind"], "regulation")
        self.assertEqual(result["answer"], answer)
        self.assertEqual(result["sources"][0]["url"], "https://example.invalid/regulation")
        self.assertIsNone(result["event"])
        self.assertIsNone(result["hold_reason"])
        search.assert_called_once_with("어떤 서류가 필요해요?")

        search.reset_mock()
        self.assertEqual(self.question("가상 승인서").json()["kind"], "regulation")
        search.assert_called_once_with("가상 승인서")

        hits = search.return_value
        search.reset_mock()
        search.side_effect = [[], hits]
        self.assertEqual(self.question("가상 승인서", "어떤 서류가 필요해요?").json()["kind"], "regulation")
        self.assertEqual(search.call_args_list, [
            call("어떤 서류가 필요해요?"),
            call("어떤 서류가 필요해요?\n가상 승인서"),
        ])

        search.side_effect = None
        search.return_value = []
        self.assert_hold(self.question("근거 없는 가상 판독문"))

    def test_campus_uses_verified_place_and_holds_on_multiple_matches(self):
        response = self.question("가상관 101호", "여기 어디야?")
        self.assertEqual(response.status, 200)
        result = response.json()
        self.assertEqual(result["kind"], "campus")
        self.assertIn("정문 옆", result["answer"])
        self.assertEqual(result["sources"], [{
            "title": "가상 캠퍼스 안내", "url": "https://example.invalid/campus",
        }])
        self.assertIsNone(result["event"])
        self.assertIsNone(result["hold_reason"])

        other = PLACE.model_copy(update={"id": "fictional-annex", "name": "가상별관"})
        self.places.return_value = [PLACE, other]
        self.assert_hold(self.question("가상관 또는 가상별관", "어디야?"))

    def test_empty_and_overlong_text(self):
        self.assert_hold(self.question("\n", " "))
        self.assert_hold(self.question("가" * 2000))
        response = self.question("가" * 2001)
        self.assertEqual(response.status, 400)
        self.assertEqual(response.json(), {"detail": VALIDATION_ERROR_MESSAGE})
        self.reader.assert_not_called()

    def test_photo_and_recognized_text_leave_no_app_state_or_logs(self):
        def read_only(opener):
            def open_file(file, mode="r", *args, **kwargs):
                self.assertFalse(any(flag in mode for flag in "wax+"), "사진 처리 중 파일 쓰기를 시도했습니다.")
                return opener(file, mode, *args, **kwargs)

            return open_file

        recognized = "가상 판독문 보관 검사"
        self.reader.return_value = Recognition(recognized, (), True)
        with (
            self.assertNoLogs(level="INFO"),
            patch("builtins.open", new=read_only(builtins.open)),
            patch("io.open", new=read_only(io.open)),
            patch("PIL.Image.Image.save") as save,
        ):
            result = self.upload()
            self.assert_hold(self.question(recognized))
        self.assertEqual(result.json()["recognized_text"], recognized)
        save.assert_not_called()
        state = vars(self.app.state)["_state"]
        self.assertEqual(
            {key: value for key, value in state.items() if not isinstance(value, asyncio.Lock)},
            self.initial_state,
        )

    def test_both_photo_routes_wait_before_body_read_while_question_finishes(self):
        async def check_requests():
            first_reading = asyncio.Event()
            finish_first = asyncio.Event()
            second_started = asyncio.Event()
            bodies_read = []
            statuses = {}

            async def upload(path):
                if path == POSTER_LOOKUP:
                    second_started.set()

                async def receive():
                    bodies_read.append(path)
                    if path == PHOTO_INPUT:
                        first_reading.set()
                        await finish_first.wait()
                    return {"type": "http.request", "body": self.image}

                async def send(message):
                    if message["type"] == "http.response.start":
                        statuses[path] = message["status"]

                await self.app({
                    "type": "http", "method": "POST", "path": path, "query_string": b"",
                    "headers": [(b"content-type", b"image/png")],
                }, receive, send)

            first = asyncio.create_task(upload(PHOTO_INPUT))
            await first_reading.wait()
            second = asyncio.create_task(upload(POSTER_LOOKUP))
            await second_started.wait()
            self.assertEqual(bodies_read, [PHOTO_INPUT])
            self.assert_hold(self.question())
            finish_first.set()
            await asyncio.gather(first, second)
            self.assertEqual(bodies_read, [PHOTO_INPUT, POSTER_LOOKUP])
            self.assertEqual(statuses, {PHOTO_INPUT: 200, POSTER_LOOKUP: 200})

        with asyncio.Runner(loop_factory=InMemoryLoop) as runner:
            runner.run(asyncio.wait_for(check_requests(), timeout=2))
