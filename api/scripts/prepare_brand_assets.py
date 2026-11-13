"""배포 준비 때 공식 그림을 검증하고 화면용 PNG와 캠퍼스 사진을 준비한다."""

from collections import deque
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from time import monotonic
from typing import NamedTuple
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zipfile import ZipFile

from PIL import Image, UnidentifiedImageError

ASSET_DIR = Path(__file__).resolve().parents[1] / "app/chat_web/assets"
LOGO_URL = "https://www.kumoh.ac.kr/ko/sub01_01_08.do?mode=download&articleNo=536069&attachNo=157277"
TECHMO_URL = "https://www.kumoh.ac.kr/_res/ko/img/sub01/img_character_pc.jpg"
LOGO_HASH = "1cc2997436ca4deffbdde78614e6def3141cc7381494cb8870557d257193b5cd"
TECHMO_HASH = "703d80a95afd60c22d301a7fde25be9a89d97fe95f9edef43f3fe093b0de297a"
MAX_DOWNLOAD = 1024 * 1024
MAX_ENTRY = 1024 * 1024
REQUEST_TIMEOUT = 5
TOTAL_TIMEOUT = 20
WHITE_TOLERANCE = 25
TECHMO_CROPS = {
    "basic": (144, 142, 611, 555),
    "quiet": (742, 111, 881, 293),
    "guide": (742, 430, 881, 610),
    "celebrate": (947, 129, 1105, 273),
    "concert": (947, 441, 1105, 610),
}


class CampusPhoto(NamedTuple):
    """배경 사진 한 장의 저장 이름, 원본 주소, 바이트 수, 내용 지문(SHA-256)."""

    name: str
    url: str
    size: int
    sha256: str


# 2026-11-14에 확인한 값. 화면이 보여 주는 순서와 같다.
CAMPUS_PHOTOS = (
    CampusPhoto("campus-aerial.jpg", "https://www.kumoh.ac.kr/_res/ko/img/sub05/bg_subvisual_pc.jpg",
                583939, "8faafc7fd7e7aab32534db748751786cac4ce274b7b90502f1458e383bbab710"),
    CampusPhoto("campus-hill.jpg", "https://www.kumoh.ac.kr/_res/ko/img/sub01/bg_subvisual_pc.jpg",
                436640, "dbc71342b577655fd9e08e2e7e7b50631da92e676a0be8f227bdc80d960326cb"),
    CampusPhoto("campus-gate.jpg", "https://www.kumoh.ac.kr/_res/ko/img/sub06/bg_subvisual_pc.jpg",
                346802, "69f8c4620bf576cc8290a3bd122db80761a1e5e270edafbf7f77f9ff81cba3c1"),
    CampusPhoto("campus-field.jpg", "https://www.kumoh.ac.kr/_res/ko/img/sub04/bg_subvisual_pc.jpg",
                299358, "eb5c46f8a47e642e22a2dbbc55248a7eefcffb00d43f997f76459c65445555a5"),
)
PHOTO_DIMENSIONS = (1920, 280)
# 사진은 네 장이라 한 장이 빌드를 오래 붙잡지 않게 로고·테크모보다 짧은 한도를 따로 둔다.
PHOTO_REQUEST_TIMEOUT = 4
PHOTO_TOTAL_TIMEOUT = 10
# 학교 서버는 브라우저가 보낸 것처럼 보이지 않는 사진 요청에 143바이트 HTML 오류를 준다.
PHOTO_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    "Referer": "https://www.kumoh.ac.kr/ko/index.do",
}


class AssetError(ValueError):
    """공개 로그에 남겨도 되는 고정 실패 사유임."""


def check_url(url):
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc != "www.kumoh.ac.kr"):
        raise AssetError("허용하지 않은 주소")


class OfficialRedirect(HTTPRedirectHandler):
    def __init__(self, *, clock=monotonic, deadline=None, request_timeout=REQUEST_TIMEOUT):
        self.clock = clock
        self.deadline = deadline
        self.request_timeout = request_timeout

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        if self.deadline is not None:
            remaining = self.deadline - self.clock()
            if remaining <= 0:
                raise TimeoutError("주소 이동 전체 시간 초과")
            req.timeout = min(self.request_timeout, remaining)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url, *, opener=None, clock=monotonic, limit=MAX_DOWNLOAD):
    """공식 주소에서 제한된 크기와 시간 안에 읽는다.

    사진 주소에는 브라우저형 요청 헤더를 붙이고 사진용 시간 한도를 쓴다.
    로고와 테크모 요청은 전과 같다.
    """
    is_photo = any(url == photo.url for photo in CAMPUS_PHOTOS)
    if not is_photo and url not in (LOGO_URL, TECHMO_URL):
        raise AssetError("허용하지 않은 원본")
    request_timeout, total_timeout = (
        (PHOTO_REQUEST_TIMEOUT, PHOTO_TOTAL_TIMEOUT) if is_photo else (REQUEST_TIMEOUT, TOTAL_TIMEOUT)
    )
    deadline = clock() + total_timeout
    opener = opener or build_opener(OfficialRedirect(
        clock=clock, deadline=deadline, request_timeout=request_timeout)).open
    target = Request(url, headers=PHOTO_HEADERS) if is_photo else url
    with opener(target, timeout=request_timeout) as response:
        check_url(response.geturl())
        length = response.headers.get("Content-Length")
        if length is not None and int(length) > limit:
            raise AssetError("받는 크기 초과")
        result = bytearray()
        while True:
            remaining = deadline - clock()
            if remaining <= 0:
                raise TimeoutError("전체 시간 초과")
            # 실제 HTTPS 응답의 다음 읽기도 남은 전체 시간을 넘기지 않는다.
            raw = getattr(getattr(response, "fp", None), "raw", None)
            sock = getattr(raw, "_sock", None)
            if sock is not None:
                sock.settimeout(min(request_timeout, remaining))
            read = getattr(response, "read1", response.read)
            chunk = read(min(65536, limit + 1 - len(result)))
            if clock() >= deadline:
                raise TimeoutError("전체 시간 초과")
            if not chunk:
                return bytes(result)
            result.extend(chunk)
            if len(result) > limit:
                raise AssetError("받는 크기 초과")


