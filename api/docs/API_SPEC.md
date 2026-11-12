# API 명세 (초안)

프론트가 붙을 계약을 먼저 고정한다. 구현보다 이 문서가 먼저다.

Base URL: `/api/v1`

---

## POST /chat

질문을 보내고 답변을 받는다.

### Request

```json
{
  "session_id": "uuid",
  "message": "전과하려면 학점 조건이 어떻게 돼?",
  "use_academic_data": true
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `session_id` | string | 대화를 구분하는 값. 생략하거나 `null`을 보내면 서버가 발급 |
| `message` | string | 사용자 질문 |
| `use_academic_data` | bool | 학적 연동 동의 여부. `true`와 `false`만 받으며 생략 시 `false` |

`use_academic_data`를 요청마다 받는 이유 — 개인정보 조회는 사용자가 매번 통제할 수 있어야 한다.

### Response

```json
{
  "session_id": "uuid",
  "answer": "전과는 2학년 이상, 직전 학기 평점 2.5 이상일 때 신청할 수 있습니다. ...",
  "citations": [
    {
      "article_path": "제30조(전과) ①",
      "document": "학사운영규정",
      "effective_date": "2025-03-01",
      "snippet": "전과는 2학년 이상인 학생으로서 ...",
      "source_url": "https://..."
    }
  ],
  "answered": true,
  "personalized": false,
  "latency_ms": { "retrieval": 120, "generation": 1450, "total": 1610 }
}
```

| 필드 | 설명 |
|---|---|
| `citations` | **항상 포함.** 비어 있으면 `answered`는 반드시 `false` |
| `answered` | 근거 기반 답변 성공 여부 |
| `personalized` | 학적 데이터를 실제로 사용했는지 |
| `latency_ms` | 단계별 지연. 평가 지표 수집용 |

### 답변 불가 응답

```json
{
  "answer": "해당 내용은 보유한 규정 문서에서 확인할 수 없습니다. 학사지원팀(054-478-XXXX)으로 문의해 주세요.",
  "citations": [],
  "answered": false
}
```

답변 불가 응답도 성공 응답과 같은 모든 필드(`session_id`, `answer`, `citations`, `answered`, `personalized`, `latency_ms`)를 항상 포함한다. 위 예시는 달라지는 값만 보인 것이다.

**설계 원칙: 근거가 없으면 답을 만들지 않는다.** 이 경로가 정상 동작해야 시스템을 신뢰할 수 있다.

---

## GET /health

기동 확인. 검색 인덱스 로드 여부까지 포함한다.

```json
{ "status": "ok", "index_loaded": true, "chunk_count": 4821 }
```

---

## GET /graduation-demo

가상 학생의 컴퓨터공학전공 2023학년도 졸업 체크 결과를 읽는다. 요청 본문과 검색 조건은 받지 않는다.
전체 주소는 `/api/v1/graduation-demo`이다. [졸업 체크 기준표](GRADUATION_RULES.md)

- `profile`은 `label`, `department`, `admission_year`, `admission_type`, `track`, `is_fictional`을 담는다.
- `items`는 `total_credits`(학점), `major_required`(전공필수), `extracurricular`(비교과) 순서다.
- 학점의 `details`는 `credits_total`, `general_required`, `general_elective`, `msc`, `major` 순서다.
- 전공필수의 `details`는 `required_courses`, `thesis` 순서다. 비교과는 `career_education`, `counseling`, `mileage` 순서다.
- 상위와 세부 행은 `id`, `label`, `status`, `current`, `required`, `shortfall`, `reason`, `basis`를 담는다. `details`는 상위 행에만 있다.
- 상태는 `met`(충족), `short`(부족), `needs_check`(확인 필요) 중 하나다. 부족이면 `shortfall`을, 확인 필요면 `reason`을 채운다. 표시할 값이 없으면 `null`로 돌려준다.
- 상위 행은 부족, 확인 필요, 충족 순으로 세부 상태를 반영한다. 상위 부족량은 부족한 세부 행의 수다.
- 근거에는 `applied_rule`, `source_title`, `source_url`, `checked_on`이 있다. 적용 기준 문구는 항상 있고, 출처 정보는 확인한 값만 채운다.

### 비교과 프로그램 추천

`biskit_recommendations`는 졸업 체크에서 교내 비교과 시스템(BISKIT) 마일리지 부족량을 확인했을 때 채운다. 마일리지가 충족됐거나 부족량을 모르면 `null`이다.

| 필드 | 값 |
|---|---|
| `shortfall_points` | 졸업 체크 표와 같은 부족량. 1 이상 정수 |
| `listed_on` | 공개 목록 확인일 (`2026-11-13`) |
| `evaluated_at` | 한국 표준시 기준 판정 시각. 예: `2026-11-13T09:00:00+09:00` |
| `portal_url` | `https://biskit.kumoh.ac.kr/` |
| `programs` | 신청 마감일이 빠른 순서의 배열. 후보가 없으면 빈 배열 |

