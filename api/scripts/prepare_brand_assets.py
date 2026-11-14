"""배포 준비 때 공식 그림을 검증하고 화면용 PNG, 캠퍼스 사진, 제목 글자 그림을 준비한다."""

from collections import deque
from hashlib import sha256
from io import BytesIO
import json
from math import cos, pi, radians, sin
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
# 그림 묶음(스프라이트 시트)의 칸 크기·한 줄의 칸 수·동작별 프레임 수는 이 파일 한 곳에 둔다.
# 서버가 같은 파일을 화면에 넘기므로 화면과 그림이 어긋나지 않는다.
TECHMO_LAYOUT_PATH = ASSET_DIR.parent / "techmo_layout.json"
# 다섯 동작이 함께 쓰는 기준 크기. 자세 그림은 이 안에 들어가게 줄이기만 하고 키우지 않는다.
# 가장 크게 움직이는 프레임(24px 뛰기, 10도 흔들림)도 192px 칸 안에 들어오는 값이다.
TECHMO_BASE_BOX = (128, 148)
TECHMO_FOOT_GAP = 4  # 칸 아래 끝에서 바닥선까지
TECHMO_EDGE = 2  # 프레임이 칸 가장자리에서 띄워야 하는 최소 거리. 못 지키면 시트를 만들지 않는다
TECHMO_DRAG_LIFT = 12  # 끌려가는 동안 바닥선에서 들린 높이
TECHMO_PAD = 2  # 변형할 때 그림 테두리가 거칠게 잘리지 않게 두르는 투명 띠


class Frame(NamedTuple):
    """프레임 하나의 변형. 세로 배율(1보다 크면 늘이기, 작으면 누르기), 기울인 각도, 들어 올린 높이(px)."""

    scale: float = 1.0
    angle: float = 0.0
    lift: float = 0.0


class Motion(NamedTuple):
    """동작 하나. 바탕이 되는 공식 자세, 기울일 때의 축(`bottom` 발끝, `top` 머리 위), 프레임 목록."""

    pose: str
    pivot: str
    frames: tuple


