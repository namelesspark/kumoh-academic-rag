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


class TestBrandPreparation(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