def logo_png(data, expected_hash=LOGO_HASH):
    """묶음 안에서 이름 대신 지문이 같은 PNG를 고른다."""
    with ZipFile(BytesIO(data)) as archive:
        for entry in archive.infolist():
            if entry.file_size > MAX_ENTRY or entry.is_dir():
                continue
            with archive.open(entry) as stream:
                candidate = stream.read(MAX_ENTRY + 1)
            if len(candidate) > MAX_ENTRY or sha256(candidate).hexdigest() != expected_hash:
                continue
            with Image.open(BytesIO(candidate)) as image:
                if image.format != "PNG" or image.size != (782, 113):
                    raise AssetError("로고 형식 또는 크기 불일치")
                image.load()
            return candidate
    raise AssetError("로고 지문 불일치")


def techmo_png(data, expected_hash=TECHMO_HASH, *, pose="basic"):
    """가장자리와 이어진 흰색만 지워 눈의 흰자를 보존한다."""
    if sha256(data).hexdigest() != expected_hash:
        raise AssetError("테크모 지문 불일치")
    with Image.open(BytesIO(data)) as source:
        if source.format != "JPEG" or source.size != (1198, 767):
            raise AssetError("테크모 형식 또는 크기 불일치")
        left, top, right, bottom = TECHMO_CROPS[pose]
        image = source.crop((left, top, right + 1, bottom + 1)).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    pending = deque([(x, y) for x in range(width) for y in (0, height - 1)] +
                    [(x, y) for y in range(height) for x in (0, width - 1)])
    visited = set()
    while pending:
        x, y = pending.popleft()
        if (x, y) in visited or not (0 <= x < width and 0 <= y < height):
            continue
        visited.add((x, y))
        if min(pixels[x, y][:3]) < 255 - WHITE_TOLERANCE:
            continue
        pixels[x, y] = (*pixels[x, y][:3], 0)
        pending.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    result = BytesIO()
    image.save(result, format="PNG")
    return result.getvalue()


def techmo_sprite_png(data):
    """다섯 자세를 같은 칸에 놓고 발끝 높이를 맞춘 한 장을 만듦."""
    sheet = Image.new("RGBA", (960, 192))
    for index, pose in enumerate(TECHMO_CROPS):
        with Image.open(BytesIO(techmo_png(data, pose=pose))) as source:
            visible = source.getbbox()
            if visible is None:
                raise AssetError("테크모 자세가 비어 있음")
            image = source.crop(visible)
        image.thumbnail((184, 184), Image.Resampling.LANCZOS)
        x = index * 192 + (192 - image.width) // 2
        sheet.alpha_composite(image, (x, 188 - image.height))
    result = BytesIO()
    sheet.save(result, format="PNG")
    return result.getvalue()


def campus_jpeg(data, expected_size, expected_hash):
    """확인해 둔 사진과 한 바이트도 다르지 않을 때만 받은 바이트를 그대로 돌려준다.

    다시 압축하지 않는다. 바이트 수와 지문을 먼저 보므로 143바이트 HTML 오류는 그림을
    열기 전에 걸린다.
    """
    if len(data) != expected_size:
        raise AssetError("사진 바이트 수 불일치")
    if sha256(data).hexdigest() != expected_hash:
        raise AssetError("사진 지문 불일치")
    try:
        with Image.open(BytesIO(data)) as image:
            valid = image.format == "JPEG" and image.size == PHOTO_DIMENSIONS
            if valid:
                image.load()
    except (UnidentifiedImageError, OSError, SyntaxError):
        valid = False
    if not valid:
        raise AssetError("사진 형식 또는 크기 불일치")
    return data


def atomic_write(destination, data):
    """검증한 결과를 임시 파일에 모두 쓴 뒤 교체한다."""
    temporary = None
    try:
        with NamedTemporaryFile(dir=destination.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
        temporary.replace(destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main(*, downloader=download, writer=atomic_write, report=print):
    sources = {}
    for name, url, convert in (
        ("kumoh-signature.png", LOGO_URL, logo_png),
        ("techmo-basic.png", TECHMO_URL, techmo_png),
        *((f"techmo-{pose}.png", TECHMO_URL,
           lambda data, pose=pose: techmo_png(data, pose=pose))
          for pose in ("quiet", "guide", "celebrate")),
        ("techmo-sprite.png", TECHMO_URL, techmo_sprite_png),
        # 사진은 주소가 서로 달라 한 장씩 따로 받고 따로 검사한다.
        *((photo.name, photo.url,
           lambda data, photo=photo: campus_jpeg(data, photo.size, photo.sha256))
          for photo in CAMPUS_PHOTOS),
    ):
        try:
            if url not in sources:
                try:
                    sources[url] = downloader(url)
                except Exception as error:
                    sources[url] = error
            data = sources[url]
            if isinstance(data, Exception):
                raise data
            writer(ASSET_DIR / name, convert(data))
            report(f"{name}: 준비 완료")
        except Exception as error:
            # 외부 응답·주소·파일 경로는 로그에 옮기지 않는다.
            reason = str(error) if isinstance(error, AssetError) else type(error).__name__
            report(f"{name}: 준비 실패 ({reason})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
