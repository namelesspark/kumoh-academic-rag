"""사진에서 읽은 글자를 기존 행사·장소·규정 검색에 넘긴다."""

import re
import unicodedata
from datetime import date
from urllib.parse import urlsplit

from app.schemas.photo_input import PhotoQuestionRequest, PhotoQuestionResponse, PhotoQuestionSource
from app.services.campus_guide import get_campus_places
from app.services.chat_retrieval import ChatRetrieval
from app.services.poster_lookup import match_event_text


# `신청`은 넣지 않는다. 수강신청·휴학 신청 같은 규정 질문까지 막기 때문이다.
EVENT_WORDS = ("행사", "설명회", "박람회", "특강", "세미나", "워크숍", "공모전", "경진대회", "축제")
# 판독문의 월일 표기(11월 23일, 11/23, 11.23, 11-23). 더 긴 숫자열의 일부는 읽지 않는다.
MONTH_DAY_TEXT = re.compile(
    r"(?<!\d)(?:1[0-2]|0?[1-9])\s*(?:월\s*(?:3[01]|[12]\d|0?[1-9])\s*일|[./-]\s*(?:3[01]|[12]\d|0?[1-9])(?!\d))"
)


def _has_month_day(text: str) -> bool:
    return MONTH_DAY_TEXT.search(unicodedata.normalize("NFKC", text)) is not None


def _place_text(text: str) -> str:
    return "".join(unicodedata.normalize("NFKC", text).casefold().split())


def _source_url(url: str | None) -> str | None:
    if not url or any(char.isspace() or ord(char) < 32 or char == "\\" for char in url):
        return None
    try:
        parts = urlsplit(url)
        if parts.scheme == "https" and parts.hostname and parts.username is None and parts.port in (None, 443):
            return url
    except ValueError:
        pass
    return None


def _regulation(
    retrieval: ChatRetrieval | None, query: str, session_id: str | None,
) -> PhotoQuestionResponse | None:
    if retrieval is None:
        return None
    result = retrieval.build_result(query, session_id)
    if not result["answered"] or not result["citations"] or not result["answer"].strip():
        return None
    sources = [
        PhotoQuestionSource(title=citation["document"], url=url)
        for citation in result["citations"]
        if (url := _source_url(citation["source_url"])) is not None
    ]
    return PhotoQuestionResponse(kind="regulation", answer=result["answer"], sources=sources)


async def answer_photo_question(
    request: PhotoQuestionRequest, retrieval: ChatRetrieval | None, today: date,
) -> PhotoQuestionResponse:
    question = request.question.strip()
    recognized_text = request.recognized_text.strip()
    if not (question or recognized_text):
        return PhotoQuestionResponse(kind="hold", hold_reason="질문이나 사진에서 읽은 글자를 입력해 주세요.")

    # 제목과 행사일이 서로 다른 입력에서 섞여 행사로 판정되지 않게 한다.
    event_matches = [match_event_text(text, today) for text in (question, recognized_text) if text]
    events = [match.event for match in event_matches if match.event is not None]
    event_keys = {(event.title, event.event_date, event.notice_url, event.application_url) for event in events}
    if any("ambiguous_event" in match.reasons for match in event_matches) or len(event_keys) > 1:
        return PhotoQuestionResponse(kind="hold", hold_reason="행사 후보가 여러 개입니다. 제목과 행사일을 확인해 주세요.")
    if events:
        return PhotoQuestionResponse(kind="event", event=events[0])

    places = await get_campus_places()
    primary_text = question or recognized_text
    query_text = _place_text(primary_text)
    matches = [place for place in places if _place_text(place.name) in query_text]
    if question and recognized_text and not matches:
        query_text = _place_text(recognized_text)
        matches = [place for place in places if _place_text(place.name) in query_text]

    if len(matches) > 1:
        return PhotoQuestionResponse(kind="hold", hold_reason="장소 후보가 여러 개입니다. 찾는 장소를 하나로 좁혀 주세요.")
    if matches:
        place = matches[0]
        sources = [
            PhotoQuestionSource(title=source.title, url=url)
            for source in place.sources
            if (url := _source_url(source.url)) is not None
        ]
        if sources:
            return PhotoQuestionResponse(
                kind="campus", answer=f"{place.name} · {place.location}", sources=sources,
            )

    # 행사를 물었는데 공식 목록에서 확인하지 못했으면 규정 검색으로 넘기지 않는다.
    if any(word in _place_text(question) for word in EVENT_WORDS):
        return PhotoQuestionResponse(
            kind="hold", hold_reason="공식 행사 목록에서 이 행사를 확인하지 못했습니다. 제목과 행사일을 확인해 주세요.",
        )

    # 날짜가 든 판독문은 숫자만 겹치는 조문을 끌어오므로 검색어로 쓰지 않는다. 질문의 날짜는 막지 않는다.
    searchable_text = "" if _has_month_day(recognized_text) else recognized_text
    regulation = None
    if question:
        regulation = _regulation(retrieval, question, request.session_id)
        if regulation is None and searchable_text:
            regulation = _regulation(retrieval, f"{question}\n{searchable_text}", request.session_id)
    elif searchable_text:
        regulation = _regulation(retrieval, searchable_text, request.session_id)
    return regulation or PhotoQuestionResponse(
        kind="hold", hold_reason="공식 자료에서 답을 확인하지 못했습니다. 질문이나 읽은 글자를 확인해 주세요.",
    )