| 프로그램 필드 | 값 |
|---|---|
| `title`, `audience` | 공지 제목과 신청 대상 |
| `eligibility` | `eligible`(대상에 해당) 또는 `needs_check`(재학 상태 확인 필요) |
| `apply_until` | 신청 마감일 |
| `deadline_status` | `open`(모집 기간 중) 또는 `needs_check`(마감 시각이 공개되지 않은 마감일 당일) |
| `event_on` | 행사일 또는 `null` |
| `mileage_status` | `published`(점수 공개), `announced`(지급만 공지), `undisclosed`(미공개) |
| `mileage_points` | 점수가 공개됐으면 정수, 그 외에는 `null` |
| `notice_url` | 학교 도메인의 공식 HTTPS 공지 주소 또는 `null` |
| `application_url` | 해당 프로그램과 대조해 확인한 학교 도메인의 HTTPS 신청 주소 또는 `null` |
| `login_required` | 신청에 BISKIT 로그인이 필요하면 `true` |

신청 대상이 다르거나 모집 기간 밖인 프로그램은 제외한다. 접수 상태와 정원은 공식 페이지에서 확인한다.

---

## POST /poster-lookup

현수막 사진 한 장의 바이트를 그대로 보낸다. `Content-Type`은 `image/jpeg` 또는 `image/png`를 쓴다. 서버는 파일명을 받지 않고 사진이나 판독한 글자를 저장하지 않는다.

| 필드 | 의미 |
|---|---|
| `event_match` | 행사 확인 `confirmed` 또는 확인 필요 `needs_check` |
| `identified_by` | 행사 일치에 사용한 단서. 사진 글자 `text`, 공지 QR `qr_notice`, 프로그램 QR `qr_program` |
| `reasons` | 단서 부족 `no_readable_clue`, 후보 충돌 `ambiguous_event`, 마감 불일치 `deadline_mismatch`, 마감 당일 `deadline_day`, 글자 판독 불가 `text_reader_unavailable` |
| `event` | 확인된 행사 정보. 행사 확인이 필요하면 `null` |

행사 정보는 `title`, `event_date`, `official_deadline`, `poster_deadline`, `application_state`, `mileage`, `notice_url`, `application_url`, `login_required`, `checked_on`을 담는다. 현수막 마감은 월-일만 표시한다. 접수 상태는 한국 날짜 기준으로 `open`, `closed`, `needs_check`를 돌려준다. 확인한 날짜, 점수 또는 주소가 없으면 해당 값을 `null`로 표시한다. 마감이 다르면 학교 공지의 날짜를 공식 마감으로 표시한다.

요청 본문이 5MB를 넘으면 413, 사진 형식이 다르면 415, 사진을 열 수 없거나 1,200만 화소를 넘으면 422를 반환한다. 오류 본문은 `{"detail": "안내 문구"}` 형태다.

---

## GET /academic-calendar/{year}/{term}

학년도와 학기를 주소에 적어 그 학기의 학사 일정을 읽는다. 로그인과 요청 본문이 필요 없다.
전체 주소는 `/api/v1/academic-calendar/2027/1`처럼 쓴다. `year`는 네 자리 학년도, `term`은 학기 `1` 또는 `2`다.

