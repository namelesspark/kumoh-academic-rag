"""사진에서 읽은 글자를 기존 행사·장소·규정 검색에 넘긴다."""

import unicodedata
from datetime import date
from urllib.parse import urlsplit

from app.schemas.photo_input import PhotoQuestionRequest, PhotoQuestionResponse, PhotoQuestionSource
from app.services.campus_guide import get_campus_places
from app.services.chat_retrieval import ChatRetrieval
from app.services.poster_lookup import match_event_text


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
        regulation = _regulation(retrieval, question, request.session_id)
        if regulation is not None:
            return regulation
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

    query = f"{question}\n{recognized_text}" if question and recognized_text else primary_text
    return _regulation(retrieval, query, request.session_id) or PhotoQuestionResponse(
        kind="hold", hold_reason="공식 자료에서 답을 확인하지 못했습니다. 질문이나 읽은 글자를 확인해 주세요.",
    )
