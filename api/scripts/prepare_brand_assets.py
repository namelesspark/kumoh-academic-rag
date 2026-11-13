"""배포 준비 때 공식 그림을 검증하고 화면용 PNG, 캠퍼스 사진, 붓글씨 제목 그림을 준비한다."""

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

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError

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


class BrushTitle(NamedTuple):
    """붓글씨 제목 그림의 저장 이름과, 글자를 그릴 글꼴의 주소·바이트 수·지문(SHA-256)."""

    name: str
    url: str
    size: int
    sha256: str


OFFICIAL_HOST = "www.kumoh.ac.kr"
FONT_HOST = "raw.githubusercontent.com"
# East Sea Dokdo Regular. SIL Open Font License 1.1, Copyright (c) YoonDesign Inc.
# 글꼴 파일은 그림을 그릴 때만 메모리에서 쓰고 저장하거나 화면에 내려 주지 않는다.
BRUSH_TITLES = (
    BrushTitle(
        "calligraphy-title.png",
        "https://raw.githubusercontent.com/google/fonts/16680f8688ffcd467d2eb2146a9ce0343404581d"
        "/ofl/eastseadokdo/EastSeaDokdo-Regular.ttf",
        3178684, "8cebb39d375134fdbcedef9bf4ec4f6c3f02c39ed0aacd6e83f7a0f435e593b2"),
)
MAX_FONT_DOWNLOAD = 4 * 1024 * 1024
TITLE_FONT_SIZE = 264
TITLE_LINE_HEIGHT = 0.98  # 글자 크기의 배수
TITLE_INDENT = 0.55  # 둘째 줄을 오른쪽으로 들이는 양. 글자 크기의 배수
TITLE_MARGIN = 16
TITLE_WHITE = (255, 255, 255)
TITLE_YELLOW = (255, 209, 0)  # #FFD100
# 줄마다 (글자, 색) 조각을 왼쪽부터 이어 그린다.
TITLE_LINES = (
    (("졸업까지,", TITLE_WHITE),),
    (("테크모", TITLE_YELLOW), ("와 함께", TITLE_WHITE)),
)


class AssetError(ValueError):
    """공개 로그에 남겨도 되는 고정 실패 사유임."""


def check_url(url, host=OFFICIAL_HOST):
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc != host):
        raise AssetError("허용하지 않은 주소")


class OfficialRedirect(HTTPRedirectHandler):
    def __init__(self, *, clock=monotonic, deadline=None, request_timeout=REQUEST_TIMEOUT,
                 host=OFFICIAL_HOST):
        self.clock = clock
        self.deadline = deadline
        self.request_timeout = request_timeout
        self.host = host

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl, self.host)
        if self.deadline is not None:
            remaining = self.deadline - self.clock()
            if remaining <= 0:
                raise TimeoutError("주소 이동 전체 시간 초과")
            req.timeout = min(self.request_timeout, remaining)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url, *, opener=None, clock=monotonic, limit=None):
    """허용한 주소에서 제한된 크기와 시간 안에 읽는다.

    사진 주소에는 브라우저형 요청 헤더를 붙이고 사진용 시간 한도를 쓴다.
    글꼴 주소는 글꼴 저장소 안에서만 받고 글꼴용 크기 한도를 쓴다.
    로고와 테크모 요청은 전과 같다.
    """
    is_photo = any(url == photo.url for photo in CAMPUS_PHOTOS)
    is_font = any(url == title.url for title in BRUSH_TITLES)
    if not is_photo and not is_font and url not in (LOGO_URL, TECHMO_URL):
        raise AssetError("허용하지 않은 원본")
    host = FONT_HOST if is_font else OFFICIAL_HOST
    if limit is None:
        limit = MAX_FONT_DOWNLOAD if is_font else MAX_DOWNLOAD
    request_timeout, total_timeout = (
        (PHOTO_REQUEST_TIMEOUT, PHOTO_TOTAL_TIMEOUT) if is_photo else (REQUEST_TIMEOUT, TOTAL_TIMEOUT)
    )
    deadline = clock() + total_timeout
    opener = opener or build_opener(OfficialRedirect(
        clock=clock, deadline=deadline, request_timeout=request_timeout, host=host)).open
    target = Request(url, headers=PHOTO_HEADERS) if is_photo else url
    with opener(target, timeout=request_timeout) as response:
        check_url(response.geturl(), host)
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


def render_title(font, lines=None):
    """글자를 투명 바탕에 그리고, 글자가 실제로 차지한 영역에 여백만 남겨 PNG로 돌려준다.

    색을 곧바로 칠하면 글자 가장자리의 반투명 점이 어둡게 섞인다. 그래서 색마다 글자
    모양(농도)만 먼저 그린 뒤, 단색 판의 투명도로 끼워 넣는다.
    """
    lines = TITLE_LINES if lines is None else lines
    size = font.size
    pad = size  # 붓글씨는 획이 글자 칸 밖으로 삐치므로 넉넉히 둔 뒤 잘라 낸다.
    widths = [index * TITLE_INDENT * size + sum(font.getlength(text) for text, _ in line)
              for index, line in enumerate(lines)]
    canvas = (int(max(widths)) + 2 * pad,
              int((len(lines) - 1) * TITLE_LINE_HEIGHT * size + size) + 2 * pad)
    shapes = {}
    for index, line in enumerate(lines):
        x = pad + index * TITLE_INDENT * size
        y = pad + index * TITLE_LINE_HEIGHT * size
        for text, color in line:
            shape = shapes.setdefault(color, Image.new("L", canvas, 0))
            ImageDraw.Draw(shape).text((x, y), text, fill=255, font=font)
            x += font.getlength(text)
    image = Image.new("RGBA", canvas, (*TITLE_WHITE, 0))
    for color, shape in shapes.items():
        layer = Image.new("RGBA", canvas, (*color, 0))
        layer.putalpha(shape)
        image = Image.alpha_composite(image, layer)
    visible = image.getchannel("A").getbbox()
    if visible is None:
        raise AssetError("붓글씨가 비어 있음")
    left, top, right, bottom = visible
    if min(left, top, canvas[0] - right, canvas[1] - bottom) < TITLE_MARGIN:
        raise AssetError("붓글씨가 그림 밖으로 나감")
    image = image.crop((left - TITLE_MARGIN, top - TITLE_MARGIN,
                        right + TITLE_MARGIN, bottom + TITLE_MARGIN))
    result = BytesIO()
    image.save(result, format="PNG")
    return result.getvalue()


def calligraphy_png(data, expected_size, expected_hash):
    """확인해 둔 글꼴과 한 바이트도 다르지 않을 때만 그 글꼴로 제목 그림을 그린다."""
    if len(data) != expected_size:
        raise AssetError("글꼴 바이트 수 불일치")
    if sha256(data).hexdigest() != expected_hash:
        raise AssetError("글꼴 지문 불일치")
    try:
        font = ImageFont.truetype(BytesIO(data), TITLE_FONT_SIZE)
    except (OSError, ValueError):
        raise AssetError("글꼴을 열 수 없음") from None
    return render_title(font)


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
        # 붓글씨 제목은 글꼴을 받아 그림으로 그린다. 글꼴 파일은 저장하지 않는다.
        *((title.name, title.url,
           lambda data, title=title: calligraphy_png(data, title.size, title.sha256))
          for title in BRUSH_TITLES),
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