지금 담긴 일정은 2027학년도 1학기 학부 수강신청 네 건이다. 응답은 벽에 붙은 학사 달력에서 해당 학기 칸만 오려 낸 쪽지와 같다. 쪽지마다 어느 공식 페이지를 언제 보고 적었는지 함께 적는다.

### Response

`events`는 시작일이 빠른 순서다.

```json
{
  "events": [
    {
      "audience": "1·4학년",
      "starts_on": "2027-02-11",
      "ends_on": "2027-02-12",
      "sources": [
        { "title": "학사일정", "url": "https://www.kumoh.ac.kr/ko/schedule_reg.do", "checked_on": "2026-11-13" }
      ]
    },
    {
      "audience": "2·3학년",
      "starts_on": "2027-02-15",
      "ends_on": "2027-02-16",
      "sources": [
        { "title": "학사일정", "url": "https://www.kumoh.ac.kr/ko/schedule_reg.do", "checked_on": "2026-11-13" }
      ]
    },
    {
      "audience": "신입생·편입생",
      "starts_on": "2027-02-17",
      "ends_on": "2027-02-17",
      "sources": [
        { "title": "학사일정", "url": "https://www.kumoh.ac.kr/ko/schedule_reg.do", "checked_on": "2026-11-13" }
      ]
    },
    {
      "audience": "전체 학년 (타학부·타학년 수강신청)",
      "starts_on": "2027-02-18",
      "ends_on": "2027-02-18",
      "sources": [
        { "title": "학사일정", "url": "https://www.kumoh.ac.kr/ko/schedule_reg.do", "checked_on": "2026-11-13" }
      ]
    }
  ]
}
```

| 필드 | 값 |
|---|---|
| `audience` | 수강신청 대상. 공식 학사일정의 구분을 따른다 |
| `starts_on`, `ends_on` | 신청 시작일과 종료일. 두 날 모두 신청 기간에 포함된다 |
| `sources` | 날짜를 확인한 공식 페이지. 하나 이상이며 `title`, `url`, `checked_on`(확인일)을 담는다 |

공식 목록에 시각이 없어 응답에도 시각을 넣지 않는다.

### 일정이 없는 학기

학년도와 학기가 모두 맞아야 일정이 나온다. 형식은 맞지만 담긴 일정이 없는 학기는 `200`과 빈 목록을 돌려준다. 예: `2027/2`, `2026/1`.

```json
{ "events": [] }
```

### 잘못된 요청

학년도가 네 자리 숫자가 아니거나 학기가 `1`·`2`가 아니면 `400`과 아래 [에러](#에러) 구역의 고정 문구를 돌려준다. 예: `abcd/1`, `20270/1`, `2027/0`, `2027/3`.

이 주소는 읽기 전용이다. 데이터를 보내는 요청(POST)은 `405`다.

---

## POST /feedback

답변 품질 피드백. 평가셋 보강과 오답 수집에 쓴다.

```json
{
  "session_id": "uuid",
  "message_id": "uuid",
  "helpful": false,
  "comment": "조건이 하나 빠졌음"
}
```

---

## 에러

| 코드 | 상황 |
|---|---|
| 400 | 요청 형식 오류 |
| 401 | 인증 실패 |
| 429 | 요청 한도 초과 |
| 503 | 인덱스 미로드 / LLM 응답 없음 |

에러 메시지에 내부 예외 문자열을 그대로 노출하지 않는다.

400 응답은 `{"detail": "요청 형식이 올바르지 않습니다."}`로 통일한다. 필드 누락, 잘못된 값, 읽을 수 없는 본문에도 같은 문구를 돌려준다.

---

## 미결정

- 인증 방식 — 학교 SSO 연동 가능 여부에 달려 있음. 확인 전까지는 개발용 토큰.
- 스트리밍 응답(SSE) 여부. 답변 생성이 2초를 넘으면 필요.
- Rate limit 기준.
