"""JPEG 또는 PNG 한 장을 받아 공식 행사 정보를 찾는다."""

from asyncio import Lock
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect

from app.schemas.error import ErrorResponse
from app.schemas.poster_lookup import PosterLookupResponse
from app.services.biskit_recommendations import KST
from app.services.poster_lookup import match_poster
from app.services.poster_recognition import recognize


router = APIRouter()
MAX_BYTES = 5_000_000
MAX_PIXELS = 12_000_000
IMAGE_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG"}


def _read_poster(body: bytearray, expected_format: str) -> PosterLookupResponse:
    try:
        with Image.open(BytesIO(body)) as image:
            if image.format != expected_format:
                raise HTTPException(415, "JPEG 또는 PNG 사진의 형식을 확인해 주세요.")
            if image.width * image.height > MAX_PIXELS:
                raise HTTPException(422, "사진은 1,200만 화소 이하여야 합니다.")
            if getattr(image, "n_frames", 1) != 1:
                raise HTTPException(422, "사진은 한 장만 올려 주세요.")
            image.load()
            recognition = recognize(image)
    except Image.DecompressionBombError:
        raise HTTPException(422, "사진은 1,200만 화소 이하여야 합니다.") from None
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise HTTPException(422, "사진을 열 수 없습니다.") from None
    return match_poster(recognition, datetime.now(KST).date())


@router.post(
    "/poster-lookup",
    response_model=PosterLookupResponse,
    responses={code: {"model": ErrorResponse} for code in (413, 415, 422)},
)
async def post_poster_lookup(request: Request) -> PosterLookupResponse:
    media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    expected_format = IMAGE_FORMATS.get(media_type)
    if expected_format is None:
        raise HTTPException(415, "JPEG 또는 PNG 사진을 올려 주세요.")

    content_length = request.headers.get("content-length", "")
    length_digits = content_length.lstrip("0")
    if length_digits.isascii() and length_digits.isdecimal() and (
        len(length_digits) > len(str(MAX_BYTES)) or int(length_digits) > MAX_BYTES
    ):
        raise HTTPException(413, "사진은 5MB 이하여야 합니다.")
    # 사진 본문과 디코딩한 이미지가 동시에 여러 장 메모리에 쌓이지 않게 한다.
    state = request.app.state
    if not hasattr(state, "poster_upload_lock"):
        state.poster_upload_lock = Lock()
    async with state.poster_upload_lock:
        body = bytearray()
        try:
            async for chunk in request.stream():
                if len(body) + len(chunk) > MAX_BYTES:
                    raise HTTPException(413, "사진은 5MB 이하여야 합니다.")
                body.extend(chunk)
        except ClientDisconnect:
            raise HTTPException(422, "사진을 끝까지 받지 못했습니다.") from None
        return await run_in_threadpool(_read_poster, body, expected_format)
