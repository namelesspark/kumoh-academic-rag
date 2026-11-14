"""가상 그림과 응답만으로 공식 그림 준비와 제공을 확인함."""

from hashlib import sha256
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from zipfile import BadZipFile, ZipFile

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError

TESTS_DIR = Path(__file__).resolve().parent
sys.path[:0] = [str(TESTS_DIR.parent), str(TESTS_DIR)]

from app import main as web_main
from asgi_harness import call_app
from api.scripts import prepare_brand_assets as assets

BRAND_NAMES = ("kumoh-signature.png", "techmo-basic.png", "techmo-quiet.png",
               "techmo-guide.png", "techmo-celebrate.png", "techmo-sprite.png")
POSE_CASES = (("quiet", (742, 111, 881, 293), (140, 183)),
              ("guide", (742, 430, 881, 610), (140, 181)),
              ("celebrate", (947, 129, 1105, 273), (159, 145)),
              ("concert", (947, 441, 1105, 610), (159, 170)))


def image_bytes(size, image_format="PNG"):
    image = Image.new("RGB", size, "white")
    if size == (1198, 767):
        draw = ImageDraw.Draw(image)
        draw.rectangle((240, 240, 340, 340), fill="black")
        draw.rectangle((260, 260, 320, 320), fill="white")
        for _, (left, top, right, bottom), _ in POSE_CASES:
            draw.rectangle((left + 20, top + 20, left + 90, top + 90), fill="black")
            draw.rectangle((left + 40, top + 40, left + 70, top + 70), fill="white")
            draw.rectangle((right - 4, bottom - 4, right + 4, bottom + 4), fill="black")
    output = BytesIO()
    image.save(output, format=image_format)
    return output.getvalue()


def archive_bytes(png):
    output = BytesIO()
    with ZipFile(output, "w") as archive:
        archive.writestr("wrong-name.png", image_bytes((1, 1)))
        archive.writestr("한글이름에_의존하지_않음.png", png)
    return output.getvalue()


class FakeResponse(BytesIO):
    def __init__(self, data, *, headers=None, url=assets.LOGO_URL):
        super().__init__(data)
        self.headers = headers or {}
        self.url = url

    def geturl(self):
        return self.url


def photo_bytes(color, size=(1920, 280), image_format="JPEG"):
    """실제 사진과 관계없는 단색 그림. 색이 다르면 바이트와 지문도 다르다."""
    output = BytesIO()
    Image.new("RGB", size, color).save(output, format=image_format)
    return output.getvalue()


def fictional_photos(sources):
    """원본 주소와 이름은 그대로 두고 바이트 수와 지문만 가상 그림의 것으로 바꾼다."""
    return tuple(
        assets.CampusPhoto(photo.name, photo.url, len(data), sha256(data).hexdigest())
        for photo, data in zip(REAL_PHOTOS, sources)
    )


# 이슈 #79의 약속 표. (파일, 원본 경로, 바이트, SHA-256) 순서다.
PHOTO_TABLE = (
    ("campus-aerial.jpg", "/_res/ko/img/sub05/bg_subvisual_pc.jpg", 583939,
     "8faafc7fd7e7aab32534db748751786cac4ce274b7b90502f1458e383bbab710"),
    ("campus-hill.jpg", "/_res/ko/img/sub01/bg_subvisual_pc.jpg", 436640,
     "dbc71342b577655fd9e08e2e7e7b50631da92e676a0be8f227bdc80d960326cb"),
    ("campus-gate.jpg", "/_res/ko/img/sub06/bg_subvisual_pc.jpg", 346802,
     "69f8c4620bf576cc8290a3bd122db80761a1e5e270edafbf7f77f9ff81cba3c1"),
    ("campus-field.jpg", "/_res/ko/img/sub04/bg_subvisual_pc.jpg", 299358,
     "eb5c46f8a47e642e22a2dbbc55248a7eefcffb00d43f997f76459c65445555a5"),
)
PHOTO_NAMES = tuple(row[0] for row in PHOTO_TABLE)
REAL_PHOTOS = assets.CAMPUS_PHOTOS
PHOTO_COLORS = ("navy", "green", "black", "orange")


