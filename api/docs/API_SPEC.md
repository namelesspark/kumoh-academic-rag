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
