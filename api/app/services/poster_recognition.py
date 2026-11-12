"""Read text and QR codes from a decoded poster image."""

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps
import zxingcpp


MODEL_DIR = Path(__file__).resolve().parents[2] / ".poster-ocr"


@dataclass(frozen=True)
class Recognition:
    text: str
    qr_codes: tuple[str, ...]
    text_available: bool


def _read_text(image: Image.Image) -> str | None:
    if not all((MODEL_DIR / name).is_file() for name in ("kor.traineddata", "eng.traineddata")):
        return None

    try:
        from tesserocr import OEM, PSM, PyTessBaseAPI

        with PyTessBaseAPI(
            path=str(MODEL_DIR), lang="kor+eng", oem=OEM.LSTM_ONLY, psm=PSM.SPARSE_TEXT
        ) as reader:
            reader.SetImage(image)
            return reader.GetUTF8Text()
    except (ImportError, RuntimeError):
        return None


def recognize(image: Image.Image) -> Recognition:
    oriented = ImageOps.exif_transpose(image)
    # Composite transparency so hidden RGB pixels cannot contribute clues.
    if "A" in oriented.getbands() or "transparency" in oriented.info:
        foreground = oriented.convert("RGBA")
        oriented = Image.alpha_composite(Image.new("RGBA", foreground.size, "white"), foreground)
    grayscale = oriented.convert("L")
    qr_codes = tuple(
        barcode.text for barcode in zxingcpp.read_barcodes(grayscale, formats=zxingcpp.QRCode)
    )
    text = _read_text(grayscale)
    return Recognition(text or "", qr_codes, text is not None)
