"""서버를 띄우지 않고 사진 요청과 공식 행사 판정을 확인한다."""

import asyncio
import selectors
import sys
import unittest
from dataclasses import replace
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.parse import quote

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.tests.asgi_harness import call_app
from app.main import create_app
from app.services.biskit_recommendations import KST, Program
from app.services.poster_recognition import Recognition


NOTICE = "https://example.kumoh.ac.kr/ko/sub0101.do?articleNo=990001&mode=view"
ALIAS = "https://example.kumoh.ac.kr/md/sub0101.do?articleNo=990002&mode=view"
DETAIL_PATH = "/ptfol/imng/icmpNsbjtPgm/findIcmpNsbjtPgmInfo.do?encSddpbSeq=990003"
DETAIL = f"https://biskit.kumoh.ac.kr{DETAIL_PATH}"
APPLICATION = f"https://biskit.kumoh.ac.kr/common/user/login.do?rtnUrl={quote(DETAIL_PATH, safe='')}"
OTHER_NOTICE = NOTICE.replace("990001", "990004")
TITLE = "가상 별빛 인턴 채용설명회"
EVENT_TEXT = f"{TITLE}\n행사 일시 2026. 11. 23. 13:30"
PROGRAMS = (
    Program(
        title=TITLE, audience="가상 참가자", eligible_statuses=frozenset({"undergraduate"}),
        apply_from=date(2026, 11, 1), apply_until=date(2026, 11, 22), event_on=date(2026, 11, 23),
        mileage_status="undisclosed", mileage_points=None, notice_url=NOTICE, application_url=APPLICATION,
        poster_keywords=("별빛", "인턴", "채용설명회"), poster_notice_aliases=(ALIAS,),
    ),
    Program(
        title="가상 달빛 워크숍", audience="가상 참가자", eligible_statuses=frozenset({"undergraduate"}),
        apply_from=date(2026, 10, 1), apply_until=date(2026, 10, 15), event_on=None,
        mileage_status="published", mileage_points=40, notice_url=OTHER_NOTICE,
    ),
)


def photo(image_format="PNG", size=(8, 8), color=0):
    output = BytesIO()
    with Image.new("L", size, color) as image:
        image.save(output, format=image_format)
    return output.getvalue()


class InMemorySelector(selectors.SelectSelector):
    def select(self, timeout=None):
        return []


class InMemoryLoop(asyncio.SelectorEventLoop):
    """요청과 작업 완료 신호를 메모리로 전달하므로 소켓을 만들지 않는다."""

    def __init__(self):
        super().__init__(InMemorySelector())

    def _make_self_pipe(self):
        pass

    def _close_self_pipe(self):
        pass


class PosterLookupTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.image = photo()
        self.enterContext(patch("app.services.poster_lookup.PROGRAMS", PROGRAMS))
        self.enterContext(patch("app.services.poster_lookup.LISTED_ON", date(2026, 11, 13)))

    def upload(self, body, media_type="image/png", **headers):
        async def run_inline(function, *args):
            return function(*args)

        # 사진 처리는 그대로 실행하고, 검증 환경에서 별도 실행 스레드만 생략한다.
        with patch("app.api.v1.poster_lookup.run_in_threadpool", new=run_inline):
            return call_app(
                self.app, "POST", "/api/v1/poster-lookup", raw_body=body,
                headers={"content-type": media_type, **headers},
            )

    def lookup(self, text="", codes=(), text_available=True, today=date(2026, 11, 13)):
        with (
            patch("app.api.v1.poster_lookup.recognize", return_value=Recognition(text, codes, text_available)),
            patch("app.api.v1.poster_lookup.datetime") as clock,
        ):
            clock.now.return_value = datetime(today.year, today.month, today.day, tzinfo=KST)
            response = self.upload(self.image)
            clock.now.assert_called_once_with(KST)
        self.assertEqual(response.status, 200)
        return response.json()

    def test_identifies_pixels_without_using_a_filename(self):
        def recognize(image):
            return Recognition(EVENT_TEXT if image.getpixel((0, 0)) else "", (), True)

        with patch("app.api.v1.poster_lookup.recognize", side_effect=recognize):
            event = self.upload(photo("JPEG", color=255), "image/jpeg").json()
            unrelated = self.upload(photo("JPEG"), "image/jpeg").json()
        self.assertEqual(event["event_match"], "confirmed")
        self.assertEqual(event["identified_by"], ["text"])
        self.assertEqual(unrelated["event_match"], "needs_check")
        self.assertIsNone(unrelated["event"])

    def test_same_event_from_notice_alias_and_program_qrs(self):
        for url, clue in ((NOTICE, "qr_notice"), (ALIAS, "qr_notice"), (DETAIL, "qr_program")):
            with self.subTest(clue=clue, url=url):
                result = self.lookup(codes=(url,), text_available=False)
                self.assertEqual(result["event_match"], "confirmed")
                self.assertEqual(result["identified_by"], [clue])
                self.assertEqual(result["event"]["notice_url"], NOTICE)
                self.assertEqual(result["event"]["application_url"], APPLICATION)
                self.assertTrue(result["event"]["login_required"])
                self.assertEqual(result["event"]["checked_on"], "2026-11-13")

    def test_unknown_unsafe_or_unverified_qr_omits_links(self):
        for url in (
            ALIAS.replace("990002", "990005"),
            ALIAS.replace("example.kumoh.ac.kr", "example.kumoh.ac.kr.example.org"),
            ALIAS.replace("/md/sub0101.do", "/ko/sub0101.do"),
            ALIAS.replace("https://", "http://"),
            ALIAS.replace("https://", "https://user@"),
            ALIAS + "&articleNo=990005",
            DETAIL.replace("990003", "990005"),
            "javascript:alert(1)",
        ):
            with self.subTest(url=url):
                result = self.lookup(codes=(url,))
                self.assertEqual(result["event_match"], "needs_check")
                self.assertIsNone(result["event"])

    def test_text_needs_title_and_date(self):
        for text in (TITLE, "행사 일시 2026-11-23", TITLE + " 신청 마감 2026-11-23", TITLE + " 2027-11-23"):
            with self.subTest(text=text):
                result = self.lookup(text)
                self.assertEqual(result["event_match"], "needs_check")
                self.assertIsNone(result["event"])

    def test_competing_events_omit_links(self):
        result = self.lookup(EVENT_TEXT, (PROGRAMS[1].notice_url,))
        self.assertEqual(result["reasons"], ["ambiguous_event"])
        self.assertEqual(result["identified_by"], [])
        self.assertIsNone(result["event"])

    def test_yearless_dates_keep_the_catalog_event_year(self):
        for value in ("11월 23일", "11.23", "11-23", "11/23", "11 월 23 일"):
            for prefix in ("", "2027년 미국 인턴 "):
                with self.subTest(value=value, prefix=prefix):
                    result = self.lookup(f"{TITLE} {prefix}{value} 신청 마감 11/20")
                    self.assertEqual(result["event_match"], "confirmed")
                    self.assertEqual(result["identified_by"], ["text"])
                    self.assertEqual(result["event"]["event_date"], "2026-11-23")
                    self.assertEqual(result["event"]["notice_url"], NOTICE)

    def test_yearless_dates_need_every_title_clue(self):
        result = self.lookup("가상 별빛 인턴 11월 23일")
        self.assertEqual(result["event_match"], "needs_check")
        self.assertIsNone(result["event"])

    def test_excludes_full_dates_deadlines_and_number_fragments(self):
        for value in (
            "2027-11-23", "2027.11.23", "2027/11/23", "2027년 11월 23일",
            "1999-11-23", "12026-11-23", "마감 11월 23일", "신청 마감일: 11/23",
            "11월 23일까지", "11.23까지", "11-23까지", "11/23까지",
            "2026년 11월 23일까지", "2026-11-23까지", "2026.11.23.까지",
            "111월 23일", "111.23", "11/230", "11월 230일",
            "13월 23일", "11월 31일", "0/23", "11/0",
        ):
            with self.subTest(value=value):
                result = self.lookup(f"{TITLE} {value}")
                self.assertEqual(result["event_match"], "needs_check")
                self.assertIsNone(result["event"])

    def test_yearless_date_with_competing_catalog_years_needs_check(self):
        other = replace(PROGRAMS[0], title="가상 다음 해 행사", event_on=date(2027, 11, 23))
        with patch("app.services.poster_lookup.PROGRAMS", (PROGRAMS[0], other)):
            result = self.lookup(f"{TITLE} 11월 23일")
        self.assertEqual(result["event_match"], "needs_check")
        self.assertEqual(result["reasons"], ["ambiguous_event"])
        self.assertIsNone(result["event"])

    def test_yearless_leap_day_matches_only_a_valid_catalog_date(self):
        leap_event = replace(PROGRAMS[0], event_on=date(2028, 2, 29))
        with patch("app.services.poster_lookup.PROGRAMS", (leap_event,)):
            result = self.lookup(f"{TITLE} 2월 29일")
            invalid = self.lookup(f"{TITLE} 2월 30일")
        self.assertEqual(result["event"]["event_date"], "2028-02-29")
        self.assertEqual(invalid["event_match"], "needs_check")

    def test_poster_deadline_keeps_month_day_and_official_deadline(self):
        for deadline in ("11-20", "2026.11.20.", "11월 20일"):
            with self.subTest(deadline=deadline):
                result = self.lookup(f"{EVENT_TEXT}\n신청 마감 {deadline}")
                self.assertEqual(result["event_match"], "confirmed")
                self.assertEqual(result["reasons"], ["deadline_mismatch"])
                self.assertEqual(result["event"]["official_deadline"], "2026-11-22")
                self.assertEqual(result["event"]["poster_deadline"], "11-20")
                self.assertEqual(result["event"]["application_state"], "open")

    def test_last_day_and_closed_events(self):
        result = self.lookup(EVENT_TEXT, today=date(2026, 11, 22))
        self.assertEqual(result["event"]["application_state"], "needs_check")
        self.assertEqual(result["reasons"], ["deadline_day"])
        result = self.lookup(codes=(OTHER_NOTICE,))
        self.assertEqual(result["event"]["application_state"], "closed")
        self.assertEqual(result["event"]["mileage"], 40)
        self.assertIsNone(result["event"]["application_url"])
        self.assertFalse(result["event"]["login_required"])

    def test_no_model_still_returns_needs_check(self):
        result = self.lookup(text_available=False)
        self.assertEqual(result["event_match"], "needs_check")
        self.assertIn("text_reader_unavailable", result["reasons"])
        self.assertIsNone(result["event"])

    def test_photo_requests_wait_before_reading_body_without_blocking_chat_or_health(self):
        async def check_requests():
            first_reading = asyncio.Event()
            finish_first_read = asyncio.Event()
            first_processing = asyncio.Event()
            finish_first_processing = asyncio.Event()
            second_started = asyncio.Event()
            bodies_read = []
            responses = {}

            async def upload(name):
                if name == "second":
                    second_started.set()

                async def receive():
                    bodies_read.append(name)
                    if name == "first":
                        first_reading.set()
                        await finish_first_read.wait()
                    return {"type": "http.request", "body": self.image}

                async def send(message):
                    if message["type"] == "http.response.start":
                        responses[name] = message["status"]

                await self.app({
                    "type": "http", "method": "POST", "path": "/api/v1/poster-lookup",
                    "headers": [(b"content-type", b"image/png")], "query_string": b"",
                }, receive, send)

            async def pause_first_worker(function, *args):
                if not first_processing.is_set():
                    first_processing.set()
                    await finish_first_processing.wait()
                return function(*args)

            with (
                patch("app.api.v1.poster_lookup.run_in_threadpool", new=pause_first_worker),
                patch("app.api.v1.poster_lookup.recognize", return_value=Recognition(EVENT_TEXT, (), True)),
            ):
                first = asyncio.create_task(upload("first"))
                await first_reading.wait()
                second = asyncio.create_task(upload("second"))
                await second_started.wait()
                self.assertEqual(bodies_read, ["first"])

                finish_first_read.set()
                await first_processing.wait()
                self.assertEqual(bodies_read, ["first"])
                health = call_app(self.app, "GET", "/api/v1/health")
                chat = call_app(
                    self.app, "POST", "/api/v1/chat", json_body={"message": "가상의 날씨"},
                )
                self.assertEqual(health.status, 200)
                self.assertEqual(chat.status, 200)
                self.assertFalse(chat.json()["answered"])

                finish_first_processing.set()
                await asyncio.gather(first, second)
                self.assertEqual(bodies_read, ["first", "second"])
                self.assertEqual(responses, {"first": 200, "second": 200})

        with asyncio.Runner(loop_factory=InMemoryLoop) as runner:
            runner.run(asyncio.wait_for(check_requests(), timeout=2))

    def test_upload_limits_return_existing_error_shape(self):
        cases = (
            (self.image, "image/png", {"content-length": "5000001"}, 413),
            (b" " * 5_000_001, "image/png", {"content-length": "1"}, 413),
            (self.image, "image/gif", {}, 415),
            (self.image, "image/jpeg", {}, 415),
            (photo("GIF"), "image/png", {}, 415),
            (b"broken", "image/png", {}, 422),
            (photo(size=(4001, 3000)), "image/png", {}, 422),
        )
        with patch("app.api.v1.poster_lookup.recognize") as reader:
            for body, media_type, headers, status in cases:
                with self.subTest(status=status, media_type=media_type):
                    response = self.upload(body, media_type, **headers)
                    self.assertEqual(response.status, status)
                    self.assertEqual(set(response.json()), {"detail"})
            reader.assert_not_called()
