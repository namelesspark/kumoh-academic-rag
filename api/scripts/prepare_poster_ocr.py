"""배포에 쓸 한글과 영어 글자 인식 모델을 준비한다."""

from hashlib import file_digest, sha256
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile
from urllib.request import urlopen


MODEL_DIR = Path(__file__).resolve().parents[1] / ".poster-ocr"
COMMIT = "65727574dfcd264acbb0c3e07860e4e9e9b22185"
MODEL_BASE_URL = f"https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{COMMIT}"
MODEL_HASHES = {
    "kor": "6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2",
    "eng": "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
}


def matches_hash(path: Path, expected_hash: str) -> bool:
    try:
        with path.open("rb") as model:
            return file_digest(model, "sha256").hexdigest() == expected_hash
    except FileNotFoundError:
        return False


def prepare_model(directory: Path, language: str, expected_hash: str) -> None:
    filename = f"{language}.traineddata"
    destination = directory / filename
    if matches_hash(destination, expected_hash):
        return

    directory.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    digest = sha256()
    try:
        with (
            urlopen(f"{MODEL_BASE_URL}/{filename}", timeout=30) as response,
            NamedTemporaryFile(dir=directory, delete=False) as temporary,
        ):
            temporary_path = Path(temporary.name)
            for chunk in iter(lambda: response.read(65536), b""):
                digest.update(chunk)
                temporary.write(chunk)

        if digest.hexdigest() != expected_hash:
            raise ValueError(f"{filename}: SHA-256 mismatch")
        temporary_path.replace(destination)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def main() -> int:
    try:
        for language, expected_hash in MODEL_HASHES.items():
            prepare_model(MODEL_DIR, language, expected_hash)
    except (OSError, ValueError) as error:
        print(f"Poster OCR setup failed: {error}", file=sys.stderr)
        return 1
    print("Poster OCR models verified: kor, eng")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
