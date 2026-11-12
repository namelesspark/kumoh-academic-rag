"""서버를 띄우지 않고 사진 요청과 공식 행사 판정을 확인한다."""

import sys
import unittest
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.tests.asgi_harness import call_app
from app.main import create_app
from app.services.biskit_recommendations import KST, PROGRAMS
from app.services.poster_recognition import Recognition


NOTICE = "https://www.kumoh.ac.kr/ko/sub06_01_01_02.do?articleNo=582099&mode=view"
ALIAS = "https://mx.kumoh.ac.kr/md/sub0201.do?articleNo=582275&mode=view"
DETAIL = "https://biskit.kumoh.ac.kr/ptfol/imng/icmpNsbjtPgm/findIcmpNsbjtPgmInfo.do?encSddpbSeq=31303034313732"
TITLE = "SJA세진아메리카 2027년 미국 인턴 채용설명회"
EVENT_TEXT = f"{TITLE}\n행사 일시 2026. 11. 23. 13:30"


def photo(image_format="PNG", size=(8, 8), color=0):
    output = BytesIO()
    with Image.new("L", size, color) as image:
        image.save(output, format=image_format)
    return output.getvalue()


class PosterLookupTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.image = photo()

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
                self.assertEqual(result["event"]["application_url"], PROGRAMS[2].application_url)
                self.assertTrue(result["event"]["login_required"])
                self.assertEqual(result["event"]["checked_on"], "2026-11-13")

    def test_unknown_unsafe_or_unverified_qr_omits_links(self):
        for url in (
            ALIAS.replace("582275", "582274"),
            ALIAS.replace("mx.kumoh.ac.kr", "mx.kumoh.ac.kr.example.org"),
            ALIAS.replace("/md/sub0201.do", "/ko/sub0201.do"),
            ALIAS.replace("https://", "http://"),
            ALIAS.replace("https://", "https://user@"),
            ALIAS + "&articleNo=582274",
            DETAIL.replace("31303034313732", "31303034313733"),
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
        result = self.lookup(codes=(PROGRAMS[0].notice_url,))
        self.assertEqual(result["event"]["application_state"], "closed")
        self.assertEqual(result["event"]["mileage"], 40)
        self.assertIsNone(result["event"]["application_url"])
        self.assertFalse(result["event"]["login_required"])

    def test_no_model_still_returns_needs_check(self):
        result = self.lookup(text_available=False)
        self.assertEqual(result["event_match"], "needs_check")
        self.assertIn("text_reader_unavailable", result["reasons"])
        self.assertIsNone(result["event"])

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
