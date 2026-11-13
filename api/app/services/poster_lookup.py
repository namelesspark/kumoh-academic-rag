"""사진에서 읽은 단서를 공개 프로그램 목록과 대조한다."""

import re
import unicodedata
from datetime import date
from urllib.parse import parse_qs, urlsplit

from app.schemas.poster_lookup import Clue, PosterEvent, PosterLookupResponse, Reason
from app.services.biskit_recommendations import LISTED_ON, PROGRAMS, official_url
from app.services.poster_recognition import Recognition


PROGRAM_PATH = "/ptfol/imng/icmpNsbjtPgm/findIcmpNsbjtPgmInfo.do"
LOGIN_PATH = "/common/user/login.do"
BISKIT_HOST = "biskit.kumoh.ac.kr"
NOTICE_PATH = re.compile(r"/(?:ko|md)/sub[0-9_]+\.do")
MONTH_DAY = r"(?P<month>[0-9]{1,2})\s*(?:[./-]|월)\s*(?P<day>[0-9]{1,2})(?![0-9])"
EVENT_DATE = re.compile(r"(?<![0-9])(?P<year>20[0-9]{2})\s*(?:[./-]|년)\s*" + MONTH_DAY)
DEADLINE_DATE = re.compile(
    r"(?:(?:신청|접수)\s*)?마감(?:일)?[\s:：]*"
    r"(?:20[0-9]{2}\s*(?:[./-]|년)\s*)?" + MONTH_DAY
)


def _qr_key(url: str | None) -> tuple[str, str, str, str] | None:
    if official_url(url) is None:
        return None
    parts = urlsplit(url)
    query = parse_qs(parts.query, keep_blank_values=True)
    if parts.hostname == BISKIT_HOST and parts.path == PROGRAM_PATH:
        kind, values = "qr_program", query.get("encSddpbSeq", [])
    elif NOTICE_PATH.fullmatch(parts.path) and query.get("mode") == ["view"]:
        kind, values = "qr_notice", query.get("articleNo", [])
    else:
        return None
    if len(values) == 1 and re.fullmatch(r"[0-9]+", values[0]):
        return kind, parts.hostname, parts.path, values[0]
    return None


def _catalog_program_key(url: str | None) -> tuple[str, str, str, str] | None:
    if official_url(url) is None:
        return None
    parts = urlsplit(url)
    if parts.hostname == BISKIT_HOST and parts.path == LOGIN_PATH:
        targets = parse_qs(parts.query).get("rtnUrl", [])
        if len(targets) == 1 and targets[0].startswith(PROGRAM_PATH + "?"):
            return _qr_key(f"https://{BISKIT_HOST}{targets[0]}")
    return _qr_key(url)


def _compact(text: str) -> str:
    return "".join(char for char in text.casefold() if char.isalnum())


def _date_parts(match: re.Match) -> tuple[int, int]:
    return int(match["month"]), int(match["day"])


def _poster_deadline(text: str) -> str | None:
    dates = set()
    for match in DEADLINE_DATE.finditer(text):
        month, day = _date_parts(match)
        try:
            date(2000, month, day)  # 2월 29일도 연도 없이 기록할 수 있다.
        except ValueError:
            continue
        dates.add(f"{month:02d}-{day:02d}")
    return next(iter(dates)) if len(dates) == 1 else None


def match_poster(recognition: Recognition, today: date) -> PosterLookupResponse:
    return match_event_text(
        recognition.text, today, qr_codes=recognition.qr_codes,
        text_available=recognition.text_available,
    )


def match_event_text(
    text: str, today: date, *, qr_codes: tuple[str, ...] = (), text_available: bool = True,
) -> PosterLookupResponse:
    text = unicodedata.normalize("NFKC", text)
    event_text = DEADLINE_DATE.sub("", text)
    date_parts = {(int(match["year"]), *_date_parts(match)) for match in EVENT_DATE.finditer(event_text)}
    compact_text = _compact(text)
    qr_keys = {_qr_key(url) for url in qr_codes} - {None}
    reasons: list[Reason] = []
    matches = []

    for program in PROGRAMS:
        clues: list[Clue] = []
        event_date = program.event_on
        if (
            event_date is not None
            and (event_date.year, event_date.month, event_date.day) in date_parts
            and program.poster_keywords
            and all(_compact(word) in compact_text for word in program.poster_keywords)
        ):
            clues.append("text")
        if any(_qr_key(url) in qr_keys for url in (program.notice_url, *program.poster_notice_aliases)):
            clues.append("qr_notice")
        if _catalog_program_key(program.application_url) in qr_keys:
            clues.append("qr_program")
        if clues:
            matches.append((program, clues))

    if len(matches) != 1:
        reasons.append("ambiguous_event" if matches else "no_readable_clue")
        if not text_available:
            reasons.append("text_reader_unavailable")
        return PosterLookupResponse(event_match="needs_check", identified_by=[], reasons=reasons, event=None)

    program, clues = matches[0]
    deadline = _poster_deadline(text)
    if deadline and deadline != program.apply_until.strftime("%m-%d"):
        reasons.append("deadline_mismatch")
    if today == program.apply_until:
        reasons.append("deadline_day")
        state = "needs_check"
    elif program.apply_from <= today < program.apply_until:
        state = "open"
    else:
        state = "closed"

    application_url = official_url(program.application_url)
    return PosterLookupResponse(
        event_match="confirmed",
        identified_by=clues,
        reasons=reasons,
        event=PosterEvent(
            title=program.title,
            event_date=program.event_on,
            official_deadline=program.apply_until,
            poster_deadline=deadline,
            application_state=state,
            mileage=program.mileage_points if program.mileage_status == "published" else None,
            notice_url=official_url(program.notice_url),
            application_url=application_url,
            login_required=bool(application_url and program.login_required),
            checked_on=LISTED_ON,
        ),
    )
