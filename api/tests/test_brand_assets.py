"""가상 그림과 응답만으로 공식 그림 준비와 제공을 확인함."""

from hashlib import sha256
from io import BytesIO
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch
from zipfile import BadZipFile, ZipFile

from PIL import Image, ImageDraw, UnidentifiedImageError

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
        self.assertLess(assets.PHOTO_TOTAL_TIMEOUT, assets.TOTAL_TIMEOUT)
        # 값이 달라야 사진 요청이 로고용 한도를 잘못 쓰는 실수가 아래 단언에 걸린다.
        self.assertLess(assets.PHOTO_REQUEST_TIMEOUT, assets.REQUEST_TIMEOUT)
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
        # 같은 시각이어도 로고는 자기 한도 안이라 끝까지 읽는다.
        times = iter((0, assets.PHOTO_TOTAL_TIMEOUT, assets.PHOTO_TOTAL_TIMEOUT,
                      assets.PHOTO_TOTAL_TIMEOUT, assets.PHOTO_TOTAL_TIMEOUT))
        self.assertEqual(assets.download(assets.LOGO_URL,
                                         opener=lambda *args, **kwargs: FakeResponse(b"123"),
                                         clock=lambda: next(times)), b"123")

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
        # 진짜 지문에는 가상 그림이 맞을 수 없다. 사진 네 줄 모두 실패하고 종료 코드는 0이다.
        writer, logs = Mock(), []
        self.assertEqual(assets.main(downloader=lambda url: self.sources[0],
                                     writer=writer, report=logs.append), 0)
        writer.assert_not_called()
        self.assertEqual(len(logs), 10)
        self.assertEqual([line.split(":")[0] for line in logs[6:]], list(PHOTO_NAMES))
        self.assertTrue(all("준비 실패" in line for line in logs))


class TestBrandPreparation(unittest.TestCase):
    def setUp(self):
        # 이 묶음은 로고와 테크모만 본다. 사진 네 장은 TestCampusPhotos가 맡는다.
        patcher = patch.object(assets, "CAMPUS_PHOTOS", ())
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

    def test_unlisted_photo_names_are_404_without_touching_the_disk(self):
        with patch.object(Path, "is_file", side_effect=AssertionError("읽으면 안 됨")):
            for name in ("campus-other.jpg", "campus-aerial.jpeg", "CAMPUS-AERIAL.JPG",
                         "campus-aerial.png"):
                with self.subTest(name=name):
                    response = call_app(web_main.app, "GET", f"/chat-assets/{name}", allow_wait=True)
                    self.assertEqual(response.status, 404)


if __name__ == "__main__":
    unittest.main()
