"""배포 준비 때 테크모 동작 시트, 공식 로고와 밝은 로고, 캠퍼스 사진, 제목 글자 그림을 검증해 준비한다."""

import colorsys
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from time import monotonic
from typing import NamedTuple
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zipfile import ZipFile

from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError

ASSET_DIR = Path(__file__).resolve().parents[1] / "app/chat_web/assets"
LOGO_URL = "https://www.kumoh.ac.kr/ko/sub01_01_08.do?mode=download&articleNo=536069&attachNo=157277"
LOGO_HASH = "1cc2997436ca4deffbdde78614e6def3141cc7381494cb8870557d257193b5cd"
LOGO_NAME = "kumoh-signature.png"
# 남색 띠 위에 판 없이 올리는 밝은 로고. 같은 공식 로고를 받아 배포 준비 때 바꿔 그린다.
# 파란 공은 그대로 두고, 나머지(검정 kit·회색 학교 이름·흰 바탕)는 흰색으로 바꿔 어두울수록 진하게 남긴다.
LIGHT_LOGO_NAME = "kumoh-signature-light.png"
LIGHT_KEEP_SATURATION = 0.35  # 채도가 이보다 크고
LIGHT_KEEP_BLUE_OVER_RED = 20  # 파랑이 빨강보다 이보다 크면 원래 색을 둔다
LIGHT_ALPHA_GAIN = 1.15  # 알파 = 원래 알파 × min(1, (1 − 명도) × 이 값)
LIGHT_WHITE = (255, 255, 255)
MAX_DOWNLOAD = 1024 * 1024
MAX_ENTRY = 1024 * 1024
REQUEST_TIMEOUT = 5
TOTAL_TIMEOUT = 20
# 그림 묶음(스프라이트 시트)의 칸 크기·한 줄의 칸 수·동작별 프레임 수는 이 파일 한 곳에 둔다.
# 서버가 같은 파일을 화면에 넘기므로 화면과 그림이 어긋나지 않는다.
TECHMO_LAYOUT_PATH = ASSET_DIR.parent / "techmo_layout.json"
# 공식 테크모를 바탕으로 새로 그린 동작 시트. 저장소에 보관하므로 내려받지 않는다.
# 그림을 바꾸면 지문도 함께 고친다. 지문이 다른 파일은 화면에 내려 주지 않는다.
TECHMO_SPRITE_NAME = "techmo-sprite.png"
TECHMO_SPRITE_SOURCE = ASSET_DIR.parent / "art" / TECHMO_SPRITE_NAME
TECHMO_SPRITE_HASH = "8c514828197766d281f0eb60a9f6af5d015f4c44a5a4cc3bee1a7754133258af"


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
# 사진은 로고보다 크고 학교 서버가 느릴 때가 있어 한도를 따로 넉넉히 둔다.
# 4초·10초였을 때 실제 배포 준비에서 한 장이 시간 초과로 빠졌다.
PHOTO_REQUEST_TIMEOUT = 15  # 요청 하나가 응답 없이 기다리는 시간
PHOTO_TOTAL_TIMEOUT = 60  # 사진 한 장에 쓰는 전체 시간. 다시 시도한 시간도 여기에 든다
PHOTO_ATTEMPTS = 2  # 시간 초과나 연결 오류면 한 장당 한 번 더 받는다
# 학교 서버는 브라우저가 보낸 것처럼 보이지 않는 사진 요청에 143바이트 HTML 오류를 준다.
PHOTO_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    "Referer": "https://www.kumoh.ac.kr/ko/index.do",
}


class TitleImage(NamedTuple):
    """제목 그림의 저장 이름과, 글자를 그릴 글꼴의 주소·바이트 수·지문(SHA-256), 그릴 글귀.

    `lines`를 비우면 로그인 화면 글귀(`TITLE_LINES`)를 그린다.
    """

    name: str
    url: str
    size: int
    sha256: str
    lines: tuple | None = None


OFFICIAL_HOST = "www.kumoh.ac.kr"
FONT_HOST = "raw.githubusercontent.com"
TITLE_FONT_SIZE = 172
TITLE_LINE_HEIGHT = 1.12  # 글자 크기의 배수
TITLE_MARGIN = 16
TITLE_WHITE = (255, 255, 255)
TITLE_YELLOW = (255, 209, 0)  # #FFD100
# 줄마다 (글자, 색) 조각을 왼쪽부터 이어 그린다.
TITLE_LINES = (
    (("졸업까지,", TITLE_WHITE),),
    (("테크모", TITLE_YELLOW), ("와 함께", TITLE_WHITE)),
)
# 메인 화면 제목. 한 줄이고 쉼표 뒤 빈칸까지 흰 조각에 넣는다.
MAIN_TITLE_LINES = (
    (("물어봐요, ", TITLE_WHITE), ("테크모", TITLE_YELLOW)),
)
# Gugi Regular. SIL Open Font License 1.1, Copyright (c) 2017 by TAE System & Typefaces Co.
# 글꼴 파일은 그림을 그릴 때만 메모리에서 쓰고 저장하거나 화면에 내려 주지 않는다.
TITLE_FONT_URL = ("https://raw.githubusercontent.com/google/fonts/16680f8688ffcd467d2eb2146a9ce0343404581d"
                  "/ofl/gugi/Gugi-Regular.ttf")
