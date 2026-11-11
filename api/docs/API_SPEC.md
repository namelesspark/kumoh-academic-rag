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
