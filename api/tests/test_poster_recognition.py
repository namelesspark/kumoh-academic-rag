"""Exercise the native readers using images generated in memory."""

from io import BytesIO
from pathlib import Path
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw, ImageFont
import zxingcpp

from api.app.services import poster_recognition


def _qr_image(url):
    barcode = zxingcpp.create_barcode(url, zxingcpp.QRCode)
    pixels = zxingcpp.write_barcode_to_image(barcode, scale=5)
    return Image.fromarray(pixels)


class PosterRecognitionTests(unittest.TestCase):
    def test_reads_both_qr_types_without_ocr_models(self):
        urls = (
            "https://mx.kumoh.ac.kr/md/sub0201.do?articleNo=582275&mode=view",
            "https://biskit.kumoh.ac.kr/ptfol/imng/icmpNsbjtPgm/"
            "findIcmpNsbjtPgmInfo.do?encSddpbSeq=31303034313732",
        )
        for url in urls:
            with self.subTest(url=url), patch.object(
                poster_recognition, "MODEL_DIR", Path(__file__) / "missing"
            ):
                result = poster_recognition.recognize(_qr_image(url))
                self.assertEqual(result.qr_codes, (url,))
                self.assertEqual(result.text, "")
                self.assertFalse(result.text_available)

    def test_transparent_pixels_cannot_supply_qr_evidence(self):
        image = _qr_image("https://www.kumoh.ac.kr/").convert("RGBA")
        image.putalpha(0)
        with patch.object(poster_recognition, "MODEL_DIR", Path(__file__) / "missing"):
            result = poster_recognition.recognize(image)
        self.assertEqual(result.qr_codes, ())

    def test_reads_visible_text_from_jpeg(self):
        if not all(
            (poster_recognition.MODEL_DIR / name).is_file()
            for name in ("kor.traineddata", "eng.traineddata")
        ):
            self.skipTest("kor and eng OCR models have not been prepared")

        poster = Image.new("RGB", (850, 300), "white")
        draw = ImageDraw.Draw(poster)
        font = ImageFont.load_default(size=52)
        draw.text((60, 50), "SJA INTERNSHIP BRIEFING", font=font, fill="black")
        draw.text((60, 145), "2026-11-23", font=font, fill="black")
        with BytesIO() as payload:
            poster.save(payload, "JPEG")
            payload.seek(0)
            with Image.open(payload) as photo:
                result = poster_recognition.recognize(photo)
        self.assertTrue(result.text_available)
        self.assertEqual(result.qr_codes, ())
        self.assertIn("INTERNSHIP BRIEFING", result.text)
        self.assertIn("2026-11-23", result.text)