TITLE_FONT_BYTES = 990856
TITLE_FONT_HASH = "c0b1f979979cfc309fb2438fa9464f96173353e0c4842cc7a5919658184ed9d3"
# 두 그림은 글꼴 주소가 같다. main()이 주소마다 한 번만 받으므로 글꼴도 한 번만 받는다.
TITLE_IMAGES = (
    TitleImage("title-lettering.png", TITLE_FONT_URL, TITLE_FONT_BYTES, TITLE_FONT_HASH),
    TitleImage("main-lettering.png", TITLE_FONT_URL, TITLE_FONT_BYTES, TITLE_FONT_HASH,
               MAIN_TITLE_LINES),
    TitleImage("title-lettering-en.png", TITLE_FONT_URL, TITLE_FONT_BYTES, TITLE_FONT_HASH,
               ((("To graduation,", TITLE_WHITE),),
                (("with ", TITLE_WHITE), ("Techmo", TITLE_YELLOW)))),
    TitleImage("main-lettering-en.png", TITLE_FONT_URL, TITLE_FONT_BYTES, TITLE_FONT_HASH,
               ((("Ask ", TITLE_WHITE), ("Techmo", TITLE_YELLOW)),)),
)


class AssetError(ValueError):
    """공개 로그에 남겨도 되는 고정 실패 사유임."""


class DeadlineExceeded(TimeoutError):
    """그림 하나에 준 전체 시간을 다 썼다. 요청 하나의 시간 초과와 달리 다시 시도하지 않는다."""


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
                raise DeadlineExceeded("주소 이동 전체 시간 초과")
            req.timeout = min(self.request_timeout, remaining)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url, *, opener=None, clock=monotonic, limit=None):
    """허용한 주소에서 제한된 크기와 시간 안에 읽는다.

    사진 주소에는 브라우저형 요청 헤더를 붙이고 사진용 시간 한도를 쓴다. 시간 초과나
    연결 오류가 나면 같은 전체 한도 안에서 한 번 더 받는다.
    글꼴 주소는 글꼴 저장소 안에서만 받고 글꼴용 크기 한도를 쓴다.
    로고 요청은 전과 같다.
    """
    is_photo = any(url == photo.url for photo in CAMPUS_PHOTOS)
    font_source = next((title for title in TITLE_IMAGES if title.url == url), None)
    is_font = font_source is not None
    if not is_photo and not is_font and url != LOGO_URL:
        raise AssetError("허용하지 않은 원본")
    host = FONT_HOST if is_font else OFFICIAL_HOST
    if limit is None:
        limit = font_source.size if is_font else MAX_DOWNLOAD
    request_timeout, total_timeout = (
        (PHOTO_REQUEST_TIMEOUT, PHOTO_TOTAL_TIMEOUT) if is_photo else (REQUEST_TIMEOUT, TOTAL_TIMEOUT)
    )
    deadline = clock() + total_timeout
    opener = opener or build_opener(OfficialRedirect(
        clock=clock, deadline=deadline, request_timeout=request_timeout, host=host)).open

    def read_once(timeout):
        # 시도마다 요청을 새로 만들고 처음부터 다시 읽는다. 앞 시도에서 받다 만 바이트는 버린다.
        target = Request(url, headers=PHOTO_HEADERS) if is_photo else url
        with opener(target, timeout=timeout) as response:
            check_url(response.geturl(), host)
            length = response.headers.get("Content-Length")
            if length is not None and int(length) > limit:
                raise AssetError("받는 크기 초과")
            result = bytearray()
            while True:
                remaining = deadline - clock()
                if remaining <= 0:
                    raise DeadlineExceeded("전체 시간 초과")
                # 실제 HTTPS 응답의 다음 읽기도 남은 전체 시간을 넘기지 않는다.
                raw = getattr(getattr(response, "fp", None), "raw", None)
                sock = getattr(raw, "_sock", None)
                if sock is not None:
                    sock.settimeout(min(request_timeout, remaining))
                read = getattr(response, "read1", response.read)
                chunk = read(min(65536, limit + 1 - len(result)))
                if clock() >= deadline:
                    raise DeadlineExceeded("전체 시간 초과")
                if not chunk:
                    return bytes(result)
                result.extend(chunk)
                if len(result) > limit:
                    raise AssetError("받는 크기 초과")

    attempts = PHOTO_ATTEMPTS if is_photo else 1
    for attempt in range(1, attempts + 1):
        timeout = request_timeout
        if attempt > 1:
            # 다시 받는 요청은 남은 전체 시간보다 오래 기다리지 않는다.
            timeout = min(request_timeout, deadline - clock())
            if timeout <= 0:
                raise DeadlineExceeded("전체 시간 초과")
        try:
            return read_once(timeout)
        except OSError as error:
            # 시간 초과와 연결 오류만 다시 시도한다. 둘 다 OSError의 한 갈래다.
            # 서버가 오류 상태로 답했거나(HTTPError) 전체 한도를 다 썼으면 다시 해도 같으므로 그만둔다.
            # 크기·주소 위반(AssetError)은 OSError가 아니라 여기 오지 않는다.
            if attempt == attempts or isinstance(error, (HTTPError, DeadlineExceeded)):
                raise


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


