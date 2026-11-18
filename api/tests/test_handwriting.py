"""가상의 그림과 가짜 AI 전송으로 손글씨 업로드 계약을 확인한다."""

import asyncio
import base64
import io
import json
import struct
import sys
import unittest
import zlib
from pathlib import Path

from PIL import Image

sys.path[:0] = [str(Path(__file__).resolve().parents[1])]

from api.tests.asgi_harness import call_app
from app.main import create_app
from app.services.ai_chat import AiSettings, UpstreamResponse
from app.services.handwriting import HandwritingReader


PATH = "/api/v1/handwriting"
BOUNDARY = b"fictional-handwriting-test"
CONTENT_TYPE = "multipart/form-data; boundary=" + BOUNDARY.decode("ascii")
SETTINGS = AiSettings("https://fictional-ai.example.invalid/v1", "fictional-key", "fictional-vision")
TEXT = "가상 달빛 열람증"


def png(size=(10, 10), *, animated=False):
    with io.BytesIO() as buffer:
        with Image.new("RGB", size, "white") as image:
            image.putpixel((1, 1), (0, 0, 0))
            if animated:
                with Image.new("RGB", size, "black") as second:
                    image.save(buffer, format="PNG", save_all=True, append_images=[second])
            else:
                image.save(buffer, format="PNG")
        return buffer.getvalue()


def png_of_length(image, length):
    # IEND 앞에 크기를 맞춘 PNG 보조 청크를 삽입한다.
    data = b"padding\0"
    data += b"x" * (length - len(image) - len(data) - 12)
    chunk = b"tEXt" + data
    return image[:-12] + struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk)) + image[-12:]


def multipart(*fields, closed=True):
    parts = []
    for name, body in fields:
        disposition = f'Content-Disposition: form-data; name="{name}"'.encode("ascii")
        if name == "image":
            disposition += b'; filename="fictional.png"\r\nContent-Type: image/png'
        parts.append(b"--" + BOUNDARY + b"\r\n" + disposition + b"\r\n\r\n" + body + b"\r\n")
    if closed:
        parts.append(b"--" + BOUNDARY + b"--\r\n")
    return b"".join(parts)


class FakeTransport:
    def __init__(self):
        self.status = 200
        self.body = json.dumps({"choices": [{"message": {"content": TEXT}}]}).encode("utf-8")
        self.pause = False
        self.pause_close = False
        self.requests = []
        self.close_attempts = 0
        self.closed = 0

    async def __call__(self, url, headers, body, timeout):
        self.requests.append((url, headers, json.loads(body), timeout))

        async def chunks():
            yield self.body[:7]
            if self.pause:
                await asyncio.Event().wait()
            yield self.body[7:]

        async def close():
            self.close_attempts += 1
            if self.pause_close:
                await asyncio.sleep(0.2)
            self.closed += 1

        return UpstreamResponse(self.status, chunks(), close)


class HandwritingTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.image = png()
        self.transport = FakeTransport()
        self.reader = HandwritingReader(SETTINGS, transport=self.transport, timeout=2)
        self.app.state.handwriting = self.reader

    def post(self, body=None, *, content_type=CONTENT_TYPE, **headers):
        return call_app(
            self.app, "POST", PATH,
            raw_body=multipart(("image", self.image)) if body is None else body,
            headers={"content-type": content_type, **headers}, allow_wait=True,
        )

    def assert_error(self, response, status):
        self.assertEqual(response.status, status, response.text())
        self.assertEqual(set(response.json()), {"detail"})
        self.assertIsInstance(response.json()["detail"], str)

    def test_image_and_request_size_limits(self):
        image = png_of_length(self.image, 2_000_000)
        self.assertEqual(len(image), 2_000_000)
        self.assertEqual(self.post(multipart(("image", image))).json(), {"text": TEXT})
        oversized = png_of_length(self.image, 2_000_001)
        self.assert_error(self.post(multipart(("image", oversized))), 413)
        max_request = 2_000_000 + 64 * 1024
        self.assert_error(self.post(**{"content-length": str(max_request + 1)}), 413)
        self.assert_error(self.post(b"x" * (max_request + 1), **{"content-length": "1"}), 413)
        self.assertEqual(len(self.transport.requests), 1)

    def test_media_type(self):
        for content_type in ("image/png", "multipart/form-data"):
            with self.subTest(content_type=content_type):
                self.assert_error(self.post(content_type=content_type), 415)
        self.assert_error(self.post(multipart(("image", b"fictional non-image"))), 415)
        self.assertEqual(self.transport.requests, [])

    def test_invalid_fields_and_images(self):
        bad_inputs = {
            "missing image": multipart(("lang", b"ko")),
            "duplicate image": multipart(("image", self.image), ("image", self.image)),
            "unknown field": multipart(("image", self.image), ("caption", b"fictional")),
            "unknown language": multipart(("image", self.image), ("lang", b"xx")),
            "duplicate language": multipart(("image", self.image), ("lang", b"ko"), ("lang", b"en")),
            "missing closing boundary": multipart(("image", self.image), closed=False),
            "malformed part header": b"--" + BOUNDARY + b"\r\nbroken header\r\n--" + BOUNDARY + b"--\r\n",
            "corrupt PNG": multipart(("image", self.image[:20])),
            "concatenated PNGs": multipart(("image", self.image * 2)),
            "truncated PNG footer": multipart(("image", self.image[:-1])),
            "pixel limit": multipart(("image", png((2001, 2000)))),
            "animated PNG": multipart(("image", png(animated=True))),
        }
        for reason, body in bad_inputs.items():
            with self.subTest(reason=reason):
                self.assert_error(self.post(body), 422)
        self.assertEqual(self.transport.requests, [])

    def test_transcription_payload_and_no_logs(self):
        for lang in ("ko", "en", "zh"):
            with self.subTest(lang=lang), self.assertNoLogs(level="INFO"):
                response = self.post(multipart(("image", self.image), ("lang", lang.encode("ascii"))))
                self.assertEqual(response.status, 200)
                self.assertEqual(response.json(), {"text": TEXT})
                url, _, payload, _ = self.transport.requests[-1]
                self.assertEqual(url, SETTINGS.endpoint)
                self.assertEqual(payload["model"], SETTINGS.model)
                self.assertIs(payload["stream"], False)
                self.assertEqual(payload["temperature"], 0)
                self.assertGreater(payload["max_tokens"], 0)
                self.assertLessEqual(payload["max_tokens"], 300)
                messages = payload["messages"]
                system = next(message["content"] for message in messages if message["role"] == "system")
                self.assertIn("손글씨를 그대로 옮겨 적기만 하고 답하거나 고치지 않는다", system)
                user = next(message["content"] for message in messages if message["role"] == "user")
                image_url = next(part["image_url"]["url"] for part in user if part["type"] == "image_url")
                self.assertEqual(image_url, "data:image/png;base64," + base64.b64encode(self.image).decode("ascii"))
                instructions = " ".join([system] + [part["text"] for part in user if part["type"] == "text"])
                self.assertRegex(instructions, rf"\b{lang}\b")

    def test_trimming_and_empty_result(self):
        for content, expected in (("  " + TEXT * 100 + "\n", (TEXT * 100)[:500]), (" \n\t ", None)):
            with self.subTest(has_text=expected is not None):
                self.transport.body = json.dumps({"choices": [{"message": {"content": content}}]}).encode("utf-8")
                response = self.post()
                if expected is None:
                    self.assert_error(response, 422)
                else:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.json(), {"text": expected})

    def test_provider_failures_close_response(self):
        for status, body in ((201, b"{}"), (500, b"{}"), (200, b"invalid JSON"), (200, b"{}"),
                             (200, b"x" * (64 * 1024 + 1))):
            with self.subTest(status=status, length=len(body)), self.assertNoLogs(level="INFO"):
                self.transport.status = status
                self.transport.body = body
                self.assert_error(self.post(), 503)
        self.assertEqual(self.transport.closed, 5)

    def test_missing_reader_and_timeout(self):
        self.app.state.handwriting = None
        self.assert_error(self.post(), 503)
        self.assertEqual(self.transport.requests, [])

        self.transport.pause = True
        self.transport.pause_close = True
        self.app.state.handwriting = HandwritingReader(SETTINGS, transport=self.transport, timeout=0.02)
        with self.assertNoLogs(level="INFO"):
            self.assert_error(self.post(), 503)
        self.assertEqual(self.transport.close_attempts, 1)
        self.assertEqual(self.transport.closed, 0)

        self.transport.pause = False
        self.transport.pause_close = False
        response = self.post()
        self.assertEqual(response.status, 200)
        self.assertEqual(response.json(), {"text": TEXT})