# 새 그림은 그리지 않는다. 공식 자세 그림을 기울이고, 세로로 늘이거나 누르고, 위아래로 옮기기만 한다.
# 한 동작 안의 프레임은 모두 서로 다르고, 첫 프레임은 기울이지 않은 모습이다.
TECHMO_MOTIONS = {
    # 대기: 숨 쉬듯 세로 1.00→1.03→1.00. 2px 오르내림은 숨보다 한 프레임 늦게 따라온다.
    "idle": Motion("basic", "bottom", tuple(
        Frame(scale=1 + 0.015 * (1 - cos(pi * index / 4)), lift=1 - cos(pi * (index - 1) / 4))
        for index in range(8))),
    # 안내: 좌우 ±4도 끄덕임.
    "guide": Motion("guide", "bottom", tuple(Frame(angle=angle) for angle in (0, 4, 2, -1, -4, -2))),
    # 축하: 웅크림 → 늘어나며 뛰어오름 → 24px 꼭대기 → 내려옴 → 누르기 → 원래대로.
    "celebrate": Motion("celebrate", "bottom", (
        Frame(), Frame(scale=0.90), Frame(scale=1.06, lift=12), Frame(scale=1.03, lift=24),
        Frame(lift=20), Frame(scale=1.04, lift=8), Frame(scale=0.92), Frame(scale=0.97))),
    # 정숙: 느린 ±2도.
    "quiet": Motion("quiet", "bottom", tuple(Frame(angle=angle) for angle in (0, 2, -1, -2))),
    # 끌려가는 중: 머리 위를 축으로 ±10도 흔들리고 세로로 1.06 늘어난다.
    "drag": Motion("concert", "top", tuple(
        Frame(scale=1.06, angle=angle, lift=TECHMO_DRAG_LIFT) for angle in (0, 10, 4, -4, -10, -5))),
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
# 사진은 로고·테크모보다 크고 학교 서버가 느릴 때가 있어 한도를 따로 넉넉히 둔다.
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
MAX_FONT_DOWNLOAD = 2 * 1024 * 1024
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
    로고와 테크모 요청은 전과 같다.
    """
    is_photo = any(url == photo.url for photo in CAMPUS_PHOTOS)
    is_font = any(url == title.url for title in TITLE_IMAGES)
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


def load_techmo_layout(text=None):
    """칸 배치를 읽어 (칸 크기, 한 줄의 칸 수, ((동작 이름, 프레임 수), ...))로 돌려준다.

    동작 이름과 프레임 수가 이 스크립트의 동작 표(`TECHMO_MOTIONS`)와 다르면 그림을 만들지 않는다.
    """
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
    for name, frames in motions:
        if name not in TECHMO_MOTIONS or len(TECHMO_MOTIONS[name].frames) != frames:
            raise AssetError("테크모 칸 배치와 동작 표 불일치")
    return cell, columns, motions


def techmo_pose_base(data, pose):
    """자세 그림의 투명 여백을 자르고 기준 크기 안으로 줄인다. (변형용 그림, 그림 높이)를 돌려준다.

    변형용 그림은 색에 투명도를 미리 곱해 둔 것이다(RGBa). 이렇게 해야 기울이거나 늘일 때
    가장자리에 투명한 점의 색이 섞여 테두리가 어두워지지 않는다.
    """
    with Image.open(BytesIO(techmo_png(data, pose=pose))) as source:
        image = source.convert("RGBA")
    visible = image.getchannel("A").getbbox()
    if visible is None:
        raise AssetError("테크모 자세가 비어 있음")
    image = image.crop(visible)
    image.thumbnail(TECHMO_BASE_BOX, Image.Resampling.LANCZOS)
    padded = Image.new("RGBA", (image.width + 2 * TECHMO_PAD, image.height + 2 * TECHMO_PAD))
    padded.paste(image, (TECHMO_PAD, TECHMO_PAD))
    return padded.convert("RGBa"), image.height


def techmo_frame(base, height, cell, pivot, frame):
    """기준 그림 한 장을 프레임 하나로 변형해 칸 크기 그림으로 돌려준다.

    칸보다 넓은 작업판에 그린 뒤 칸만 잘라 낸다. 칸을 넘는 프레임을 조용히 자르지 않고 찾아내기 위해서다.
    결과의 점 (x, y)가 기준 그림의 어느 점에서 오는지를 식 하나(아핀 변환)로 넘기므로
    그림은 프레임마다 한 번만 다시 그려진다.
    """
    margin = cell // 2
    size = cell + 2 * margin
    ground = margin + cell - TECHMO_FOOT_GAP  # 작업판에서 본 바닥선
    turn = radians(frame.angle)
    c, s = cos(turn), sin(turn)
    # 기울이는 축. 발끝 가운데에서 잰 높이다.
    pivot_y = -height * frame.scale if pivot == "top" else 0.0
    # 가로는 칸 가운데에 두되 왼쪽 끝을 정수 자리에 맞춘다. 폭이 홀수여도 변형하지 않은 프레임이 흐려지지 않는다.
    width = base.width - 2 * TECHMO_PAD
    axis_x, axis_y = margin + (cell - width) // 2 + width / 2, ground - frame.lift + pivot_y
    matrix = (
        c, s, -c * axis_x - s * axis_y + base.width / 2,
        -s / frame.scale, c / frame.scale,
        (s * axis_x - c * axis_y + pivot_y) / frame.scale + base.height - TECHMO_PAD,
    )
    canvas = base.transform((size, size), Image.Transform.AFFINE, matrix,
                            resample=Image.Resampling.BICUBIC).convert("RGBA")
    visible = canvas.getchannel("A").getbbox()
    if visible is None:
        raise AssetError("테크모 프레임이 비어 있음")
    # 발끝을 축으로 기울이면 한쪽 끝이 바닥선 아래로 내려간다. 가장 낮은 점을 바닥선에 다시 맞춘다.
    shift = visible[3] - ground if frame.angle and pivot == "bottom" else 0
    left, top = margin, margin + shift
    if (visible[0] < left + TECHMO_EDGE or visible[1] < top + TECHMO_EDGE
            or visible[2] > left + cell - TECHMO_EDGE or visible[3] > top + cell - TECHMO_EDGE):
        raise AssetError("테크모 프레임이 칸을 넘음")
    return canvas.crop((left, top, left + cell, top + cell))


def techmo_sprite_png(data, layout_text=None):
    """공식 자세 그림을 변형해 동작마다 한 줄씩 프레임을 놓은 한 장을 만든다.

    줄 순서와 칸 수는 칸 배치 파일을 따른다. 다섯 동작이 같은 기준 크기와 바닥선을 쓰고,
    프레임 수가 한 줄의 칸 수보다 적은 줄의 남는 칸은 투명하게 둔다.
    같은 입력이면 같은 바이트가 나온다.
    """
    cell, columns, motions = load_techmo_layout(layout_text)
    sheet = Image.new("RGBA", (columns * cell, len(motions) * cell))
    for row, (name, _) in enumerate(motions):
        motion = TECHMO_MOTIONS[name]
        base, height = techmo_pose_base(data, motion.pose)
        for column, frame in enumerate(motion.frames):
            sheet.paste(techmo_frame(base, height, cell, motion.pivot, frame),
                        (column * cell, row * cell))
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
        # 제목은 글꼴을 받아 그림으로 그린다. 글꼴 파일은 저장하지 않는다.
        # 두 제목의 글꼴 주소가 같아 아래 `sources`가 한 번 받은 바이트를 함께 쓴다.
        *((title.name, title.url,
           lambda data, title=title: title_png(data, title.size, title.sha256, title.lines))
          for title in TITLE_IMAGES),
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
