"""필기 그림 한 장을 받아 옮겨 적은 글자를 돌려준다."""

from email import policy
from email.errors import MessageError
from email.parser import BytesParser
from io import BytesIO

from fastapi import APIRouter, HTTPException, Request
from PIL import Image
from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect

from app.schemas.error import ErrorResponse
from app.schemas.handwriting import HandwritingResponse
from app.services.ai_chat import AiUnavailable


router = APIRouter()
MAX_IMAGE_BYTES = 2_000_000
MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024
MAX_PIXELS = 4_000_000
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_END = b"\x00\x00\x00\x00IEND\xaeB\x60\x82"
INVALID_FORM = "손글씨 입력 양식을 확인해 주세요."
INVALID_IMAGE = "손글씨 그림을 열 수 없습니다."
TOO_LARGE = "손글씨 그림은 2MB 이하여야 합니다."
UNAVAILABLE = "손글씨 인식을 사용할 수 없습니다."


async def _read_body(request: Request) -> bytearray:
    digits = request.headers.get("content-length", "").lstrip("0")
    if digits.isascii() and digits.isdecimal() and (
        len(digits) > len(str(MAX_BODY_BYTES)) or int(digits) > MAX_BODY_BYTES
    ):
        raise HTTPException(413, TOO_LARGE)
    body = bytearray()
    try:
        async for chunk in request.stream():
            if len(body) + len(chunk) > MAX_BODY_BYTES:
                raise HTTPException(413, TOO_LARGE)
            body.extend(chunk)
    except ClientDisconnect:
        raise HTTPException(422, INVALID_FORM) from None
    return body


def _has_defects(part) -> bool:
    return bool(part.defects) or any(getattr(value, "defects", ()) for _, value in part.items())


def _parse_fields(header: bytes, body: bytearray) -> tuple[bytes, str | None]:
    fields = {}
    try:
        form = BytesParser(policy=policy.HTTP).parsebytes(header + body)
        if _has_defects(form) or not form.is_multipart():
            raise HTTPException(422, INVALID_FORM)
        for part in form.iter_parts():
            if (
                _has_defects(part) or part.is_multipart()
                or len(part.get_all("Content-Disposition", [])) != 1
                or part.get_content_disposition() != "form-data"
                or part.get("Content-Transfer-Encoding") is not None
            ):
                raise HTTPException(422, INVALID_FORM)
            name = part.get_param("name", header="Content-Disposition")
            if name not in ("image", "lang") or name in fields:
                raise HTTPException(422, INVALID_FORM)
            fields[name] = part.get_payload(decode=True)
    except (MessageError, ValueError, IndexError, RecursionError):
        raise HTTPException(422, INVALID_FORM) from None
    image = fields.get("image")
    lang = fields.get("lang")
    if image is None or (lang is not None and lang not in (b"ko", b"en", b"zh")):
        raise HTTPException(422, INVALID_FORM)
    if len(image) > MAX_IMAGE_BYTES:
        raise HTTPException(413, TOO_LARGE)
    return image, lang.decode("ascii") if lang is not None else None


def _prepare_image(header: bytes, body: bytearray) -> tuple[bytes, str | None]:
    image_bytes, lang = _parse_fields(header, body)
    if not image_bytes.startswith(PNG_SIGNATURE):
        raise HTTPException(415, "PNG 그림을 올려 주세요.")
    try:
        source = BytesIO(image_bytes)
        with Image.open(source) as image:
            if image.format != "PNG":
                raise HTTPException(415, "PNG 그림을 올려 주세요.")
            if image.width * image.height > MAX_PIXELS:
                raise HTTPException(422, "손글씨 그림은 400만 화소 이하여야 합니다.")
            if getattr(image, "n_frames", 1) != 1:
                raise HTTPException(422, "손글씨 그림은 한 장만 올려 주세요.")
            image.verify()
            # Pillow는 끝 청크의 머리까지만 확인하므로 길이와 검사값도 읽는다.
            end = source.tell() - 8
            if image_bytes[end:] != PNG_END:
                raise HTTPException(422, INVALID_IMAGE)
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()
    except (Image.DecompressionBombError, OSError, SyntaxError, ValueError, EOFError):
        raise HTTPException(422, INVALID_IMAGE) from None
    return image_bytes, lang


@router.post(
    "/handwriting",
    response_model=HandwritingResponse,
    responses={code: {"model": ErrorResponse} for code in (413, 415, 422, 503)},
)
async def post_handwriting(request: Request) -> HandwritingResponse:
    content_type = request.headers.get("content-type", "")
    if "\r" in content_type or "\n" in content_type:
        raise HTTPException(415, INVALID_FORM)
    header = f"Content-Type: {content_type}\r\n\r\n".encode("latin-1")
    try:
        media = BytesParser(policy=policy.HTTP).parsebytes(header, headersonly=True)
        valid_type = media.get_content_type() == "multipart/form-data" and media.get_boundary()
    except (MessageError, ValueError, IndexError):
        valid_type = False
    if not valid_type:
        raise HTTPException(415, INVALID_FORM)
    body = await _read_body(request)
    image, lang = await run_in_threadpool(_prepare_image, header, body)
    reader = request.app.state.handwriting
    if reader is None:
        raise HTTPException(503, UNAVAILABLE)
    try:
        text = await reader.read(image, lang)
    except AiUnavailable:
        raise HTTPException(503, UNAVAILABLE) from None
    if not text:
        raise HTTPException(422, "읽을 손글씨를 찾지 못했습니다.")
    return HandwritingResponse(text=text)
