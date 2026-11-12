"""캠퍼스 가이드가 돌려줄 장소 목록과, 그 목록을 건네는 공급 함수.

목록은 요청 중에 파일을 읽지 않고 코드에 상수로 둔다. 테스트 도구(tests/asgi_harness.py)는
앱이 요청 처리 중 한 번이라도 대기하면 실패하는데, 파일 읽기는 대기를 만든다.

목록에 넣는 기준:
- 사람이 공식 페이지 본문과 직접 대조한 사실만 `CAMPUS_PLACES`에 넣는다. 대조한 날짜를
  출처의 `checked_on`에 적는다.
- 시간·대상·비용·찾아가는 길은 페이지에 적혀 있을 때만 채우고, 아니면 비워 둔다.
- 사진·지도·영상 파일과 학교 원문 파일은 넣지 않는다. 공식 페이지 주소만 기록한다.

항목은 `CampusPlace`로 바로 만든다. 출처가 빠졌거나 필드 이름이 틀린 항목이 있으면
이 모듈을 불러오는 시점에 오류가 나서, 잘못된 목록으로는 서버가 뜨지 않는다.
"""

from datetime import date

from app.schemas.campus_guide import CampusPlace, GuideSource


# ---------------------------------------------------------------------------
# 출처
# ---------------------------------------------------------------------------

# 데이터 출처 메모: 아래 장소의 사실은 프로젝트 담당자가 2026-11-12에 각 공식 페이지
# 본문을 읽고 대조해 전달한 결과를 그대로 옮긴 것이다. 이 코드를 작성한 도구는 학교
# 사이트를 직접 열지 못했으므로, 전달받지 않은 내용은 하나도 더하지 않았다.
# 항목을 다시 대조하면 그 항목의 출처만 새 날짜로 바꾼다.
CHECKED_ON = date(2026, 11, 12)


def _source(title: str, url: str) -> GuideSource:
    """`CHECKED_ON`에 대조한 출처 하나를 만든다.

    `title`은 그 페이지를 가리키는 짧은 이름이다. 페이지 제목을 글자 그대로 옮긴 것은 아니다.
    """

    return GuideSource(title=title, url=url, checked_on=CHECKED_ON)


CAMPUS_MAP = _source("캠퍼스 맵", "https://www.kumoh.ac.kr/ko/campusMap.do")
CAMPUS_MAP_2026 = _source(
    "2026 캠퍼스 조감도",
    "https://www.kumoh.ac.kr/iplec/sub060201.do?articleNo=546739&attachNo=159714&mode=download",
)
CAMPUS_TEL = _source("교내 전화번호·학사지원실", "https://www.kumoh.ac.kr/ko/campusTel02.do")
MAIN_HALL_OFFICES = _source("본관 부서 안내", "https://www.kumoh.ac.kr/ko/sub02_03_03_01.do")
MEETING_ROOMS = _source("산학협력관 대회의실 안내", "https://www.kumoh.ac.kr/ko/sub04_03_10_01.do")
STUDENT_UNION_OFFICES = _source("학생회관 부서 안내", "https://www.kumoh.ac.kr/ko/sub01_03_02_01.do")
MEDICAL_SUPPORT = _source("의료지원실 안내", "https://www.kumoh.ac.kr/ko/sub04_02_02_01.do")
CAFETERIA = _source("학생식당 안내", "https://tec.kumoh.ac.kr/ko/sub04_03_05_01.do")
CAFETERIA_HOURS = _source("생활협동조합 식당 운영시간", "https://kitcoop.kumoh.ac.kr/kitcoop/sub0210.do")
PRINT_COPY = _source("인쇄·복사 안내", "https://www.kumoh.ac.kr/ko/sub04_03_05_04.do")
TUMBLER_WASHER = _source(
    "텀블러 세척기 공지",
    "https://www.kumoh.ac.kr/ko/sub06_01_01_03.do?articleNo=580781&mode=view",
)

# 이슈에 주소가 적혀 있지만 본문 대조 결과가 아직 없는 공지성 자료. 응답에는 나가지 않는다.
# 대조한 뒤에 `CAMPUS_PLACES`로 옮기고, 기간이 정해진 공지는 `valid_period`를 적는다.
PENDING_OFFICIAL_PAGES: dict[str, str] = {
    "학생식당 공지": "https://www.kumoh.ac.kr/dorm/sub0401.do?articleNo=554382&mode=view",
    "셔틀": "https://www.kumoh.ac.kr/ko/sub04_02_07_01.do",
    "에듀롬": "https://www.kumoh.ac.kr/ko/sub06_01_01_03.do?articleNo=580770&mode=view",
}


# ---------------------------------------------------------------------------
# 장소 목록
# ---------------------------------------------------------------------------