def light_logo_png(data):
    """검사를 마친 로고 PNG를 남색 바탕용 밝은 로고 PNG로 바꿔 돌려준다.

    픽셀마다 HSV(색상·채도·명도)로 본다. 채도가 `LIGHT_KEEP_SATURATION`보다 크고 B−R이
    `LIGHT_KEEP_BLUE_OVER_RED`보다 크면(파란 공) 그대로 둔다. 나머지는 흰색으로 바꾸고
    알파를 `round(원래 알파 × min(1, (1 − 명도) × LIGHT_ALPHA_GAIN))`로 정한다.
    흰 바탕은 투명이 되고, 검정 글자는 흰 글자, 회색 글자는 밝은 회색처럼 보인다.
    """
    try:
        with Image.open(BytesIO(data)) as source:
            if source.format != "PNG":
                raise AssetError("밝은 로고를 만들 수 없음")
            image = source.convert("RGBA")
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise AssetError("밝은 로고를 만들 수 없음") from None
    raw = image.tobytes()
    result = bytearray(len(raw))
    for at in range(0, len(raw), 4):
        red, green, blue, alpha = raw[at:at + 4]
        _, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        if saturation > LIGHT_KEEP_SATURATION and blue - red > LIGHT_KEEP_BLUE_OVER_RED:
            result[at:at + 4] = raw[at:at + 4]
        else:
            result[at:at + 4] = bytes((*LIGHT_WHITE,
                                       round(alpha * min(1, (1 - value) * LIGHT_ALPHA_GAIN))))
    output = BytesIO()
    Image.frombytes("RGBA", image.size, bytes(result)).save(output, format="PNG")
    return output.getvalue()


def load_techmo_layout(text=None):
    """칸 배치를 읽어 (칸 크기, 한 줄의 칸 수, ((동작 이름, 프레임 수), ...))로 돌려준다."""
    if text is None:
        text = TECHMO_LAYOUT_PATH.read_text(encoding="utf-8")

    def positive(value):
        return type(value) is int and value > 0

    try:
        layout = json.loads(text)
        cell, columns = layout["cell"], layout["columns"]
        motions = tuple((motion["name"], motion["frames"]) for motion in layout["motions"])
        names = [name for name, _ in motions]
        valid = (type(layout["version"]) is int and layout["version"] == 1
                 and positive(cell) and positive(columns) and bool(motions)
                 and len(set(names)) == len(names)
                 and all(positive(frames) and frames <= columns for _, frames in motions))
    except (ValueError, KeyError, TypeError):
        valid = False
    if not valid:
        raise AssetError("테크모 칸 배치 형식 불일치")
    return cell, columns, motions


def read_techmo_sprite():
    """저장소에 보관한 동작 시트를 한 번 읽는다."""
    return TECHMO_SPRITE_SOURCE.read_bytes()


