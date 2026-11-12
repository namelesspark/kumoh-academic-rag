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

from app.schemas.campus_guide import CampusPlace


# ---------------------------------------------------------------------------
# 대조를 기다리는 공식 페이지
# ---------------------------------------------------------------------------

# 이슈에 적힌 공식 페이지 주소. 이름은 이슈에서 부른 이름이고, 페이지의 실제 제목과
# 본문은 아직 대조하지 못했다. 응답에는 나가지 않는다. 항목을 대조해 `CAMPUS_PLACES`에
# 옮길 때 여기서 주소를 가져다 쓴다.
PENDING_OFFICIAL_PAGES: dict[str, str] = {
    # 건물 7곳(글로벌관·테크노관·디지털관·산학협력관·본관·학생회관·학생식당)
    "캠퍼스 맵": "https://www.kumoh.ac.kr/ko/campusMap.do",
    "2026 공식 지도": (
        "https://www.kumoh.ac.kr/iplec/sub060201.do?articleNo=546739&attachNo=159714&mode=download"
    ),
    "교내 전화번호·학사지원실": "https://www.kumoh.ac.kr/ko/campusTel02.do",
    "본관 부서": "https://www.kumoh.ac.kr/ko/sub02_03_03_01.do",
    # 편의시설
    "의료지원실": "https://www.kumoh.ac.kr/ko/sub04_02_02_01.do",
    "인쇄·복사": "https://www.kumoh.ac.kr/ko/sub04_03_05_04.do",
    # 공지성 자료. 본문을 대조한 경우에만 넣고, 기간이 정해진 공지는 `valid_period`를 적는다.
    "학생식당 공지": "https://www.kumoh.ac.kr/dorm/sub0401.do?articleNo=554382&mode=view",
    "셔틀": "https://www.kumoh.ac.kr/ko/sub04_02_07_01.do",
    "에듀롬": "https://www.kumoh.ac.kr/ko/sub06_01_01_03.do?articleNo=580770&mode=view",
    "텀블러 세척기": "https://www.kumoh.ac.kr/ko/sub06_01_01_03.do?articleNo=580781&mode=view",
}


# ---------------------------------------------------------------------------
# 장소 목록
# ---------------------------------------------------------------------------

# 지금은 비어 있다. 이 코드를 작성한 환경에서 학교 사이트를 열 수 없어 어느 항목도 공식
# 페이지와 대조하지 못했고, 용도·위치를 추정으로 채우지 않았다.
#
# 항목을 넣는 모양(가상 예시):
#     CampusPlace(
#         id="fictional-hall",
#         name="가상관",
#         category="building",
#         purpose="공식 페이지에 적힌 용도",
#         location="공식 페이지에 적힌 위치",
#         sources=[
#             GuideSource(
#                 title="공식 페이지의 실제 제목",
#                 url="https://example.invalid/campus-map",
#                 checked_on=date(2099, 1, 1),
#             )
#         ],
#     )
CAMPUS_PLACES: tuple[CampusPlace, ...] = ()


async def get_campus_places() -> list[CampusPlace]:
    """장소 목록을 건네는 공급 함수.

    주소 처리 함수가 이 함수를 `Depends`로 받는다. 테스트는 FastAPI의
    `app.dependency_overrides`로 이 자리에 가상 장소를 돌려주는 함수를 끼워 넣는다.
    대기 없이 끝나야 하므로 `async def`이고, 안에서 파일이나 네트워크를 기다리지 않는다.
    """

    return list(CAMPUS_PLACES)