# 대조 결과에 없는 값은 적지 않았다. 운영 시간·이용 대상·비용·찾아가는 길은 모든 항목에서
# 비어 있다. 식당 운영 시간은 자주 바뀌므로 값을 옮기지 않고 운영시간 페이지를 출처로만 붙였다.
# 지도 번호는 건물에만 적는다. 건물 안 시설은 `location`에 건물 이름과 호실을 적는다.
CAMPUS_PLACES: tuple[CampusPlace, ...] = (
    # --- 건물 ---------------------------------------------------------------
    CampusPlace(
        id="techno-hall",
        name="테크노관",
        category="building",
        purpose="기계·신소재 학사지원실이 있는 건물",
        location="양호동 캠퍼스, 공식 캠퍼스 지도 1번",
        map_number="1",
        sources=[CAMPUS_MAP, CAMPUS_MAP_2026, CAMPUS_TEL],
    ),
    CampusPlace(
        id="digital-hall",
        name="디지털관",
        category="building",
        purpose="전자·컴퓨터 학사지원실이 있는 건물",
        location="양호동 캠퍼스, 공식 캠퍼스 지도 2번",
        map_number="2",
        sources=[CAMPUS_MAP, CAMPUS_MAP_2026, CAMPUS_TEL],
    ),
    CampusPlace(
        id="global-hall",
        name="글로벌관",
        category="building",
        purpose="건축·토목·환경 학사지원실과 교양학부가 있는 건물",
        location="양호동 캠퍼스, 공식 캠퍼스 지도 3번",
        map_number="3",
        sources=[CAMPUS_MAP, CAMPUS_MAP_2026, CAMPUS_TEL],
    ),
    CampusPlace(
        id="student-union",
        name="학생회관",
        category="building",
        purpose="학생복지팀(101호), 의료지원실(103호), 학생상담센터(202호)가 있는 건물",
        location="양호동 캠퍼스, 공식 캠퍼스 지도 5번",
        map_number="5",
        sources=[CAMPUS_MAP, CAMPUS_MAP_2026, STUDENT_UNION_OFFICES, MEDICAL_SUPPORT],
    ),
    CampusPlace(
        id="main-hall",
        name="본관(대학본부 및 강당)",
        category="building",
        purpose="대학본부와 강당. 학생지원팀(101호)과 학사관리팀(303호)이 있음",
        location="양호동 캠퍼스, 공식 캠퍼스 지도 6번",
        map_number="6",
        sources=[CAMPUS_MAP, CAMPUS_MAP_2026, MAIN_HALL_OFFICES],
    ),
    CampusPlace(
        id="industry-academic-hall",
        name="산학협력관",
        category="building",
        purpose="대회의실(104호)이 있는 건물",
        location="양호동 캠퍼스, 공식 캠퍼스 지도 29번",
        map_number="29",
        sources=[CAMPUS_MAP, CAMPUS_MAP_2026, MEETING_ROOMS],
    ),
    # --- 건물 안 시설 ---------------------------------------------------------
    # 학생식당은 이슈가 "건물 7곳"으로 묶어 부르지만, 학교 복지시설 표(`CAFETERIA` 출처)에
    # 일품식당 B104, 정찬식당 B106, 분식당 B101이 학생회관으로 적혀 있다. 공식 지도에 자기
    # 번호가 없으므로 "facility"로 두고 지도 번호를 비운다.
    CampusPlace(
        id="student-cafeteria",
        name="학생식당",
        category="facility",
        purpose="일품식당, 정찬식당, 분식당으로 나뉜 학생 식당",
        location="학생회관 지하. 일품식당 B104, 정찬식당 B106, 분식당 B101",
        sources=[CAFETERIA, CAFETERIA_HOURS],
    ),
    CampusPlace(
        id="medical-support-room",
        name="의료지원실",
        category="facility",
        purpose="의료 지원",
        location="학생회관 103호",
        sources=[MEDICAL_SUPPORT, STUDENT_UNION_OFFICES],
    ),
    CampusPlace(
        id="print-copy",
        name="인쇄·복사",
        category="facility",
        purpose="문서 인쇄와 복사. 휴대폰으로 파일을 올린 뒤 PIN 번호로 출력할 수 있음",
        location="도서관 1·2층 복사실",
        sources=[PRINT_COPY],
    ),
    # 공지성 자료의 대조 근거:
    #   - 대조한 페이지: 텀블러 세척기 공지(아래 `TUMBLER_WASHER` 출처의 주소)
    #   - 대조한 자료: 공지 본문에 실린 2026-10-28 생활협동조합 포스터.
    #   - 대조한 날: 2026-11-12. 독립 검토 에이전트가 포스터를 직접 읽고 결과를 전달했다.
    #   - 포스터에서 확인한 사실: 도서관 쿱카페와 분식당에 총 두 대가 설치됐다.
    #   - 비워 둔 것: 이용 시간·대상·비용. 포스터에 표기가 없었다. 적용 기간과 사용 방법도
    #     전달받은 결과에 없어 적지 않았다.
    CampusPlace(
        id="tumbler-washer",
        name="텀블러 세척기",
        category="facility",
        purpose="텀블러 세척",
        location="도서관 쿱카페와 분식당 (총 두 대)",
        sources=[TUMBLER_WASHER],
    ),
)


async def get_campus_places() -> list[CampusPlace]:
    """장소 목록을 건네는 공급 함수.

    주소 처리 함수가 이 함수를 `Depends`로 받는다. 테스트는 FastAPI의
    `app.dependency_overrides`로 이 자리에 가상 장소를 돌려주는 함수를 끼워 넣는다.
    대기 없이 끝나야 하므로 `async def`이고, 안에서 파일이나 네트워크를 기다리지 않는다.
    """

    return list(CAMPUS_PLACES)
