"""검색 확인에 쓰는 가상 규정 한 건과 질문별 기대 답을 담는다.

이 파일은 시험 문제지와 정답지다. 채점받을 검색기는 여기서 불러오지 않는다.
질문마다 1위로 나와야 할 조문 경로와, 원문에서 잘라 낸 인용 문자열을 적어 둔다.
모든 문장은 지어낸 것이고 실제 학칙과 관계가 없다.
"""

from dataclasses import dataclass

# 이 길이를 넘는 조 가운데 항이 있는 조만 항 단위로 나뉜다.
# 아래 원문에서 항이 있는 조는 제7조 하나다.
MAX_CHARS = 20

SPLIT_TITLE = "제7조(구름 대출)"

Q_PARTICLE = "제3조(달빛 열람) 가상의 달빛열람증은 구름사서가 내준다."
Q_SPLIT_FIRST = "① 가상의 구름책은 이레 동안 빌린다."
Q_SPLIT_SECOND = "② 가상의 무지개책은 사흘 동안만 빌린다."
Q_ARTICLE_12 = "제12조(별빛 열람) 가상의 별빛 열람실은 자정에 연다."
Q_ARTICLE_12_2 = "제12조의2(별빛 열람 연장) 가상의 별빛 열람실은 보름날에 새벽까지 연다."
Q_CITING_12 = "제20조(이슬 준용) 가상의 이슬 열람실에는 제12조를 따른다."
Q_TIE = "제30조(모래 시계) 가상의 모래시계를 뒤집는다."
Q_ARTICLE_112 = "제112조(바람 열람) 가상의 바람 열람실은 정오에 닫는다."

SOURCE = "\n".join(
    (
        "가상 구름 도서관 규정",
        "",
        Q_PARTICLE,
        SPLIT_TITLE,
        Q_SPLIT_FIRST,
        Q_SPLIT_SECOND,
        Q_ARTICLE_12,
        Q_ARTICLE_12_2,
        Q_CITING_12,
        Q_TIE,
        Q_TIE,  # 동점 확인용으로 같은 조문을 한 번 더 둔다
        Q_ARTICLE_112,
        "",
    )
)

# chunk_articles(SOURCE, MAX_CHARS)가 원문 순서대로 내야 하는 조문 경로
CHUNK_PATHS = (
    "제3조(달빛 열람)",
    f"{SPLIT_TITLE} ①",
    f"{SPLIT_TITLE} ②",
    "제12조(별빛 열람)",
    "제12조의2(별빛 열람 연장)",
    "제20조(이슬 준용)",
    "제30조(모래 시계)",
    "제30조(모래 시계)",
    "제112조(바람 열람)",
)


@dataclass(frozen=True)
class RetrievalCase:
    """질문 하나와 1위로 나와야 할 조문 경로·원문 인용을 담는다."""

    name: str
    query: str
    article_path: str
    quote: str
    chunk_count: int = 1  # 같은 경로와 인용을 가진 검색 문단 수


# 질문에는 조사 '을'이, 원문에는 조사 '은'이 붙어 낱말 전체로는 만나지 않는다.
PARTICLE_CASE = RetrievalCase(
    name="조사 붙은 질문",
    query="달빛열람증을 누가 내주나요",
    article_path="제3조(달빛 열람)",
    quote=Q_PARTICLE,
)

# 제목이 같은 두 항 가운데 본문 낱말로 ②항을 골라야 한다.
SPLIT_CASE = RetrievalCase(
    name="항 분할",
    query="무지개책은 며칠 동안 빌리나요",
    article_path=f"{SPLIT_TITLE} ②",
    quote=Q_SPLIT_SECOND,
)
SPLIT_SIBLING_PATH = f"{SPLIT_TITLE} ①"

NUMBER_CASES = (
    RetrievalCase("조 번호 제12조", "제12조", "제12조(별빛 열람)", Q_ARTICLE_12),
    RetrievalCase(
        "조 번호 제12조의2", "제12조의2", "제12조의2(별빛 열람 연장)", Q_ARTICLE_12_2
    ),
    RetrievalCase("조 번호 제112조", "제112조", "제112조(바람 열람)", Q_ARTICLE_112),
)

# '제12조'와 두 글자 단위가 전부 겹쳐서 번호를 따로 견줘야 가를 수 있는 조문들
NUMBER_LOOKALIKE_QUERY = "제12조"
NUMBER_LOOKALIKE_PATHS = (
    "제112조(바람 열람)",
    "제12조의2(별빛 열람 연장)",
    "제20조(이슬 준용)",
)

# 같은 문장이 두 번 나오므로 점수가 같고, 원문에서 앞선 쪽이 먼저 나와야 한다.
TIE_CASE = RetrievalCase(
    name="동점",
    query="모래시계",
    article_path="제30조(모래 시계)",
    quote=Q_TIE,
    chunk_count=2,
)

# 어느 검색 문단과도 낱말이나 두 글자가 겹치지 않아 결과가 비어야 하는 질문
MISMATCH_QUERY = "얼룩말 풍금"

CASES = (PARTICLE_CASE, SPLIT_CASE, *NUMBER_CASES, TIE_CASE)
