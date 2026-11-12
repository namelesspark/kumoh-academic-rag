"""가상 모델로 다운로드, 지문 확인, 기존 파일 재사용을 검사한다."""

from contextlib import redirect_stderr
from hashlib import sha256
from io import BytesIO, StringIO
from pathlib import Path
from unittest import TestCase, mock

from api.scripts import prepare_poster_ocr as setup


class PosterOcrSetupTests(TestCase):
    directory = Path("fictional-models")
    destination = directory / "kor.traineddata"
    temporary_path = directory / "temporary-model"
    model = b"fictional Korean OCR model"
    expected_hash = sha256(model).hexdigest()

    def test_verified_download_replaces_destination(self):
        with (
            mock.patch.object(Path, "open", side_effect=FileNotFoundError),
            mock.patch.object(Path, "mkdir"),
            mock.patch.object(setup, "urlopen", return_value=BytesIO(self.model)) as download,
            mock.patch.object(setup, "NamedTemporaryFile") as temporary,
            mock.patch.object(Path, "replace", autospec=True) as replace,
            mock.patch.object(Path, "unlink", autospec=True),
        ):
            file = temporary.return_value.__enter__.return_value
            file.name = str(self.temporary_path)
            setup.prepare_model(self.directory, "kor", self.expected_hash)

        download.assert_called_once_with(
            f"{setup.MODEL_BASE_URL}/kor.traineddata", timeout=30
        )
        self.assertTrue(setup.MODEL_BASE_URL.startswith("https://"))
        temporary.assert_called_once_with(dir=self.directory, delete=False)
        file.write.assert_called_once_with(self.model)
        replace.assert_called_once_with(self.temporary_path, self.destination)

    def test_mismatched_download_is_removed_and_setup_fails(self):
        error = StringIO()
        with (
            mock.patch.object(setup, "MODEL_DIR", self.directory),
            mock.patch.object(setup, "MODEL_HASHES", {"kor": self.expected_hash}),
            mock.patch.object(Path, "open", return_value=BytesIO(b"invalid cached model")),
            mock.patch.object(Path, "mkdir"),
            mock.patch.object(setup, "urlopen", return_value=BytesIO(b"invalid download")),
            mock.patch.object(setup, "NamedTemporaryFile") as temporary,
            mock.patch.object(Path, "replace", autospec=True) as replace,
            mock.patch.object(Path, "unlink", autospec=True) as unlink,
            redirect_stderr(error),
        ):
            temporary.return_value.__enter__.return_value.name = str(self.temporary_path)
            self.assertNotEqual(setup.main(), 0)

        replace.assert_not_called()
        unlink.assert_called_once_with(self.temporary_path, missing_ok=True)
        self.assertIn("kor.traineddata: SHA-256 mismatch", error.getvalue())

    def test_verified_existing_file_is_reused(self):
        with (
            mock.patch.object(Path, "open", autospec=True, return_value=BytesIO(self.model)) as read,
            mock.patch.object(setup, "urlopen") as download,
            mock.patch.object(Path, "mkdir") as mkdir,
        ):
            setup.prepare_model(self.directory, "kor", self.expected_hash)

        read.assert_called_once_with(self.destination, "rb")
        download.assert_not_called()
        mkdir.assert_not_called()
