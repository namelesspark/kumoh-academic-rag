# api — 백엔드 서버

금오공대 학사 행정 RAG 챗봇의 **백엔드 서버**.
FastAPI 기반. 검색 결과와 학적 데이터를 조합해 LLM 답변을 생성하고, 대화 세션을 관리한다.

검색 자체는 [`core/`](../core) 를 import 해서 쓴다.

---

## 책임 경계

| 하는 일 | 하지 않는 일 |
|---|---|
| HTTP API (`/api/v1/chat`) | 문서 파싱 / 인덱스 빌드 |
| Agent 루프 (검색 ↔ 학적 조회 ↔ 재검색) | BM25 / Dense 검색 구현 |
| LLM 프롬프트 구성 및 호출 | 프론트엔드 렌더링 |
| 학적 API 클라이언트 | |
| 인증 / 세션 / 로깅 | |

---

## 디렉토리 구조

```
api/
├── app/
│   ├── main.py           # FastAPI 진입점
│   ├── api/v1/           # 라우터 (chat, health, feedback)
│   ├── agents/           # Agent 루프 — 도구 선택, 반복 검색, 종료 조건
│   ├── services/         # 비즈니스 로직 (답변 생성, 인용 부착, 거부 판단)
│   ├── clients/          # 외부 연동 — LLM, 학적 API, rag-core 래퍼
│   ├── core/             # 설정, 로깅, 예외, 의존성 주입
│   ├── models/           # DB 모델 (세션, 대화 로그)
│   └── schemas/          # Pydantic 요청·응답 스키마
├── configs/              # 프롬프트 템플릿, 모델 설정
├── scripts/
├── tests/
└── docs/
    ├── API_SPEC.md
    ├── AGENT_DESIGN.md
    └── PROMPTING.md
```

---

## 왜 이렇게 나눴나

**`agents` / `services` 분리** — Agent 루프는 "검색 → 부족하면 학적 조회 → 재검색 → 종료" 판단만 한다.
답변 문자열을 만들고 인용을 붙이는 건 services다. 섞으면 루프 로직 테스트가 LLM 호출에 묶여버린다.

**`clients` 격리** — LLM(API vs 로컬 sLLM)과 학적 API는 둘 다 교체·모킹 대상이다.
학적 API는 개발 중 실제 호출이 어려울 가능성이 높아, 처음부터 mock 구현체를 함께 둔다.

**`configs`에 프롬프트 분리** — "소스 문서 외 답변 금지" 제약 문구는 계속 수정하게 된다.
코드에 하드코딩하면 변경 이력이 diff에 묻힌다. YAML/텍스트로 빼두면 프롬프트 버전 관리가 된다.

---

## Agent 루프 개요

```
질문 입력
  │
  ▼ 개인화 필요 여부 판단
  ├─ 불필요 → core.retrieve() → 답변 생성
  └─ 필요   → 학적 API 조회 → 프로필 + 질문으로 재검색
                 → 조건 대조·연산 (예: 졸업 학점 - 이수 학점)
                 → 답변 생성
  │
  ▼ 근거 검증: 검색된 청크로 뒷받침되지 않는 서술이 있는가?
  ├─ 있음 → 해당 부분 제거 또는 "행정실 문의" 안내로 대체
  └─ 없음 → 인용(조문 번호) 부착 후 반환
```

마지막 근거 검증 단계가 환각 통제의 마지막 방어선이다. 프롬프트 제약만으로는 새는 경우가 있다.

---

## 개발 예정 순서

1. `main.py` + `/health` — 서버 기동 확인
2. `schemas` + `/api/v1/chat` 스텁 — 프론트가 붙을 계약 먼저 고정
3. `clients/llm` + 단순 RAG 응답 (Agent 없이 1회 검색 → 생성)
4. `clients/academic` mock — 가상 학적 데이터로 개인화 경로 검증
5. `agents` — 반복 루프 및 종료 조건
6. 근거 검증 단계 + 거부 로직

3번까지가 동작하면 프론트 연동을 시작할 수 있다.

---

## 로컬에서 규정 파일 한 건으로 실행하기