def techmo_sprite_png(data, expected_hash, layout_text=None):
    """저장소의 동작 시트가 확인해 둔 그림과 같을 때만 읽은 바이트를 그대로 돌려준다.

    지문 → PNG 형식 → 색 모드 → 크기 → 전체 디코딩 순서로 본다. 크기는 칸 배치 파일의
    `한 줄의 칸 수 × 칸 크기`, `줄 수 × 칸 크기`와 같아야 한다. 색 모드는 원래 RGBA여야 하며
    다른 모드를 RGBA로 바꿔 통과시키지 않는다. 다시 저장하지 않으므로 결과의 지문도 같다.
    """
    if sha256(data).hexdigest() != expected_hash:
        raise AssetError("테크모 시트 지문 불일치")
    cell, columns, motions = load_techmo_layout(layout_text)
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format != "PNG":
                raise AssetError("테크모 시트 형식 불일치")
            if image.mode != "RGBA":
                raise AssetError("테크모 시트 색 모드 불일치")
            if image.size != (columns * cell, len(motions) * cell):
                raise AssetError("테크모 시트 크기 불일치")
            image.load()
    except (UnidentifiedImageError, OSError, SyntaxError):
        # 그림으로 열리지 않거나 중간에 끊긴 파일.
        raise AssetError("테크모 시트를 열 수 없음") from None
    return data


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
    missing = font.getmask("\U0010ffff")
    missing_shape = (missing.size, bytes(missing))
    for character in set("".join(text for line in lines for text, _ in line)):
        if character.isspace():
            continue
        glyph = font.getmask(character)
        if (glyph.size, bytes(glyph)) == missing_shape:
            raise AssetError("글꼴에 제목 글자가 없음")
    size = font.size
    pad = size  # 획이 글자 칸 밖으로 나가도 잘리지 않게 넉넉히 둔 뒤 잘라 낸다.
    widths = [sum(font.getlength(text) for text, _ in line) for line in lines]
    canvas = (int(max(widths)) + 2 * pad,
              int((len(lines) - 1) * TITLE_LINE_HEIGHT * size + size) + 2 * pad)
    shapes = {}
    for index, line in enumerate(lines):
        # 줄은 모두 같은 왼쪽 끝에서 시작한다.
        x = pad
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
        raise AssetError("제목 글자가 비어 있음")
    left, top, right, bottom = visible
    if min(left, top, canvas[0] - right, canvas[1] - bottom) < TITLE_MARGIN:
        raise AssetError("제목 글자가 그림 밖으로 나감")
    image = image.crop((left - TITLE_MARGIN, top - TITLE_MARGIN,
                        right + TITLE_MARGIN, bottom + TITLE_MARGIN))
    result = BytesIO()
    image.save(result, format="PNG")
    return result.getvalue()


def title_png(data, expected_size, expected_hash, lines=None):
    """확인해 둔 글꼴과 한 바이트도 다르지 않을 때만 그 글꼴로 제목 그림을 그린다.

    `lines`를 비우면 로그인 화면 글귀를 그린다.
    """
    if len(data) != expected_size:
        raise AssetError("글꼴 바이트 수 불일치")
    if sha256(data).hexdigest() != expected_hash:
        raise AssetError("글꼴 지문 불일치")
    try:
        font = ImageFont.truetype(BytesIO(data), TITLE_FONT_SIZE)
    except (OSError, ValueError):
        raise AssetError("글꼴을 열 수 없음") from None
    return render_title(font, lines)


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


def main(*, downloader=download, writer=atomic_write, report=print,
         sprite_reader=read_techmo_sprite):
    def prepare(name, produce):
        """그림 하나를 만들어 쓰고 한 줄로 보고한다. 실패하면 쓰지 않아 기존 파일이 남는다."""
        try:
            writer(ASSET_DIR / name, produce())
            report(f"{name}: 준비 완료")
        except Exception as error:
            # 외부 응답·주소·파일 경로는 로그에 옮기지 않는다.
            reason = str(error) if isinstance(error, AssetError) else type(error).__name__
            report(f"{name}: 준비 실패 ({reason})")

    # 동작 시트는 저장소에 있어 내려받지 않는다. 내려받기보다 먼저 준비하므로
    # 학교 서버가 전부 막혀도 시트는 준비된다.
    prepare(TECHMO_SPRITE_NAME, lambda: techmo_sprite_png(sprite_reader(), TECHMO_SPRITE_HASH))

    sources = {}

    def fetch(url):
        """주소마다 한 번만 받는다. 실패도 기억해 같은 주소를 다시 받지 않는다."""
        if url not in sources:
            try:
                sources[url] = downloader(url)
            except Exception as error:
                sources[url] = error
        data = sources[url]
        if isinstance(data, Exception):
            raise data
        return data

    for name, url, convert in (
        (LOGO_NAME, LOGO_URL, lambda data: logo_png(data)),
        # 밝은 로고는 같은 주소라 위에서 받은 바이트를 다시 쓴다. 원본 지문을 통과해야만 바꿔 그린다.
        (LIGHT_LOGO_NAME, LOGO_URL, lambda data: light_logo_png(logo_png(data))),
        # 사진은 주소가 서로 달라 한 장씩 따로 받고 따로 검사한다.
        *((photo.name, photo.url,
           lambda data, photo=photo: campus_jpeg(data, photo.size, photo.sha256))
          for photo in CAMPUS_PHOTOS),
        # 제목은 글꼴을 받아 그림으로 그린다. 글꼴 파일은 저장하지 않는다.
        # 같은 글꼴 주소는 아래 `sources`가 한 번 받은 바이트를 함께 쓴다.
        *((title.name, title.url,
           lambda data, title=title: title_png(data, title.size, title.sha256, title.lines))
          for title in TITLE_IMAGES),
    ):
        prepare(name, lambda: convert(fetch(url)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