class TestCampusPhotos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sources = tuple(photo_bytes(color) for color in PHOTO_COLORS)
        cls.photos = fictional_photos(cls.sources)
        cls.by_url = {photo.url: data for photo, data in zip(cls.photos, cls.sources)}

    def run_main(self, downloader, written, logs):
        """로고와 테크모는 통과한 것으로 두고 사진 네 장의 처리만 본다."""
        with (
            patch.object(assets, "CAMPUS_PHOTOS", self.photos),
            patch.object(assets, "TITLE_IMAGES", ()),
            patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
            patch.object(assets, "logo_png", return_value=b"logo"),
            patch.object(assets, "techmo_png", return_value=b"pose"),
        ):
            return assets.main(downloader=downloader,
                               writer=lambda path, data: written.__setitem__(path.name, data),
                               report=logs.append)

    def test_constants_match_the_agreed_table(self):
        self.assertEqual(REAL_PHOTOS, tuple(
            assets.CampusPhoto(name, "https://www.kumoh.ac.kr" + path, size, digest)
            for name, path, size, digest in PHOTO_TABLE
        ))
        self.assertEqual(assets.PHOTO_DIMENSIONS, (1920, 280))
        for photo in REAL_PHOTOS:
            with self.subTest(name=photo.name):
                assets.check_url(photo.url)
                self.assertLessEqual(photo.size, assets.MAX_DOWNLOAD)
                self.assertEqual(web_main.CHAT_WEB_MEDIA_TYPES[photo.name], "image/jpeg")

    def test_verified_photo_is_returned_byte_for_byte(self):
        for photo, data in zip(self.photos, self.sources):
            with self.subTest(name=photo.name):
                # 다시 압축하지 않으므로 받은 바이트와 같은 객체다.
                self.assertIs(assets.campus_jpeg(data, photo.size, photo.sha256), data)

    def test_html_error_page_and_other_sizes_are_rejected_before_decoding(self):
        html = b"<html><body>fictional error</body></html>".ljust(143)
        self.assertEqual(len(html), 143)
        photo = self.photos[0]
        with patch.object(assets.Image, "open", side_effect=AssertionError("열면 안 됨")):
            for data in (html, b"", self.sources[0][:-1], self.sources[0] + b"\x00"):
                with self.subTest(length=len(data)), self.assertRaises(assets.AssetError) as caught:
                    assets.campus_jpeg(data, photo.size, photo.sha256)
                self.assertEqual(str(caught.exception), "사진 바이트 수 불일치")
            # 길이는 같고 한 바이트만 다른 내용.
            changed = self.sources[0][:-1] + b"\x00"
            with self.assertRaises(assets.AssetError) as caught:
                assets.campus_jpeg(changed, photo.size, photo.sha256)
            self.assertEqual(str(caught.exception), "사진 지문 불일치")
            # 바이트 수가 같아도 HTML의 지문은 사진과 다르다.
            with self.assertRaises(assets.AssetError):
                assets.campus_jpeg(html, len(html), photo.sha256)

    def test_format_and_dimensions_are_checked_even_when_bytes_and_hash_match(self):
        html = b"<html><body>fictional error</body></html>".ljust(143)
        for label, data in (
            ("png", photo_bytes("navy", image_format="PNG")),
            ("narrow", photo_bytes("navy", size=(1919, 280))),
            ("tall", photo_bytes("navy", size=(1920, 281))),
            ("swapped", photo_bytes("navy", size=(280, 1920))),
            ("html", html),
            ("truncated", self.sources[0][: len(self.sources[0]) // 2]),
        ):
            with self.subTest(label=label), self.assertRaises(assets.AssetError) as caught:
                assets.campus_jpeg(data, len(data), sha256(data).hexdigest())
            self.assertEqual(str(caught.exception), "사진 형식 또는 크기 불일치")

    def test_photo_request_carries_browser_headers_and_its_own_timeout(self):
        # 요청 하나 15초, 사진 한 장 전체 60초, 한 장당 두 번까지 받는다.
        self.assertEqual((assets.PHOTO_REQUEST_TIMEOUT, assets.PHOTO_TOTAL_TIMEOUT,
                          assets.PHOTO_ATTEMPTS), (15, 60, 2))
        # 값이 달라야 사진 요청이 로고용 한도를 잘못 쓰는 실수가 아래 단언에 걸린다.
        self.assertNotEqual(assets.PHOTO_REQUEST_TIMEOUT, assets.REQUEST_TIMEOUT)
        self.assertNotEqual(assets.PHOTO_TOTAL_TIMEOUT, assets.TOTAL_TIMEOUT)
        for photo in REAL_PHOTOS:
            with self.subTest(name=photo.name):
                opener = Mock(return_value=FakeResponse(b"fictional", url=photo.url))
                self.assertEqual(assets.download(photo.url, opener=opener), b"fictional")
                (request,), keywords = opener.call_args
                self.assertEqual(keywords, {"timeout": assets.PHOTO_REQUEST_TIMEOUT})
                self.assertEqual(request.full_url, photo.url)
                self.assertEqual(request.get_method(), "GET")
                self.assertTrue(request.get_header("User-agent").startswith("Mozilla/5.0 "))
                self.assertEqual(request.get_header("Referer"), "https://www.kumoh.ac.kr/ko/index.do")
                self.assertEqual(len(request.header_items()), 2)

    def test_logo_and_techmo_requests_are_unchanged(self):
        for url in (assets.LOGO_URL, assets.TECHMO_URL):
            with self.subTest(url=url):
                opener = Mock(return_value=FakeResponse(b"fictional", url=url))
                assets.download(url, opener=opener)
                opener.assert_called_once_with(url, timeout=assets.REQUEST_TIMEOUT)

    def test_photo_total_timeout_is_separate_from_the_brand_timeout(self):
        url = REAL_PHOTOS[0].url
        respond = lambda *args, **kwargs: FakeResponse(b"123", url=url)
        for times in ((0, assets.PHOTO_TOTAL_TIMEOUT), (0, 0, assets.PHOTO_TOTAL_TIMEOUT)):
            with self.subTest(times=times), self.assertRaises(TimeoutError):
                assets.download(url, opener=respond, clock=Mock(side_effect=times))
        # 로고의 전체 한도가 지난 시각이어도 사진은 자기 한도 안이라 끝까지 읽는다.
        late = assets.TOTAL_TIMEOUT
        self.assertLess(late, assets.PHOTO_TOTAL_TIMEOUT)
        times = iter((0, late, late, late, late))
        self.assertEqual(assets.download(url, opener=respond, clock=lambda: next(times)), b"123")
        with self.assertRaises(TimeoutError):
            assets.download(assets.LOGO_URL, opener=lambda *args, **kwargs: FakeResponse(b"123"),
                            clock=Mock(side_effect=(0, late)))

    def flaky_opener(self, outcomes):
        """부를 때마다 `outcomes`의 다음 값을 낸다. 예외면 던지고, 바이트면 그 내용의 응답을 준다."""
        remaining = list(outcomes)

        def respond(target, *, timeout):
            outcome = remaining.pop(0)
            if isinstance(outcome, Exception):
                raise outcome
            return FakeResponse(outcome, url=target.full_url)

        return Mock(side_effect=respond)

    def test_timeout_or_connection_error_is_retried_once_per_photo(self):
        url = REAL_PHOTOS[1].url
        for first in (TimeoutError("fictional timeout"), ConnectionResetError("fictional reset"),
                      URLError("fictional unreachable"), OSError("fictional socket error")):
            with self.subTest(first=type(first).__name__):
                opener = self.flaky_opener((first, b"fictional photo"))
                self.assertEqual(assets.download(url, opener=opener), b"fictional photo")
                self.assertEqual(opener.call_count, 2)
                # 두 번째 요청도 같은 주소·헤더·요청 한도로 새로 만든다.
                (one,), first_keywords = opener.call_args_list[0]
                (two,), second_keywords = opener.call_args_list[1]
                self.assertIsNot(one, two)
                for request, keywords in ((one, first_keywords), (two, second_keywords)):
                    self.assertEqual(request.full_url, url)
                    self.assertEqual(request.get_header("Referer"),
                                     "https://www.kumoh.ac.kr/ko/index.do")
                    self.assertEqual(keywords, {"timeout": assets.PHOTO_REQUEST_TIMEOUT})

    def test_second_failure_gives_up_without_a_third_request(self):
        url = REAL_PHOTOS[1].url
        second = ConnectionResetError("fictional second failure")
        opener = self.flaky_opener((TimeoutError("fictional first failure"), second, b"never read"))
        with self.assertRaises(ConnectionResetError) as caught:
            assets.download(url, opener=opener)
        self.assertIs(caught.exception, second)
        self.assertEqual(opener.call_count, 2)

    def test_failure_while_reading_restarts_from_the_first_byte(self):
        url = REAL_PHOTOS[1].url
        broken = FakeResponse(b"partial bytes", url=url)
        chunks = iter((b"partial ", TimeoutError("fictional stall")))

        def stalled_read(size):
            chunk = next(chunks)
            if isinstance(chunk, Exception):
                raise chunk
            return chunk

        broken.read1 = stalled_read
        responses = iter((broken, FakeResponse(b"whole photo", url=url)))
        opener = Mock(side_effect=lambda target, *, timeout: next(responses))
        # 앞 시도에서 받다 만 바이트가 결과에 섞이지 않는다.
        self.assertEqual(assets.download(url, opener=opener), b"whole photo")
        self.assertEqual(opener.call_count, 2)

    def test_errors_that_a_retry_cannot_fix_are_not_retried(self):
        url = REAL_PHOTOS[1].url
        # 서버가 오류 상태로 답한 경우.
        opener = self.flaky_opener((HTTPError(url, 404, "Not Found", {}, None), b"never read"))
        with self.assertRaises(HTTPError):
            assets.download(url, opener=opener)
        self.assertEqual(opener.call_count, 1)
        # 크기 한도와 허용 주소 위반.
        opener = self.flaky_opener((b"12345", b"1"))
        with self.assertRaises(assets.AssetError):
            assets.download(url, opener=opener, limit=4)
        self.assertEqual(opener.call_count, 1)
        opener = Mock(return_value=FakeResponse(b"", url="https://example.invalid/photo.jpg"))
        with self.assertRaises(assets.AssetError):
            assets.download(url, opener=opener)
        self.assertEqual(opener.call_count, 1)
        # 사진 한 장의 전체 한도를 다 쓴 경우.
        opener = self.flaky_opener((b"123", b"123"))
        with self.assertRaises(assets.DeadlineExceeded):
            assets.download(url, opener=opener,
                            clock=Mock(side_effect=(0, assets.PHOTO_TOTAL_TIMEOUT)))
        self.assertEqual(opener.call_count, 1)

    def test_retry_shares_the_total_time_of_one_photo(self):
        url = REAL_PHOTOS[1].url
        # 첫 시도가 실패했을 때 60초가 이미 다 지났으면 두 번째 요청을 보내지 않는다.
        opener = self.flaky_opener((TimeoutError("fictional timeout"), b"fictional photo"))
        with self.assertRaises(assets.DeadlineExceeded):
            assets.download(url, opener=opener,
                            clock=Mock(side_effect=(0, assets.PHOTO_TOTAL_TIMEOUT)))
        self.assertEqual(opener.call_count, 1)
        # 59초에 시작한 두 번째 시도는 남은 1초만 기다리고, 그 안에 끝나면 받는다.
        almost = assets.PHOTO_TOTAL_TIMEOUT - 1
        opener = self.flaky_opener((TimeoutError("fictional timeout"), b"fictional photo"))
        times = iter((0, almost, almost, almost, almost, almost))
        self.assertEqual(assets.download(url, opener=opener, clock=lambda: next(times)),
                         b"fictional photo")
        self.assertEqual([call.kwargs for call in opener.call_args_list],
                         [{"timeout": assets.PHOTO_REQUEST_TIMEOUT}, {"timeout": 1}])

    def test_logo_techmo_and_font_requests_are_not_retried(self):
        for url in (assets.LOGO_URL, assets.TECHMO_URL, assets.TITLE_IMAGES[0].url):
            with self.subTest(url=url):
                opener = Mock(side_effect=TimeoutError("fictional timeout"))
                with self.assertRaises(TimeoutError):
                    assets.download(url, opener=opener)
                self.assertEqual(opener.call_count, 1)

    def run_main_with_opener(self, opener, written, logs):
        """실제 받기 함수를 가짜 응답에 물려 준비 스크립트 전체를 돌린다."""
        return self.run_main(lambda url: assets.download(url, opener=opener), written, logs)

    def test_main_saves_a_photo_that_succeeds_on_the_second_request(self):
        flaky = self.photos[1]
        calls = []

        def opener(target, *, timeout):
            url = getattr(target, "full_url", target)
            calls.append(url)
            if url == flaky.url and calls.count(url) == 1:
                raise TimeoutError("fictional timeout")
            return FakeResponse(self.by_url.get(url, b"fictional"), url=url)

        written, logs = {}, []
        self.assertEqual(self.run_main_with_opener(opener, written, logs), 0)
        for name, data in zip(PHOTO_NAMES, self.sources):
            self.assertEqual(written[name], data)
        self.assertEqual(sum("준비 실패" in line for line in logs), 0)
        # 실패한 한 장만 두 번 요청했고 나머지는 한 번씩이다.
        self.assertEqual([calls.count(photo.url) for photo in self.photos], [1, 2, 1, 1])

    def test_main_skips_only_the_photo_that_fails_twice(self):
        failing = self.photos[1]
        calls = []

        def opener(target, *, timeout):
            url = getattr(target, "full_url", target)
            calls.append(url)
            if url == failing.url:
                raise URLError("fictional unreachable")
            return FakeResponse(self.by_url.get(url, b"fictional"), url=url)

        written, logs = {failing.name: b"previous"}, []
        self.assertEqual(self.run_main_with_opener(opener, written, logs), 0)
        self.assertEqual(written[failing.name], b"previous")
        for photo, data in zip(self.photos, self.sources):
            if photo is not failing:
                self.assertEqual(written[photo.name], data)
        self.assertEqual([line for line in logs if "준비 실패" in line],
                         [f"{failing.name}: 준비 실패 (URLError)"])
        self.assertEqual(calls.count(failing.url), 2)

    def test_photo_download_keeps_size_and_origin_limits(self):
        url = REAL_PHOTOS[0].url
        with self.assertRaises(assets.AssetError):
            assets.download(url, opener=lambda *args, **kwargs: FakeResponse(b"12345", url=url),
                            limit=4)
        with self.assertRaises(assets.AssetError):
            assets.download(url, opener=lambda *args, **kwargs: FakeResponse(
                b"", url="https://example.invalid/photo.jpg"))
        opener = Mock()
        for other in (url + "?size=large", url.replace("sub05", "sub02"),
                      url.replace("https://", "http://")):
            with self.subTest(other=other), self.assertRaises(assets.AssetError):
                assets.download(other, opener=opener)
        opener.assert_not_called()

    def test_main_stores_four_verified_photos_without_recompression(self):
        written, logs = {}, []
        downloader = Mock(side_effect=lambda url: self.by_url.get(url, b"fictional"))
        self.assertEqual(self.run_main(downloader, written, logs), 0)
        for name, data in zip(PHOTO_NAMES, self.sources):
            with self.subTest(name=name):
                self.assertEqual(written[name], data)
                self.assertIn(f"{name}: 준비 완료", logs)
        self.assertEqual(len(logs), 10)
        # 사진은 주소마다 한 번씩만 받는다.
        for photo in self.photos:
            self.assertEqual(sum(call.args == (photo.url,) for call in downloader.call_args_list), 1)

    def test_each_photo_fails_alone_and_keeps_its_previous_file(self):
        html = b"<html><body>fictional error</body></html>".ljust(143)
        failures = {
            "timeout": TimeoutError("fictional timeout"),
            "html": html,
            "other photo": self.sources[1],
            "png": photo_bytes("navy", image_format="PNG"),
        }
        for label, outcome in failures.items():
            for index, failed in enumerate(self.photos):
                if outcome is self.sources[index]:
                    continue
                with self.subTest(label=label, failed=failed.name):
                    written = {name: b"previous" for name in PHOTO_NAMES}
                    logs = []

                    def fetch(url):
                        if url != failed.url:
                            return self.by_url.get(url, b"fictional")
                        if isinstance(outcome, Exception):
                            raise outcome
                        return outcome

                    self.assertEqual(self.run_main(fetch, written, logs), 0)
                    self.assertEqual(written[failed.name], b"previous")
                    for name, data in zip(PHOTO_NAMES, self.sources):
                        if name != failed.name:
                            self.assertEqual(written[name], data)
                    self.assertEqual([line for line in logs if "준비 실패" in line][0].split(":")[0],
                                     failed.name)
                    self.assertEqual(sum("준비 실패" in line for line in logs), 1)
                    self.assertNotIn("fictional timeout", "".join(logs))

    def test_write_failure_of_one_photo_does_not_stop_the_rest(self):
        written, logs = {"campus-hill.jpg": b"previous"}, []

        def writer(path, data):
            if path.name == "campus-hill.jpg":
                raise OSError("fictional write failure")
            written[path.name] = data

        with patch.object(assets, "CAMPUS_PHOTOS", self.photos), \
                patch.object(assets, "TITLE_IMAGES", ()), \
                patch.object(assets, "techmo_sprite_png", return_value=b"sprite"), \
                patch.object(assets, "logo_png", return_value=b"logo"), \
                patch.object(assets, "techmo_png", return_value=b"pose"):
            code = assets.main(downloader=lambda url: self.by_url.get(url, b"fictional"),
                               writer=writer, report=logs.append)
        self.assertEqual(code, 0)
        self.assertEqual(written["campus-hill.jpg"], b"previous")
        self.assertEqual(written["campus-field.jpg"], self.sources[3])
        self.assertEqual(sum("준비 실패" in line for line in logs), 1)

    def test_unverified_real_constants_never_reach_the_writer(self):
        # 진짜 지문에는 가상 그림이 맞을 수 없다. 사진 네 줄과 제목 그림 두 줄까지 모두 실패하고 종료 코드는 0이다.
        writer, logs = Mock(), []
        self.assertEqual(assets.main(downloader=lambda url: self.sources[0],
                                     writer=writer, report=logs.append), 0)
        writer.assert_not_called()
        self.assertEqual(len(logs), 12)
        self.assertEqual([line.split(":")[0] for line in logs[6:]],
                         [*PHOTO_NAMES, "title-lettering.png", "main-lettering.png"])
        self.assertTrue(all("준비 실패" in line for line in logs))


TITLE_NAME = "title-lettering.png"
MAIN_TITLE_NAME = "main-lettering.png"
FONT_HASH = "c0b1f979979cfc309fb2438fa9464f96173353e0c4842cc7a5919658184ed9d3"
FONT_URL =("https://raw.githubusercontent.com/google/fonts/16680f8688ffcd467d2eb2146a9ce0343404581d"
            "/ofl/gugi/Gugi-Regular.ttf")
# 취소한 붓글씨 시안의 그림 이름과 글꼴 주소. 다시 들어오지 않았는지 본다.
RETIRED_TITLE_NAME = "calligraphy-title.png"
RETIRED_FONT_URL = FONT_URL.replace("gugi/Gugi", "eastseadokdo/EastSeaDokdo")
# 실제 글꼴은 저장소에 없다. 그리기 검사에는 Pillow에 들어 있는 기본 글꼴과 영문 글귀를 쓴다.
LATIN_LINES = (
    (("Fictional,", assets.TITLE_WHITE),),
    (("Gear", assets.TITLE_YELLOW), (" title", assets.TITLE_WHITE)),
)
# 메인 화면 제목처럼 한 줄이고 뒤 낱말만 노랗다.
LATIN_MAIN_LINES = (
    (("Ask, ", assets.TITLE_WHITE), ("Gear", assets.TITLE_YELLOW)),
)


class TestTitleLettering(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.font = ImageFont.load_default(size=assets.TITLE_FONT_SIZE)
        cls.png = assets.render_title(cls.font, LATIN_LINES)
        with Image.open(BytesIO(cls.png)) as image:
            cls.image = image.copy()
            cls.format = image.format

    def run_main(self, downloader, written, logs, title):
        with (
            patch.object(assets, "CAMPUS_PHOTOS", ()),
            patch.object(assets, "TITLE_IMAGES", (title,)),
            patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
            patch.object(assets, "logo_png", return_value=b"logo"),
            patch.object(assets, "techmo_png", return_value=b"pose"),
        ):
            return assets.main(downloader=downloader,
                               writer=lambda path, data: written.__setitem__(path.name, data),
                               report=logs.append)

    def test_constants_match_the_agreed_values(self):
        # 두 제목 그림은 같은 글꼴 주소·바이트 수·지문을 쓴다. 글귀만 다르다.
        self.assertEqual(assets.TITLE_IMAGES, (
            assets.TitleImage(TITLE_NAME, FONT_URL, 990856, FONT_HASH),
            assets.TitleImage(MAIN_TITLE_NAME, FONT_URL, 990856, FONT_HASH, assets.MAIN_TITLE_LINES),
        ))
        self.assertIsNone(assets.TITLE_IMAGES[0].lines)
        self.assertEqual(assets.MAIN_TITLE_LINES, (
            (("물어봐요, ", (255, 255, 255)), ("테크모", (255, 209, 0))),
        ))
        self.assertEqual(web_main.CHAT_WEB_MEDIA_TYPES[MAIN_TITLE_NAME], "image/png")
        self.assertEqual(assets.MAX_FONT_DOWNLOAD, 2 * 1024 * 1024)
        self.assertLess(assets.TITLE_IMAGES[0].size, assets.MAX_FONT_DOWNLOAD)
        self.assertEqual((assets.TITLE_FONT_SIZE, assets.TITLE_LINE_HEIGHT, assets.TITLE_MARGIN),
                         (172, 1.12, 16))
        # 둘째 줄 들여쓰기는 취소했다.
        self.assertFalse(hasattr(assets, "TITLE_INDENT"))
        self.assertNotIn(RETIRED_TITLE_NAME, web_main.CHAT_WEB_MEDIA_TYPES)
        self.assertEqual(assets.TITLE_LINES, (
            (("졸업까지,", (255, 255, 255)),),
            (("테크모", (255, 209, 0)), ("와 함께", (255, 255, 255))),
        ))
        self.assertEqual(web_main.CHAT_WEB_MEDIA_TYPES[TITLE_NAME], "image/png")
        # 글꼴 파일 자체는 화면에 내려 주지 않는다.
        self.assertFalse([name for name in web_main.CHAT_WEB_MEDIA_TYPES
                          if name.lower().endswith((".ttf", ".otf", ".woff", ".woff2"))])

    def test_title_is_a_transparent_png_cropped_to_the_glyphs_with_margin(self):
        image = self.image
        self.assertEqual((self.format, image.mode), ("PNG", "RGBA"))
        margin = assets.TITLE_MARGIN
        # 글자가 실제로 차지한 영역 바깥에 여백만 남는다.
        self.assertEqual(image.getchannel("A").getbbox(),
                         (margin, margin, image.width - margin, image.height - margin))
        for corner in ((0, 0), (image.width - 1, 0), (0, image.height - 1),
                       (image.width - 1, image.height - 1)):
            self.assertEqual(image.getpixel(corner)[3], 0)
        # 두 줄이므로 높이가 한 줄 간격을 넘고 두 줄 칸보다는 작다.
        size = assets.TITLE_FONT_SIZE
        self.assertGreater(image.height, assets.TITLE_LINE_HEIGHT * size)
        self.assertLess(image.height, (assets.TITLE_LINE_HEIGHT + 1) * size + 2 * margin)

    def test_only_the_marked_word_is_yellow_and_edges_are_not_darkened(self):
        image = self.image
        solid = [(x, y, image.getpixel((x, y))) for y in range(0, image.height, 3)
                 for x in range(0, image.width, 3) if image.getpixel((x, y))[3] > 0]
        colors = {pixel[:3] for _, _, pixel in solid}
        # 반투명한 가장자리 점도 색은 그대로다. 어둡게 섞인 색이 없다.
        self.assertEqual(colors, {assets.TITLE_WHITE, assets.TITLE_YELLOW})
        yellow = [(x, y) for x, y, pixel in solid if pixel[:3] == assets.TITLE_YELLOW]
        white_first_line = [x for x, y, pixel in solid
                            if pixel[:3] == assets.TITLE_WHITE and y < image.height // 3]
        # 노란 글자는 둘째 줄에만 있고, 두 줄은 들여쓰기 없이 같은 왼쪽 끝에서 시작한다.
        self.assertGreater(min(y for _, y in yellow), image.height // 3)
        self.assertLess(abs(min(x for x, _ in yellow) - min(white_first_line)),
                        assets.TITLE_FONT_SIZE // 4)
        # 노란 낱말 오른쪽으로 흰 글자가 이어진다.
        white_second_line = [x for x, y, pixel in solid
                             if pixel[:3] == assets.TITLE_WHITE and y > image.height * 2 // 3]
        self.assertGreater(max(white_second_line), max(x for x, _ in yellow))

    def test_blank_text_is_rejected(self):
        with self.assertRaises(assets.AssetError) as caught:
            assets.render_title(self.font, ((("   ", assets.TITLE_WHITE),),))
        self.assertEqual(str(caught.exception), "제목 글자가 비어 있음")

    def test_font_bytes_and_hash_are_checked_before_the_font_is_opened(self):
        data = b"fictional font"
        digest = sha256(data).hexdigest()
        with patch.object(assets.ImageFont, "truetype", side_effect=AssertionError("열면 안 됨")):
            for candidate, size in ((data, len(data) + 1), (b"", len(data)), (data + b"!", len(data))):
                with self.assertRaises(assets.AssetError) as caught:
                    assets.title_png(candidate, size, digest)
                self.assertEqual(str(caught.exception), "글꼴 바이트 수 불일치")
            with self.assertRaises(assets.AssetError) as caught:
                assets.title_png(b"Fictional font", len(data), digest)
            self.assertEqual(str(caught.exception), "글꼴 지문 불일치")

    def test_unreadable_font_is_rejected_with_a_fixed_reason(self):
        data = b"fictional bytes that are not a font"
        with self.assertRaises(assets.AssetError) as caught:
            assets.title_png(data, len(data), sha256(data).hexdigest())
        self.assertEqual(str(caught.exception), "글꼴을 열 수 없음")

    def test_verified_font_is_opened_at_the_agreed_size_and_drawn(self):
        data = b"fictional font"
        with (
            patch.object(assets.ImageFont, "truetype", return_value=self.font) as opened,
            patch.object(assets, "TITLE_LINES", LATIN_LINES),
            patch.object(assets, "render_title", wraps=assets.render_title) as render,
        ):
            result = assets.title_png(data, len(data), sha256(data).hexdigest())
        (stream, size), _ = opened.call_args
        self.assertEqual(stream.getvalue(), data)
        self.assertEqual(size, 172)
        # 글귀를 넘기지 않으면 로그인 화면 글귀를 그린다.
        render.assert_called_once_with(self.font, None)
        self.assertEqual(result, self.png)
        with Image.open(BytesIO(result)) as image:
            self.assertEqual((image.format, image.mode), ("PNG", "RGBA"))

    def test_given_lines_are_drawn_instead_of_the_login_lines(self):
        data = b"fictional font"
        with patch.object(assets.ImageFont, "truetype", return_value=self.font):
            result = assets.title_png(data, len(data), sha256(data).hexdigest(), LATIN_MAIN_LINES)
        self.assertEqual(result, assets.render_title(self.font, LATIN_MAIN_LINES))
        self.assertNotEqual(result, self.png)

    def test_one_line_title_keeps_the_margin_and_only_the_last_word_is_yellow(self):
        with Image.open(BytesIO(assets.render_title(self.font, LATIN_MAIN_LINES))) as opened:
            image = opened.copy()
        margin = assets.TITLE_MARGIN
        self.assertEqual(image.mode, "RGBA")
        self.assertEqual(image.getchannel("A").getbbox(),
                         (margin, margin, image.width - margin, image.height - margin))
        # 한 줄이라 두 줄 그림보다 낮다.
        self.assertLess(image.height, self.image.height)
        solid = [(x, image.getpixel((x, y))) for y in range(0, image.height, 3)
                 for x in range(0, image.width, 3) if image.getpixel((x, y))[3] > 0]
        self.assertEqual({pixel[:3] for _, pixel in solid},
                         {assets.TITLE_WHITE, assets.TITLE_YELLOW})
        white = [x for x, pixel in solid if pixel[:3] == assets.TITLE_WHITE]
        yellow = [x for x, pixel in solid if pixel[:3] == assets.TITLE_YELLOW]
        # 흰 글자가 왼쪽에서 끝난 뒤에 노란 낱말이 시작한다.
        self.assertLess(max(white), min(yellow))

    def test_main_draws_both_titles_from_one_font_download(self):
        font_bytes = b"fictional font"
        digest = sha256(font_bytes).hexdigest()
        titles = (
            assets.TitleImage(TITLE_NAME, FONT_URL, len(font_bytes), digest),
            assets.TitleImage(MAIN_TITLE_NAME, FONT_URL, len(font_bytes), digest, LATIN_MAIN_LINES),
        )
        written, logs = {}, []
        downloader = Mock(side_effect=lambda url: font_bytes if url == FONT_URL else b"fictional")
        with (
            patch.object(assets, "CAMPUS_PHOTOS", ()),
            patch.object(assets, "TITLE_IMAGES", titles),
            patch.object(assets, "TITLE_LINES", LATIN_LINES),
            patch.object(assets.ImageFont, "truetype", return_value=self.font),
            patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
            patch.object(assets, "logo_png", return_value=b"logo"),
            patch.object(assets, "techmo_png", return_value=b"pose"),
        ):
            code = assets.main(downloader=downloader,
                               writer=lambda path, data: written.__setitem__(path.name, data),
                               report=logs.append)
        self.assertEqual(code, 0)
        self.assertEqual(written[TITLE_NAME], self.png)
        self.assertEqual(written[MAIN_TITLE_NAME], assets.render_title(self.font, LATIN_MAIN_LINES))
        self.assertEqual(logs[-2:], [f"{TITLE_NAME}: 준비 완료", f"{MAIN_TITLE_NAME}: 준비 완료"])
        # 글꼴은 한 번만 받고, 받은 글꼴은 어디에도 쓰지 않는다.
        self.assertEqual(sum(call.args == (FONT_URL,) for call in downloader.call_args_list), 1)
        self.assertNotIn(font_bytes, written.values())
        self.assertFalse([name for name in written if name.endswith(".ttf")])

    def test_font_failure_keeps_both_previous_titles_with_one_request(self):
        written = {TITLE_NAME: b"previous login", MAIN_TITLE_NAME: b"previous main"}
        logs = []
        calls = []

        def fetch(url):
            calls.append(url)
            if url == FONT_URL:
                raise TimeoutError("fictional timeout")
            return b"fictional"

        with (
            patch.object(assets, "CAMPUS_PHOTOS", ()),
            patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
            patch.object(assets, "logo_png", return_value=b"logo"),
            patch.object(assets, "techmo_png", return_value=b"pose"),
        ):
            code = assets.main(downloader=fetch,
                               writer=lambda path, data: written.__setitem__(path.name, data),
                               report=logs.append)
        self.assertEqual(code, 0)
        self.assertEqual(written[TITLE_NAME], b"previous login")
        self.assertEqual(written[MAIN_TITLE_NAME], b"previous main")
        self.assertEqual(logs[-2:], [f"{TITLE_NAME}: 준비 실패 (TimeoutError)",
                                     f"{MAIN_TITLE_NAME}: 준비 실패 (TimeoutError)"])
        # 실패한 받기를 둘째 그림 때문에 다시 하지 않는다.
        self.assertEqual(calls.count(FONT_URL), 1)

    def test_font_download_uses_its_own_host_and_size_limit(self):
        opener = Mock(return_value=FakeResponse(b"fictional", url=FONT_URL))
        self.assertEqual(assets.download(FONT_URL, opener=opener), b"fictional")
        # 사진과 달리 브라우저형 헤더를 붙이지 않는다.
        opener.assert_called_once_with(FONT_URL, timeout=assets.REQUEST_TIMEOUT)
        # 글꼴 한도는 로고용 1MiB와 따로 둔 2MiB다. 넘으면 본문을 읽기 전에 멈춘다.
        between = str(assets.MAX_DOWNLOAD + 1)
        self.assertEqual(assets.download(FONT_URL, opener=lambda *args, **kwargs: FakeResponse(
            b"fictional", url=FONT_URL, headers={"Content-Length": between})), b"fictional")
        too_large = FakeResponse(b"fictional", url=FONT_URL,
                                 headers={"Content-Length": str(assets.MAX_FONT_DOWNLOAD + 1)})
        too_large.read1 = Mock(side_effect=AssertionError("읽으면 안 됨"))
        with self.assertRaises(assets.AssetError):
            assets.download(FONT_URL, opener=lambda *args, **kwargs: too_large)
        # 로고의 한도는 그대로 1MiB다.
        with self.assertRaises(assets.AssetError):
            assets.download(assets.LOGO_URL, opener=lambda *args, **kwargs: FakeResponse(
                b"fictional", headers={"Content-Length": between}))

    def test_font_and_official_hosts_do_not_stand_in_for_each_other(self):
        # 글꼴 요청이 학교 주소로, 학교 요청이 글꼴 저장소로 옮겨 가면 받지 않는다.
        with self.assertRaises(assets.AssetError):
            assets.download(FONT_URL, opener=lambda *args, **kwargs: FakeResponse(
                b"", url="https://www.kumoh.ac.kr/font.ttf"))
        with self.assertRaises(assets.AssetError):
            assets.download(assets.LOGO_URL, opener=lambda *args, **kwargs: FakeResponse(
                b"", url=FONT_URL))
        font_redirect = assets.OfficialRedirect(host=assets.FONT_HOST)
        for url in ("https://www.kumoh.ac.kr/a", "http://raw.githubusercontent.com/a",
                    "https://raw.githubusercontent.com.evil.invalid/a",
                    "https://github.com/google/fonts"):
            with self.subTest(url=url), self.assertRaises(assets.AssetError):
                font_redirect.redirect_request(None, None, 302, "", {}, url)
        with self.assertRaises(assets.AssetError):
            assets.OfficialRedirect().redirect_request(None, None, 302, "", {}, FONT_URL)
        # 같은 저장소의 다른 파일이나 다른 커밋은 허용한 원본이 아니다.
        opener = Mock()
        for other in (FONT_URL.replace("16680f86", "00000000"), FONT_URL + "?raw=1",
                      FONT_URL.replace("Regular", "Bold"), RETIRED_FONT_URL):
            with self.subTest(other=other), self.assertRaises(assets.AssetError):
                assets.download(other, opener=opener)
        opener.assert_not_called()

    def test_main_writes_the_title_and_never_the_font(self):
        font_bytes = b"fictional font"
        title = assets.TitleImage(TITLE_NAME, FONT_URL, len(font_bytes),
                                  sha256(font_bytes).hexdigest())
        written, logs = {}, []
        downloader = Mock(side_effect=lambda url: font_bytes if url == FONT_URL else b"fictional")
        with (
            patch.object(assets.ImageFont, "truetype", return_value=self.font),
            patch.object(assets, "TITLE_LINES", LATIN_LINES),
        ):
            self.assertEqual(self.run_main(downloader, written, logs, title), 0)
        self.assertEqual(written[TITLE_NAME], self.png)
        self.assertIn(f"{TITLE_NAME}: 준비 완료", logs)
        self.assertEqual(len(logs), 7)
        self.assertNotIn(font_bytes, written.values())
        self.assertFalse([name for name in written if name.endswith(".ttf")])
        self.assertEqual(sum(call.args == (FONT_URL,) for call in downloader.call_args_list), 1)

    def test_title_failure_keeps_the_previous_file_and_the_rest_continue(self):
        title = assets.TITLE_IMAGES[0]
        for label, outcome in (("timeout", TimeoutError("fictional timeout")),
                               ("html", b"<html>fictional error</html>")):
            with self.subTest(label=label):
                written, logs = {TITLE_NAME: b"previous"}, []

                def fetch(url):
                    if url != FONT_URL:
                        return b"fictional"
                    if isinstance(outcome, Exception):
                        raise outcome
                    return outcome

                self.assertEqual(self.run_main(fetch, written, logs, title), 0)
                self.assertEqual(written[TITLE_NAME], b"previous")
                self.assertEqual(written["kumoh-signature.png"], b"logo")
                self.assertEqual([line for line in logs if "준비 실패" in line],
                                 [logs[-1]])
                self.assertTrue(logs[-1].startswith(f"{TITLE_NAME}: 준비 실패 ("))
                self.assertNotIn("fictional timeout", logs[-1])


class TestBrandPreparation(unittest.TestCase):
    def setUp(self):
        # 이 묶음은 로고와 테크모만 본다. 사진 네 장은 TestCampusPhotos가, 제목 그림은 TestTitleLettering이 맡는다.
        for name in ("CAMPUS_PHOTOS", "TITLE_IMAGES"):
            patcher = patch.object(assets, name, ())
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_sprite_geometry_order_transparency_and_no_upscaling(self):
        sizes = ((468, 414), (140, 183), (140, 181), (159, 145), (159, 170))
        colors = ('red', 'green', 'blue', 'orange', 'purple')
        poses = []
        for size, color in zip(sizes, colors):
            image = Image.new('RGBA', (size[0] + 8, size[1] + 8))
            image.paste(Image.new('RGBA', size, color), (4, 4))
            output = BytesIO()
            image.save(output, format='PNG')
            poses.append(output.getvalue())
        with patch.object(assets, 'techmo_png', side_effect=poses) as convert:
            result = assets.techmo_sprite_png(b'fictional source')
        self.assertEqual([call.kwargs['pose'] for call in convert.call_args_list],
                         ['basic', 'quiet', 'guide', 'celebrate', 'concert'])
        with Image.open(BytesIO(result)) as sheet:
            self.assertEqual(sheet.size, (960, 192))
            self.assertEqual(sheet.mode, 'RGBA')
            for index, size in enumerate(sizes):
                cell = sheet.crop((index * 192, 0, (index + 1) * 192, 192))
                expected = Image.new('RGBA', size, colors[index])
                expected.thumbnail((184, 184), Image.Resampling.LANCZOS)
                left = (192 - expected.width) // 2
                self.assertEqual(cell.getbbox(), (left, 188 - expected.height,
                                                 left + expected.width, 188))
                self.assertEqual(cell.getpixel((96, 187)), expected.getpixel((expected.width // 2, 0)))
                self.assertEqual(cell.getpixel((0, 191))[3], 0)

    def test_sprite_failure_preserves_existing_result(self):
        for failure in ('hash', 'pose', 'write'):
            with self.subTest(failure=failure):
                written = {'techmo-sprite.png': b'previous sprite'}

                def convert(data, *, pose='basic'):
                    if failure == 'hash' or (failure == 'pose' and pose == 'concert'):
                        raise assets.AssetError('가상 변환 실패')
                    return image_bytes((20, 20))

                def writer(path, data):
                    if failure == 'write' and path.name == 'techmo-sprite.png':
                        raise OSError('fictional write failure')
                    written[path.name] = data

                with patch.object(assets, 'logo_png', return_value=b'logo'), patch.object(assets, 'techmo_png', side_effect=convert):
                    self.assertEqual(assets.main(downloader=lambda url: b'fictional',
                                                 writer=writer, report=lambda line: None), 0)
                self.assertEqual(written['techmo-sprite.png'], b'previous sprite')

    def test_logo_uses_hash_instead_of_filename(self):
        png = image_bytes((782, 113))
        result = assets.logo_png(archive_bytes(png), sha256(png).hexdigest())
        self.assertEqual(result, png)

    def test_logo_rejects_hash_mismatch_and_wrong_dimensions(self):
        png = image_bytes((782, 113))
        with self.assertRaises(ValueError):
            assets.logo_png(archive_bytes(png), "0" * 64)
        wrong = image_bytes((781, 113))
        with self.assertRaises(ValueError):
            assets.logo_png(archive_bytes(wrong), sha256(wrong).hexdigest())

    def test_oversized_archive_entry_is_not_read(self):
        png = image_bytes((782, 113))
        with (
            patch.object(assets, "MAX_ENTRY", 1),
            patch.object(ZipFile, "open", side_effect=AssertionError("읽으면 안 됨")),
        ):
            # 묶음 생성은 검사 범위 밖에서 끝내 둠.
            with self.assertRaises(ValueError):
                assets.logo_png(self.logo_archive, sha256(png).hexdigest())

    @classmethod
    def setUpClass(cls):
        cls.logo_archive = archive_bytes(image_bytes((782, 113)))

    def test_techmo_crop_and_enclosed_eye_white(self):
        jpg = image_bytes((1198, 767), "JPEG")
        result = assets.techmo_png(jpg, sha256(jpg).hexdigest())
        with Image.open(BytesIO(result)) as image:
            self.assertEqual(image.format, "PNG")
            self.assertEqual(image.size, (468, 414))
            self.assertEqual(image.getpixel((0, 0))[3], 0)
            self.assertEqual(image.getpixel((290 - 144, 290 - 142))[3], 255)
            self.assertEqual(image.getpixel((245 - 144, 245 - 142))[3], 255)

    def test_pose_crops_include_end_pixels_and_preserve_enclosed_white(self):
        jpg = image_bytes((1198, 767), "JPEG")
        for pose, box, size in POSE_CASES:
            with self.subTest(pose=pose):
                result = assets.techmo_png(jpg, sha256(jpg).hexdigest(), pose=pose)
                with Image.open(BytesIO(result)) as image:
                    self.assertEqual(image.format, "PNG")
                    self.assertEqual(image.size, size)
                    self.assertEqual(image.getpixel((0, 0))[3], 0)
                    self.assertEqual(image.getpixel((25, 25))[3], 255)
                    self.assertEqual(image.getpixel((55, 55))[3], 255)
                    self.assertGreater(min(image.getpixel((55, 55))[:3]), 230)
                    self.assertEqual(image.getpixel((size[0] - 1, size[1] - 1))[3], 255)

    def test_techmo_hash_and_dimensions_are_checked(self):
        jpg = image_bytes((1198, 767), "JPEG")
        with self.assertRaises(ValueError):
            assets.techmo_png(jpg, "0" * 64)
        wrong = image_bytes((1197, 767), "JPEG")
        with self.assertRaises(ValueError):
            assets.techmo_png(wrong, sha256(wrong).hexdigest())

    def test_broken_images_and_archive_are_rejected(self):
        broken = b"fictional broken image"
        with self.assertRaises(BadZipFile):
            assets.logo_png(broken)
        with self.assertRaises(UnidentifiedImageError):
            assets.logo_png(archive_bytes(broken), sha256(broken).hexdigest())
        with self.assertRaises(UnidentifiedImageError):
            assets.techmo_png(broken, sha256(broken).hexdigest())

    def test_download_uses_fake_response_and_request_timeout(self):
        opener = Mock(return_value=FakeResponse(b"fictional"))
        self.assertEqual(assets.download(assets.LOGO_URL, opener=opener), b"fictional")
        opener.assert_called_once_with(assets.LOGO_URL, timeout=assets.REQUEST_TIMEOUT)

    def test_download_rejects_declared_and_streamed_size_overflow(self):
        for headers in ({"Content-Length": "100"}, {}):
            with self.subTest(headers=headers):
                with self.assertRaises(ValueError):
                    assets.download(
                        assets.LOGO_URL,
                        opener=lambda *args, **kwargs: FakeResponse(b"12345", headers=headers),
                        limit=4,
                    )

    def test_request_and_total_timeouts(self):
        with self.assertRaises(TimeoutError):
            assets.download(assets.LOGO_URL, opener=Mock(side_effect=TimeoutError))
        for times in ((0, assets.TOTAL_TIMEOUT), (0, 0, assets.TOTAL_TIMEOUT)):
            with self.subTest(times=times):
                with self.assertRaises(TimeoutError):
                    assets.download(
                        assets.LOGO_URL,
                        opener=lambda *args, **kwargs: FakeResponse(b"123"),
                        clock=Mock(side_effect=times),
                    )

    def test_next_socket_read_uses_remaining_total_time(self):
        response = FakeResponse(b"fictional")
        response.fp = Mock()
        response.fp.raw._sock = Mock()
        times = iter((0, assets.TOTAL_TIMEOUT - 1, assets.TOTAL_TIMEOUT - 0.5,
                      assets.TOTAL_TIMEOUT - 0.5, assets.TOTAL_TIMEOUT - 0.25))
        result = assets.download(assets.LOGO_URL,
                                 opener=lambda *args, **kwargs: response,
                                 clock=lambda: next(times))
        self.assertEqual(result, b"fictional")
        self.assertEqual(response.fp.raw._sock.settimeout.call_args_list[0].args, (1,))

    def test_only_official_source_and_redirect_origin_are_allowed(self):
        opener = Mock()
        with self.assertRaises(ValueError):
            assets.download("https://example.invalid/source", opener=opener)
        opener.assert_not_called()
        with self.assertRaises(ValueError):
            assets.download(
                assets.LOGO_URL,
                opener=lambda *args, **kwargs: FakeResponse(b"", url="https://example.invalid/"),
            )
        for url in ("http://www.kumoh.ac.kr/a", "https://www.kumoh.ac.kr.evil.invalid/a"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                assets.OfficialRedirect().redirect_request(None, None, 302, "", {}, url)

    def test_main_success_writes_only_validated_results_to_memory(self):
        png = image_bytes((782, 113))
        jpg = image_bytes((1198, 767), "JPEG")
        written = {}
        logs = []
        original_logo, original_techmo = assets.logo_png, assets.techmo_png
        downloader = Mock(side_effect=lambda url: archive_bytes(png) if url == assets.LOGO_URL else jpg)
        with (
            patch.object(assets, "logo_png", lambda data: original_logo(data, sha256(png).hexdigest())),
            patch.object(assets, "techmo_png", lambda data, **kwargs: original_techmo(data, sha256(jpg).hexdigest(), **kwargs)),
        ):
            code = assets.main(
                downloader=downloader,
                writer=lambda path, data: written.__setitem__(path.name, data),
                report=logs.append,
            )
        self.assertEqual(code, 0)
        self.assertEqual(set(written), set(BRAND_NAMES))
        self.assertEqual(len(logs), 6)
        self.assertEqual(downloader.call_count, 2)
        self.assertEqual(sum(call.args == (assets.TECHMO_URL,) for call in downloader.call_args_list), 1)

    def test_one_failure_keeps_previous_file_and_other_asset_succeeds(self):
        for failed_url in (assets.LOGO_URL, assets.TECHMO_URL):
            with self.subTest(failed_url=failed_url):
                written = {"kumoh-signature.png": b"previous logo", "techmo-basic.png": b"previous techmo"}
                logs = []

                def fetch(url):
                    if url == failed_url:
                        raise TimeoutError("fictional timeout")
                    return b"fictional input"

                with (
                    patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
                    patch.object(assets, "logo_png", return_value=b"new logo"),
                    patch.object(assets, "techmo_png", return_value=b"new techmo"),
                ):
                    code = assets.main(downloader=fetch,
                                       writer=lambda path, data: written.__setitem__(path.name, data),
                                       report=logs.append)
                self.assertEqual(code, 0)
                failed_name = "kumoh-signature.png" if failed_url == assets.LOGO_URL else "techmo-basic.png"
                self.assertTrue(written[failed_name].startswith(b"previous"))
                failures = 1 if failed_url == assets.LOGO_URL else 5
                self.assertEqual(sum("준비 실패" in line for line in logs), failures)
                self.assertEqual(sum("준비 완료" in line for line in logs), 6 - failures)

    def test_pose_failure_preserves_previous_file_and_rerun_recovers(self):
        written = {name: b"previous" for name in BRAND_NAMES}
        logs = []

        def convert(data, *, pose="basic"):
            if pose == "quiet":
                raise assets.AssetError("가상 자세 변환 실패")
            return pose.encode("ascii")

        def writer(path, data):
            written[path.name] = data

        with (
            patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
            patch.object(assets, "logo_png", return_value=b"logo"),
            patch.object(assets, "techmo_png", side_effect=convert),
        ):
            self.assertEqual(assets.main(downloader=lambda url: b"fictional", writer=writer,
                                         report=logs.append), 0)
        self.assertEqual(written["techmo-quiet.png"], b"previous")
        self.assertEqual(written["techmo-guide.png"], b"guide")
        self.assertEqual(written["techmo-celebrate.png"], b"celebrate")
        self.assertEqual(sum("준비 실패" in line for line in logs), 1)
        with (
            patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
            patch.object(assets, "logo_png", return_value=b"logo"),
            patch.object(assets, "techmo_png", side_effect=lambda data, *, pose="basic": pose.encode("ascii")),
        ):
            for _ in range(2):
                self.assertEqual(assets.main(downloader=lambda url: b"fictional", writer=writer,
                                             report=lambda line: None), 0)
        self.assertEqual(written["techmo-quiet.png"], b"quiet")
        self.assertEqual(set(written), set(BRAND_NAMES))

    def test_pose_write_failure_does_not_stop_later_poses(self):
        written = {"techmo-guide.png": b"previous guide"}
        logs = []

        def writer(path, data):
            if path.name == "techmo-guide.png":
                raise OSError("fictional write failure")
            written[path.name] = data

        with (
            patch.object(assets, "techmo_sprite_png", return_value=b"sprite"),
            patch.object(assets, "logo_png", return_value=b"logo"),
            patch.object(assets, "techmo_png", return_value=b"pose"),
        ):
            self.assertEqual(assets.main(downloader=lambda url: b"fictional", writer=writer,
                                         report=logs.append), 0)
        self.assertEqual(written["techmo-guide.png"], b"previous guide")
        self.assertEqual(written["techmo-celebrate.png"], b"pose")
        self.assertEqual(sum("준비 실패" in line for line in logs), 1)

    def test_invalid_source_never_reaches_writer_and_returns_zero(self):
        writer = Mock()
        logs = []
        self.assertEqual(assets.main(downloader=lambda url: b"fictional invalid source",
                                     writer=writer, report=logs.append), 0)
        writer.assert_not_called()
        self.assertEqual(len(logs), 6)
        self.assertTrue(all("준비 실패" in line for line in logs))

    def test_failure_reason_is_specific_without_external_exception_text(self):
        logs = []
        with patch.object(assets, "logo_png", side_effect=assets.AssetError("로고 지문 불일치")):
            assets.main(downloader=lambda url: b"fictional", writer=Mock(), report=logs.append)
        self.assertIn("로고 지문 불일치", logs[0])
        logs.clear()
        assets.main(downloader=Mock(side_effect=OSError("private detail")),
                    writer=Mock(), report=logs.append)
        self.assertEqual(len(logs), 6)
        self.assertTrue(all("OSError" in line and "private detail" not in line for line in logs))

    def test_atomic_write_replaces_only_after_complete_write(self):
        destination = Path("virtual-assets/techmo-basic.png")
        stream = Mock()
        stream.name = "virtual-assets/temporary"
        stream.__enter__ = Mock(return_value=stream)
        stream.__exit__ = Mock(return_value=False)
        events = []
        stream.write.side_effect = lambda data: events.append(("write", data))
        with (
            patch.object(assets, "NamedTemporaryFile", return_value=stream),
            patch.object(Path, "replace", side_effect=lambda path: events.append(("replace", path))),
            patch.object(Path, "unlink") as unlink,
        ):
            assets.atomic_write(destination, b"verified")
            self.assertEqual(events, [("write", b"verified"), ("replace", destination)])
            unlink.assert_called_once_with(missing_ok=True)

    def test_failed_write_does_not_replace_destination(self):
        stream = Mock()
        stream.name = "virtual-assets/temporary"
        stream.__enter__ = Mock(return_value=stream)
        stream.__exit__ = Mock(return_value=False)
        stream.write.side_effect = OSError("fictional write error")
        with (
            patch.object(assets, "NamedTemporaryFile", return_value=stream),
            patch.object(Path, "replace") as replace,
            patch.object(Path, "unlink"),
        ):
            with self.assertRaises(OSError):
                assets.atomic_write(Path("virtual-assets/techmo-basic.png"), b"verified")
            replace.assert_not_called()


class TestBrandAssetRoutes(unittest.TestCase):
    def test_missing_brand_assets_return_404(self):
        with patch.object(Path, "is_file", return_value=False):
            for name in BRAND_NAMES:
                with self.subTest(name=name):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 404)
                    self.assertEqual(response.headers['cache-control'], 'no-cache')

    def test_existing_brand_assets_have_png_media_type(self):
        png = image_bytes((2, 2))

        def memory_response(path, *, media_type, headers):
            self.assertIn(path.name, BRAND_NAMES)
            return web_main.Response(content=png, media_type=media_type, headers=headers)

        with (
            patch.object(Path, "is_file", return_value=True),
            patch.object(web_main, "FileResponse", side_effect=memory_response),
        ):
            for name in BRAND_NAMES:
                with self.subTest(name=name):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers["content-type"], "image/png")
                    self.assertEqual(response.body, png)
                    self.assertEqual(response.headers['cache-control'], 'no-cache')

    def test_missing_campus_photos_return_404(self):
        with patch.object(Path, "is_file", return_value=False):
            for name in PHOTO_NAMES:
                with self.subTest(name=name):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 404)
                    self.assertEqual(response.headers['cache-control'], 'no-cache')

    def test_existing_campus_photos_have_jpeg_media_type(self):
        jpg = photo_bytes("navy", size=(2, 2))

        def memory_response(path, *, media_type, headers):
            self.assertIn(path.name, PHOTO_NAMES)
            return web_main.Response(content=jpg, media_type=media_type, headers=headers)

        with (
            patch.object(Path, "is_file", return_value=True),
            patch.object(web_main, "FileResponse", side_effect=memory_response),
        ):
            for name in PHOTO_NAMES:
                with self.subTest(name=name):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers["content-type"], "image/jpeg")
                    self.assertEqual(response.body, jpg)
                    self.assertEqual(response.headers['cache-control'], 'no-cache')

    def test_title_lettering_is_served_as_png_and_missing_file_is_404(self):
        png = image_bytes((2, 2))
        served = []

        def memory_response(path, *, media_type, headers):
            served.append(path.name)
            return web_main.Response(content=png, media_type=media_type, headers=headers)

        for name in (TITLE_NAME, MAIN_TITLE_NAME):
            with self.subTest(name=name):
                with patch.object(Path, "is_file", return_value=False):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 404)
                    self.assertEqual(response.headers['cache-control'], 'no-cache')
                with (
                    patch.object(Path, "is_file", return_value=True),
                    patch.object(web_main, "FileResponse", side_effect=memory_response),
                ):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers["content-type"], "image/png")
                    self.assertEqual(response.body, png)
                    self.assertEqual(response.headers['cache-control'], 'no-cache')
        self.assertEqual(served, [TITLE_NAME, MAIN_TITLE_NAME])
        # 글꼴 파일 이름과 취소한 붓글씨 그림 이름으로는 아무것도 내주지 않는다.
        with patch.object(Path, "is_file", side_effect=AssertionError("읽으면 안 됨")):
            for name in ("Gugi-Regular.ttf", "title-lettering.ttf", "main-lettering.ttf",
                         RETIRED_TITLE_NAME):
                with self.subTest(name=name):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 404)

    def test_requests_from_the_retired_and_current_title_paths(self):
        # 화면이 옛 주소를 부르면 그림을 준비해 두어도 404다. 새 주소만 그림에 닿는다.
        png = image_bytes((2, 2))
        with (
            patch.object(Path, "is_file", return_value=True),
            patch.object(web_main, "FileResponse", side_effect=lambda path, *, media_type, headers:
                         web_main.Response(content=png, media_type=media_type, headers=headers)),
        ):
            statuses = {name: call_app(web_main.app, "GET", f"/chat-assets/{name}",
                                       allow_wait=True).status
                        for name in (RETIRED_TITLE_NAME, TITLE_NAME)}
        self.assertEqual(statuses, {RETIRED_TITLE_NAME: 404, TITLE_NAME: 200})

    def test_unlisted_photo_names_are_404_without_touching_the_disk(self):
        with patch.object(Path, "is_file", side_effect=AssertionError("읽으면 안 됨")):
            for name in ("campus-other.jpg", "campus-aerial.jpeg", "CAMPUS-AERIAL.JPG",
                         "campus-aerial.png"):
                with self.subTest(name=name):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 404)


# 화면 파일에 적힌 `/chat-assets/<파일 이름>` 주소. `?v=` 같은 뒤쪽 값은 이름에 넣지 않는다.
# 이름은 글자나 숫자로 끝난다. 설명 글에서 주소 뒤에 붙은 마침표를 이름으로 읽지 않기 위해서다.
_ASSET_ADDRESS = re.compile(r"/chat-assets/([A-Za-z0-9._-]*[A-Za-z0-9])")


def asset_names(text):
    return _ASSET_ADDRESS.findall(text)


class AssetReferences(HTMLParser):
    """HTML 태그의 속성 값에 적힌 화면 파일 주소를 모은다."""

    def __init__(self):
        super().__init__()
        self.names = []

    def handle_starttag(self, tag, attrs):
        for _, value in attrs:
            self.names.extend(asset_names(value or ""))


def html_asset_names(html):
    parser = AssetReferences()
    parser.feed(html)
    parser.close()
    return parser.names


def unlisted(names):
    """서버가 내주지 않는 이름만 순서대로 돌려준다."""
    return [name for name in names if name not in web_main.CHAT_WEB_MEDIA_TYPES]


class TestScreenAssetReferences(unittest.TestCase):
    """화면이 요청하는 그림 주소와 서버의 허용 목록이 어긋나지 않는지 본다.

    두 목록은 서로 다른 파일에 따로 적혀 있다. 한쪽 이름만 바뀌면 그림을 준비해 두어도
    화면의 요청이 404가 된다. 붓글씨 그림 이름을 `title-lettering.png`으로 바꿀 때 이
    어긋남이 두 번 났다. 그래서 화면 파일을 직접 읽어 허용 목록과 견준다.
    """

    def test_reader_finds_addresses_in_markup_styles_and_script(self):
        html = ('<link rel="stylesheet" href="/chat-assets/chat.css?v=abc">'
                '<img src="/chat-assets/kumoh-signature.png" alt="">'
                '<img srcset="/chat-assets/a.png 1x, /chat-assets/b.png 2x" alt="">'
                '<p>/chat-assets/in-text.png</p>')
        self.assertEqual(html_asset_names(html),
                         ["chat.css", "kumoh-signature.png", "a.png", "b.png"])
        self.assertEqual(asset_names('.pet { background: url("/chat-assets/techmo-sprite.png"); }'),
                         ["techmo-sprite.png"])
        self.assertEqual(asset_names("fetch('/chat-assets/campus-aerial.jpg'); '/chat-assets/' + name"),
                         ["campus-aerial.jpg"])
        self.assertEqual(asset_names("// 그림은 /chat-assets/techmo-sprite.png. 한 장이다."),
                         ["techmo-sprite.png"])

    def test_retired_title_address_is_reported_and_current_one_is_not(self):
        # 기존 재현 사례: 화면이 취소한 붓글씨 그림 주소를 그대로 요청한다.
        retired = f'<img src="/chat-assets/{RETIRED_TITLE_NAME}" alt="졸업까지, 테크모와 함께">'
        self.assertEqual(unlisted(html_asset_names(retired)), [RETIRED_TITLE_NAME])
        # 최신 사례: 새 주소는 허용 목록에 있다.
        current = f'<img src="/chat-assets/{TITLE_NAME}" alt="졸업까지, 테크모와 함께">'
        self.assertEqual(unlisted(html_asset_names(current)), [])
        # 스타일과 스크립트에 적힌 주소도 같은 기준으로 본다.
        self.assertEqual(unlisted(asset_names(f'url("/chat-assets/{RETIRED_TITLE_NAME}")')),
                         [RETIRED_TITLE_NAME])
        self.assertEqual(unlisted(asset_names(
            "'/chat-assets/campus-aerial.jpg', '/chat-assets/campus-other.jpg'")),
            ["campus-other.jpg"])

    def test_every_address_the_screen_requests_is_served(self):
        read = lambda *parts: web_main.CHAT_WEB_DIR.joinpath(*parts).read_text(encoding="utf-8")
        requested = {
            "index.html": html_asset_names(read("index.html")),
            "chat.css": asset_names(read("assets", "chat.css")),
            "chat.js": asset_names(read("assets", "chat.js")),
        }
        # 화면은 적어도 스타일·스크립트·로고를 요청한다. 빈 목록이면 읽기가 잘못된 것이다.
        self.assertTrue({"chat.css", "chat.js", "kumoh-signature.png"} <= set(requested["index.html"]))
        for source, names in requested.items():
            with self.subTest(source=source):
                self.assertEqual(unlisted(names), [],
                                 f"{source}이 요청하는 주소가 서버 허용 목록에 없습니다.")


if __name__ == "__main__":
    unittest.main()