공개 데모는 코드에 적어 둔 가상 규정만 검색한다. 운영자가 자기 컴퓨터에 있는 규정 텍스트 한 건을
검색에 연결하려면 `api/local_serve.py`의 `create_local_app`을 쓴다. 도서관 사서에게 책 한 권과
서지 카드를 함께 건네는 것과 같다. 책은 파일이고, 카드는 문서명·시행일·공식 링크다.

설정은 환경 변수 네 개로 준다. 하나라도 없거나 틀리면 서버가 뜨지 않고, 오류 문구에는 설정 이름과
이유만 나온다.

| 환경 변수 | 넣는 값 | 검사 |
|---|---|---|
| `KUMOH_REGULATION_PATH` | 규정 텍스트 파일 경로 | 읽을 수 있고 UTF-8(Unicode Transformation Format, 8-bit)로 저장한 파일 |
| `KUMOH_REGULATION_TITLE` | 인용에 표시할 문서명 | 공백뿐이면 거부 |
| `KUMOH_REGULATION_EFFECTIVE_DATE` | 시행일 | `YYYY-MM-DD` 모양이고 달력에 있는 날 |
| `KUMOH_REGULATION_SOURCE_URL` | 공식 링크 | `https`, 브라우저가 열 수 있는 호스트 있음, 아이디·비밀번호 없음, 공백·제어 문자 없음 |

저장소 루트에서 PowerShell로 실행하는 예시다. 값은 모두 가상이다.

```powershell
$env:KUMOH_REGULATION_PATH = "api/tests/fixtures/fictional_regulation.txt"
$env:KUMOH_REGULATION_TITLE = "가상 솔바람 온실 규정"
$env:KUMOH_REGULATION_EFFECTIVE_DATE = "2099-03-04"
$env:KUMOH_REGULATION_SOURCE_URL = "https://example.invalid/regulations/greenhouse"
python -m uvicorn api.local_serve:create_local_app --factory
```

`--factory`는 웹 서버(uvicorn)가 시작할 때 `create_local_app()`을 불러 앱을 만들게 하는 옵션이다.

**먼저 확인할 것** — 이 명령은 앱 조립 모듈 `api/regulation_app.py`가 있는 체크아웃에서만 뜬다.
그 파일이 없으면 `create_local_app`이 `api.regulation_app: 앱 조립 모듈이 없습니다`라는 오류를 내고
멈춘다. 이때는 그 모듈이 들어 있는 main을 받아 온 뒤 다시 실행한다.

지켜야 할 점:

- **실제 규정 원문은 저장소 밖에 둔다.** 저장소 안에 복사하지 않고, 커밋하지 않고, 이슈·PR·공개 답변에
  붙이지 않는다. 저장소에는 `api/tests/fixtures/fictional_regulation.txt` 같은 가상 파일만 둔다.
- 서버는 기동 중에 공식 링크를 열어 보지 않는다. 주소 모양만 검사하므로, 그 링크가 학교의 공식
  출처인지는 입력한 사람이 확인한다.
- 파일은 줄바꿈과 맨 앞 표식(BOM, Byte Order Mark)을 바꾸지 않고 읽는다. 조문을 나눌 때와 인용할 때
  같은 문자열을 써야 글자 위치가 맞기 때문이다.
- 조문(`제1조(제목)` 모양의 줄)을 하나도 찾지 못하면 서버가 뜨지 않는다.

확인 명령:

```
python -B -m unittest api.tests.test_local_serve -v
```

---

## 로컬에서 규정 파일 여러 건으로 실행하기

규정이 여러 문서면 `create_local_manifest_app`에 목록 파일 하나를 준다. 도서관에 책이 여러 권
들어와도 찾아보기 카드함은 하나만 두는 것과 같다. 카드마다 어느 책인지 적혀 있어, 같은 `제1조`가
여러 문서에 있어도 답변은 그 조문이 속한 문서의 이름·시행일·링크를 붙인다.

목록 파일은 중괄호와 따옴표로 값을 적는 텍스트 형식(JSON, JavaScript Object Notation)이다.
아래 값은 모두 가상이다.

```json
{
  "documents": [
    {
      "path": "fictional_manifest_first.txt",
      "document_title": "가상 달무리 천문대 규정",
      "effective_date": "2099-03-04",
      "source_url": "https://example.invalid/regulations/observatory"
    },
    {
      "path": "fictional_manifest_second.txt",
      "document_title": "가상 은여울 목공방 규정",
      "effective_date": "2098-11-20",
      "source_url": "https://example.invalid/regulations/woodshop"
    }
  ]
}
```

| 필드 | 넣는 값 | 검사 |
|---|---|---|
| `path` | 규정 텍스트 파일 경로. 상대 경로는 목록 파일이 있는 폴더 기준 | 읽을 수 있고 UTF-8로 저장한 파일 |
| `document_title` | 인용에 표시할 문서명 | 공백뿐이면 거부 |
| `effective_date` | 시행일 | `YYYY-MM-DD` 모양이고 달력에 있는 날 |
| `source_url` | 공식 링크 | 한 건 실행의 `KUMOH_REGULATION_SOURCE_URL`과 같은 검사 |

목록 규칙:

- 목록 파일도 UTF-8로 저장한다. 윈도우 편집기가 맨 앞에 붙이는 표식(BOM)은 목록 파일에서만 떼고 읽는다.
  규정 파일의 표식과 줄바꿈은 한 건 실행과 같이 그대로 둔다.
- 최상위는 `documents` 하나만 가진 객체이고, `documents`는 비어 있지 않은 배열이다.
- 항목은 위 네 필드를 모두 문자열로 적는다. 모르는 필드나 두 번 적은 필드가 있으면 거부한다.
  필드 이름의 오타를 드러내기 위해서다.
- `\ud800`처럼 UTF-8로 적을 수 없는 글자가 든 값은 거부한다. 그대로 두면 답변을 내보낼 때 실패한다.
- 윈도우에서 `D:파일이름`처럼 드라이브 글자 뒤에 폴더 구분이 없는 `path`는 거부한다. 이 모양은
  그 드라이브의 현재 폴더에 따라 가리키는 파일이 달라진다. `D:/폴더/파일이름`처럼 적는다.
- 목록에 적은 순서대로 문서를 넘긴다.

환경 변수는 `KUMOH_REGULATION_MANIFEST_PATH` 하나다. 저장소 루트에서 PowerShell로 실행하는 예시다.

```powershell
$env:KUMOH_REGULATION_MANIFEST_PATH = "api/tests/fixtures/fictional_manifest.json"
python -m uvicorn api.local_serve:create_local_manifest_app --factory
```

항목 하나라도 틀리거나 파일 하나라도 읽지 못하면 서버가 뜨지 않는다. 오류 문구는
`documents[1].effective_date: 달력에 없는 날짜입니다.`처럼 0부터 센 항목 번호, 필드명, 이유만 담는다.
경로, 입력값, 파일 내용은 나오지 않는다. 조문을 하나도 찾지 못한 문서가 있을 때도
`documents[1]: 검색할 조각을 찾지 못했습니다.`로 멈춘다.

**먼저 확인할 것** — 이 명령은 `api/regulation_app.py`에 여러 문서를 받는 조립 함수
`create_regulations_app`이 있는 체크아웃에서만 뜬다. 없으면
`api.regulation_app: create_regulations_app 함수가 없습니다`라는 오류를 내고 멈춘다.

한 건 실행의 지켜야 할 점은 여기서도 같다. 실제 규정 원문과 그 경로를 적은 목록 파일은 저장소 밖에 둔다.

확인 명령:

```
python -B -m unittest api.tests.test_local_manifest -v
```

---

## 데이터 취급

학적 데이터는 **저장하지 않고 통과만 시킨다.** 응답 생성에 쓴 뒤 세션 종료 시 폐기한다.
대화 로그를 남긴다면 학적 필드를 마스킹한 뒤 저장한다.
자세한 내용은 [`docs/DATA_POLICY.md`](../docs/DATA_POLICY.md).

## 관련 리포

- [`core/`](../core) — 파싱·검색 코어
- [`web/`](../web) — React 클라이언트
