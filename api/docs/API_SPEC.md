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
| `mode` | string | AI 답변 방식. `"fast"`(빠르게)와 `"deep"`(깊이 생각하기)만 받으며 생략 시 `"fast"`. 다른 값은 400 |
| `lang` | string | 답변 언어. `"ko"`, `"en"`, `"zh"`. 생략하거나 다른 값이면 오류 없이 `"ko"`로 처리 |

일반 요청과 조각 전송 요청 모두 같은 `lang` 규칙을 쓴다. `lang`이 없거나 `"ko"`이면 기존
`answer`, `notice`, `citations`, 보류 문구와 `notice` 유무를 그대로 유지한다.
`en`·`zh` 요청은 해당 언어로 AI 답변과 보류·실패 안내를 제공한다. 인용의 문서명·조 번호·본문은 한국어 원문이다.
AI가 꺼진 상태에서 외국어 질문이 오면 한국어로 질문할 것을 권하는 안내를 선택한 언어로 덧붙인다.

`en`·`zh` 요청에서 한글 비율이 20% 미만인 질문만 AI로 한국어 검색어로 바꾼다.
글자가 없거나 정확히 20%이면 변환하지 않는다. 변환 실패 시 원문으로 검색한다.
변환 결과는 검색과 관련성 판정에만 쓰고 응답에 포함하지 않는다. AI 답변에는 원래 질문을 보낸다.
조각 전송의 `meta`는 변환과 검색이 끝난 뒤 보낸다. 두 AI 호출은 동시 호출 자리 하나와 전체 90초를 공유하며,
첫 글자 25초 제한은 호출마다 적용한다. 연결 종료 시 변환 호출도 취소한다.

영어·중국어 요청의 `thinking` 이벤트에는 `label`도 보낸다. 각각 `Original model reasoning`,
`模型思考原文`이며 모델의 생각 원문은 번역하지 않는다.

`use_academic_data`를 요청마다 받는 이유 — 개인정보 조회는 사용자가 매번 통제할 수 있어야 한다.

AI 답변(설정 세 개가 모두 있을 때만 켜짐, [배포 안내](RENDER_DEPLOY.md#ai-답변-연결-선택))이 켜져 있고 근거 조문이 있으면 `answer`에 AI가 쓴 완성된 답을 담는다. 근거(`citations`)는 늘 검색 결과로 만들고 모델이 쓴 주소나 조 번호는 더하지 않는다. AI 답을 만들지 못하면 지금의 조문 원문 답을 담고 `notice` 문자열 필드(`"AI 답변을 만들지 못해 근거 조문만 보여 드려요"`)를 더한다. 그 밖의 응답에는 `notice`가 없다. AI가 꺼져 있으면 지금 답을 그대로 돌려준다. AI가 켜진 채팅은 핵심 낱말 하나 이상(끝 한 글자를 뗀 두 글자 이상 줄기 포함)으로 후보를 고른다. 줄별 검사와 조 번호 일치 규칙은 유지한다. 순위대로 최대 3개의 snippet 합계가 3000자를 넘으면 낮은 순위부터 빼고 재충원하지 않는다. 1위 단독 초과는 그 하나만 보낸다. 사진 질문은 엄격한 검사를 유지한다. 답을 기다리는 사이 브라우저가 연결을 끊으면 서버가 AI 요청을 취소하고 동시 호출 자리를 돌려준다. 끊김을 알 수 없는 연결은 AI의 전체 90초 제한이 상한이다.

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

## POST /chat/stream

`POST /chat`과 같은 요청 본문을 받아 답을 조각 전송(SSE, Server-Sent Events)으로 흘려보낸다. 조각 전송은 서버가 응답 하나를 닫지 않고 글자를 조금씩 보내는 방식이다. 수도꼭지를 틀어 두고 물을 받는 것과 같다.

- 응답 헤더: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- 이벤트 하나는 `event: 이름` 줄, 한 줄짜리 JSON인 `data:` 줄, 빈 줄로 이룬다.
- 요청 형식 오류는 스트림을 열지 않고 `POST /chat`과 같은 400 고정 문구를 돌려준다.

| 이름 | `data` 모양 | 규칙 |
|---|---|---|
| `meta` | `{"answered":true,"citations":[…],"session_id":"…","personalized":false}` | 항상 첫 이벤트. `citations`는 `POST /chat`과 같은 모양. 보류면 `answered:false`와 빈 목록 |
| `thinking` | `{"text":"…"}` | `mode:"deep"`에서만 보낸다. 모델이 쓴 생각 원문이라 영어일 수 있다 |
| `answer` | `{"text":"…","replace":false}` | 이어 붙인다. `replace:true`면 그때까지 그린 답을 지우고 새로 쓴다 |
| `notice` | `{"text":"AI 답변을 만들지 못해 근거 조문만 보여 드려요"}` | 대체 답일 때 한 번 |
| `done` | `{"latency_ms":{"retrieval":0,"generation":0,"total":0}}` | 정상·보류·대체의 마지막 |
| `error` | `{"code":"stream_failed","message":"답변을 받지 못했어요"}` | 예상하지 못한 오류. 고정 문구만 싣는다 |

| 상황 | 이벤트 순서 |
|---|---|
| AI 답 | `meta` → (`thinking`…) → `answer`… → `done` |
| AI 꺼짐 보류 | `meta` → `answer`(보류 안내) → `done` |
| AI 꺼짐, 연결 실패, 시간 초과, 200이 아닌 응답, 깨진 데이터, 빈 답, 자리 대기 만료 | `meta` → (`answer`…) → `answer`(조문 원문, 앞서 보낸 답이 있으면 `replace:true`) → `notice` → `done` |
| 검색이 연결되지 않은 임시 응답 | `meta` → `answer`(지금 답) → `done` |

- `mode:"fast"`는 위쪽 서버에 `reasoning_effort:"none"`을 보내고, `"deep"`은 이 필드를 보내지 않는다. `fast`에서 생각 조각이 와도 버린다.
- AI에는 시스템 지시, 근거 조문(규정명·조 번호·본문), 질문만 보낸다. 이전 대화와 학적 정보는 보내지 않는다. 지시 내용은 [프롬프트 설계](PROMPTING.md#ai-답변-지시)에 있다.
- 브라우저가 연결을 끊으면 서버가 위쪽 요청과 자리 대기를 취소하고 동시 호출 자리를 돌려준다.
- 화면은 모르는 이벤트 이름을 무시하고, `done` 없이 끝난 연결은 실패로 본다.

---

### AI 보류와 안내 응답

완성된 답의 앞뒤 공백을 정리한 뒤 `규정 문서에서 근거를 찾지 못했어요`로 시작하면
뒤 권유 문장도 버린다. SSE(답 조각 전송)는 기존 보류 문구를 `answer`의 `replace:true`로
교체하고 `done`에 `answered:false`를 더한다. JSON은 기존 보류 문구와 `answered:false`,
`citations:[]`를 반환하며 notice가 없다. 중간에 등장하는 문장은 보류 판정에 쓰지 않는다.

AI가 켜진 채팅에서 후보가 없으면 질문만 보내 안내 모드로 한 번 호출한다.
테크모라는 금오공대 학사 안내 도우미가 한두 문장으로 인사·연결 확인에 답하고 졸업 요건,
학사 일정, 규정 질문을 안내한다. 학사 질문에는 근거 없음과 구체적인 재질문 또는
학사지원실 확인을 권한다. 규정 내용·숫자·날짜·기간을 지어내지 않고 마크다운을 쓰지 않는다.
조문 구획·이전 대화·학적 정보는 보내지 않는다.

| 경우 | meta | done 추가 필드 | JSON 추가·변경 필드 |
|---|---|---|---|
| 일반 AI 답 | `answered:true`, 근거 목록 | 없음 | 없음 |
| AI 보류 | `answered:true`, 근거 목록 | `answered:false` | `answered:false`, `citations:[]` |
| 안내 성공 | `answered:false`, `[]` | `answered:false`, `guided:true` | `answered:false`, `citations:[]`, `guided:true` |
| 안내 실패·빈 답·보류 판정 | `answered:false`, `[]` | `answered:false` | `answered:false`, `citations:[]` |
| AI 꺼짐 | 기존 값 | 없음 | 기존 값 |

모든 done에는 `latency_ms`가 있다. `guided:true`는 안내 성공과 보류를 구분하는 새 필드이며
성공에만 포함한다. 안내 응답에는 notice가 없다. 실패하면 기존 보류 문구를 쓴다.
화면은 done의 answered가 boolean이면 최종 상태에 적용한다. 안내 성공은 근거 없이
받은 글을 일반 말풍선으로 표시하며 기록에는 `answered:false`, `guided:true`를 남긴다.
화면 PR을 먼저 병합한다.

일반·안내는 동시 호출 4개, 시간 제한, 끊김 취소·자리 반환, 기록 금지, fast/deep 처리를
공유한다. 질문 500자까지 전송하며 501자 이상은 자르지 않고 전송을 생략한다.
일반 경로는 첫 조문 원문·notice, 안내 경로는 기존 보류 문구로 끝낸다.
AI 꺼짐과 검색 미연결 상태는 기존 동작을 유지한다.

## GET /health

기동 확인. 검색 인덱스 로드 여부까지 포함한다.

```json
{ "status": "ok", "index_loaded": true, "chunk_count": 4821 }
```

---

## GET /demo-students

화면에서 고를 수 있는 가상 학생 목록을 읽는다. 전체 주소는 `/api/v1/demo-students`이다. 요청 본문과 조회 조건은 받지 않는다.

목록은 식당 앞 진열장의 음식 모형과 같다. 모형 세 개를 미리 만들어 두고 손님은 그중 하나를 가리키기만 한다. 실제 학생의 기록은 여기에 없다.

```json
{
  "students": [
    { "id": "demo-d02", "label": "가상 학생 D02", "scenario": "졸업 요건에 가까움", "is_fictional": true },
    { "id": "demo-d03", "label": "가상 학생 D03", "scenario": "학점이 많이 남음", "is_fictional": true },
    { "id": "demo-d04", "label": "가상 학생 D04", "scenario": "비교과 점수 부족", "is_fictional": true }
  ]
}
```

| 필드 | 값 |
|---|---|
| `id` | 졸업 체크 주소의 `student_id`에 그대로 넣는 고정 값 |
| `label` | 화면에 보일 이름. 가상임이 드러나는 표기만 쓴다 |
| `scenario` | 그 학생이 보여 주는 상황 한 줄 |
| `is_fictional` | 항상 `true` |

- 배열 순서는 위 예시로 고정한다.
- 세 명은 같은 졸업 기준을 쓰고 이수 내역만 다르다. `demo-d03`·`demo-d04`는 [졸업 체크 기준표](GRADUATION_RULES.md)의 회귀 검증 사례 D03·D04와 이름만 비슷한 다른 기록이다.
- 서버는 누가 어느 학생을 골랐는지 저장하지 않는다. 브라우저에 남기는 작은 기록(쿠키)도 내려보내지 않는다.
- 이 주소는 읽기 전용이다. 데이터를 보내는 요청(POST)은 `405`다.

---

## POST /demo-login

학번과 비밀번호를 시연 계정 세 개와 견주고, 맞으면 가상 학생 한 명을 돌려준다. 전체 주소는 `/api/v1/demo-login`이다.

전시장 입구의 방명록 책상과 같다. 미리 만들어 둔 이름표 세 장 중 하나와 글자가 똑같을 때만 그 이름표를 내준다. 누가 받아 갔는지는 적어 두지 않는다.

- 학교 인증과 연결하지 않는다. 비밀번호는 화면이 채워 주는 공개 값이다.
- 서버는 로그인 상태를 기억하는 값(세션·토큰·쿠키)을 만들지 않는다. 화면이 응답의 `student.id`를 받아 [졸업 체크 주소](#get-graduation-demo)의 `student_id`에 넣는다.
- 값은 요청 본문에만 싣는다. 주소 뒤에 붙인 값은 읽지 않는다.

### Request

```json
{ "student_number": "20990002", "password": "demo-d02-pass" }
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `student_number` | string | 시연 학번. 숫자 여덟 자리를 문자열로 보낸다. 64자까지 |
| `password` | string | 시연 비밀번호. 64자까지 |

| 학번 | 비밀번호 | 학생 `id` | 상황 |
|---|---|---|---|
| `20990002` | `demo-d02-pass` | `demo-d02` | 졸업 요건에 가까움 |
| `20990003` | `demo-d03-pass` | `demo-d03` | 학점이 많이 남음 |
| `20990004` | `demo-d04-pass` | `demo-d04` | 비교과 점수 부족 |

시연 학번은 실제 학번처럼 2로 시작하는 여덟 자리다. 실제 학생과 겹치지 않게 입학연도가 없는 2099를 쓴다.

실제 학번이 서버로 나가지 않게 화면과 서버가 함께 막는다. 화면은 입력한 학번이 위 세 개 중 하나일 때만 요청을 보내고, 아니면 보내지 않은 채 `401`과 같은 문구를 보인다. 서버는 받은 학번과 비밀번호를 기록하거나 저장하지 않는다.

### Response

`student`는 [학생 목록](#get-demo-students)의 한 명과 같은 값이다.

```json
{
  "student": { "id": "demo-d02", "label": "가상 학생 D02", "scenario": "졸업 요건에 가까움", "is_fictional": true }
}
```

| 상황 | 응답 |
|---|---|
| 학번과 비밀번호가 한 계정과 글자 그대로 같음 | `200`과 위 본문 |
| 계정과 맞지 않음 | `401`과 `{"detail": "학번 또는 비밀번호가 맞지 않아요"}` |
| 요청 형식이 틀림 | `400`과 아래 [에러](#에러) 구역의 고정 문구 |

- **`401`인 값** — 빈 문자열, 앞뒤 공백이 붙은 값, 대소문자가 다른 값, 다른 계정의 비밀번호. 서버는 값을 다듬지 않는다. 학번과 비밀번호 중 어느 쪽이 틀렸는지 알려 주지 않는다.
- **`400`인 값** — 65자 이상인 값, 문자열이 아닌 값(숫자로 보낸 학번 포함), 빠진 필드, 약속에 없는 필드, 읽을 수 없는 본문.
- 한글이나 전각 숫자처럼 영문·숫자가 아닌 글자를 보내도 `401`로 답한다.
- 모든 응답에 쿠키(`Set-Cookie`)가 없다. `200`과 `401`에는 응답을 보관하지 말라는 `Cache-Control: no-store`를 붙인다.
- 응답 본문에 받은 학번과 비밀번호를 되돌려 적지 않는다.
- 조회 요청(GET)은 `405`다.

---

## GET /graduation-demo

가상 학생의 컴퓨터공학전공 2023학년도 졸업 체크 결과를 읽는다. 요청 본문은 받지 않는다.
전체 주소는 `/api/v1/graduation-demo?student_id=demo-d03`처럼 쓴다. [졸업 체크 기준표](GRADUATION_RULES.md)

| `student_id` | 응답 |
|---|---|
| 목록에 있는 값 | 그 학생의 결과. `profile.id`가 요청한 값과 같다 |
| 생략 | `demo-d02`의 결과 |
| 목록에 없는 값 (빈 값, 대소문자가 다른 값 포함) | `404`와 `{"detail": "가상 학생을 찾을 수 없습니다."}`. 다른 학생으로 바꿔 답하지 않고, 받은 값을 본문에 되돌려 적지 않는다 |

| 학생 | 드러나는 결과 |
|---|---|
| `demo-d02` | 학점 다섯 항목 충족. 진로상담 1회와 마일리지 20점 부족 |
| `demo-d03` | 총학점 46학점, 전공 30학점, 졸업논문·과제 부족. 마일리지는 충족이라 `biskit_recommendations`가 `null` |
| `demo-d04` | 학점 다섯 항목 충족. 마일리지 120점 부족이고 추천의 `shortfall_points`도 120 |

기준이 확인되지 않은 전공필수 과목(`required_courses`)은 세 명 모두 `needs_check`다. 이 주소도 쿠키를 내려보내지 않는다.

- `profile`은 `id`, `label`, `department`, `admission_year`, `admission_type`, `track`, `is_fictional`을 담는다.
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

## POST /photo-input, POST /poster-lookup

채팅에 첨부한 사진 한 장의 바이트를 그대로 보낸다. `Content-Type`은 `image/jpeg` 또는 `image/png`를 쓴다. 기존 `/poster-lookup`도 같은 처리 함수와 응답 형식을 쓴다.

서버는 두 주소의 사진 요청을 본문을 읽기 전부터 한 건씩 처리한다. 파일명을 받지 않으며 사진과 판독문을 저장하거나 로그에 남기지 않는다.

제목 단서와 행사일이 맞거나, 사진 속 정사각형 격자 코드(QR, Quick Response)가 등록된 공식 공지·신청 주소와 일치해 행사 하나로 좁혀지면 행사 정보를 돌려준다. 후보가 충돌하면 행사 확인을 보류한다. 서버는 사진 속 코드에서 읽은 주소를 열지 않고 응답에도 싣지 않는다. 행사 카드의 링크는 확인된 행사 정보에서 가져온다.

| 필드 | 의미 |
|---|---|
| `event_match` | 행사 확인 `confirmed` 또는 확인 필요 `needs_check` |
| `identified_by` | 행사 일치에 사용한 단서. 사진 글자 `text`, 공지 QR `qr_notice`, 프로그램 QR `qr_program` |
| `reasons` | 단서 부족 `no_readable_clue`, 후보 충돌 `ambiguous_event`, 마감 불일치 `deadline_mismatch`, 마감 당일 `deadline_day`, 글자 판독 불가 `text_reader_unavailable` |
| `event` | 확인된 행사 정보. 행사 확인이 필요하면 `null` |
| `recognized_text` | 사진에서 읽은 글자. QR에서도 읽은 주소는 제외하며, 판독문이 없으면 빈 문자열 |

행사 정보는 `title`, `event_date`, `official_deadline`, `poster_deadline`, `application_state`, `mileage`, `notice_url`, `application_url`, `login_required`, `checked_on`을 담는다. 현수막 마감은 월-일만 표시한다. 접수 상태는 한국 날짜 기준으로 `open`, `closed`, `needs_check`를 돌려준다. 확인한 날짜, 점수 또는 주소가 없으면 해당 값을 `null`로 표시한다. 마감이 다르면 학교 공지의 날짜를 공식 마감으로 표시한다.

사진 본문은 정확히 5,000,000바이트까지 받는다. 이 한도를 넘으면 413, 사진 형식이 다르면 415, 사진을 열 수 없거나 한 장이 아니거나 1,200만 화소를 넘으면 422를 반환한다. 오류 본문은 `{"detail": "안내 문구"}` 형태다.

## POST /photo-question

행사를 확인하지 못했거나 학생이 판독문을 고쳐 다시 묻고 싶으면 사진 없이 글자만 보낸다. 사진 응답에 `ambiguous_event`가 있으면 화면에서 확인 필요 안내를 표시하고, 학생이 다시 묻기 전에는 글자만으로 행사를 재판정하지 않는다. 글자 요청은 사진 처리가 끝날 때까지 기다리지 않는다.

```json
{
  "question": "여기 어디야?",
  "recognized_text": "가상관 101호",
  "session_id": "s-1"
}
```

`question`은 학생이 쓴 질문이고, `recognized_text`는 사진에서 읽었거나 학생이 고친 글자다. 판독문은 2,000자까지 받으며, 넘으면 요청 형식 오류(400)를 돌려준다. 질문이 비어 있으면 판독문으로 묻고, 둘 다 비어 있으면 확인 필요 안내를 돌려준다.

행사를 확인하지 못하면 질문에 나온 장소를 먼저 찾는다. 질문에 장소 이름이 없으면 판독문에서 찾는다. 후보가 하나이고 출처가 확인되면 장소를 안내하고, 후보가 여럿이면 확인을 요청한다. 규정 검색으로 넘어가면 질문으로 먼저 찾고, 근거가 부족할 때 판독문을 참고 글로 더한다.

```json
{
  "kind": "campus",
  "answer": "가상관은 정문 옆 건물입니다.",
  "sources": [{"title": "가상 캠퍼스 안내", "url": "https://example.invalid/campus"}],
  "event": null,
  "hold_reason": null
}
```

| `kind` | 응답 |
|---|---|
| `event` | 제목 단서와 행사일이 맞으면 `event`에 사진 주소와 같은 행사 정보를 담는다. 글자 요청에서는 사진 속 코드를 행사 단서로 쓰지 않는다. |
| `regulation` | 기존 규정 검색에서 근거를 찾으면 `answer`에 답변을 담고, `sources`에 확인된 출처를 담는다. |
| `campus` | 기존 캠퍼스 목록에서 장소 하나를 찾으면 `answer`에 안내를 담고, `sources`에 확인된 출처를 담는다. |
| `hold` | 입력이 비었거나, 장소가 여럿 걸리거나, 근거가 부족하면 `hold_reason`에 안내를 담는다. `sources`는 빈 배열이다. |

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
| 401 | 인증 실패. 시연 로그인에서는 계정 불일치 |
| 429 | 요청 한도 초과 |
| 503 | 인덱스 미로드 / LLM 응답 없음 |

에러 메시지에 내부 예외 문자열을 그대로 노출하지 않는다.

400 응답은 `{"detail": "요청 형식이 올바르지 않습니다."}`로 통일한다. 필드 누락, 잘못된 값, 읽을 수 없는 본문에도 같은 문구를 돌려준다.

---

## 미결정

- 인증 방식 — 학교 통합 로그인(SSO, Single Sign-On) 연동 가능 여부에 달려 있음. 확인 전까지는 개발용 토큰. 시연 계정 로그인은 화면 시연용이며 이 결정과 무관하다.
- Rate limit(요청 횟수 한도) 기준. AI 동시 호출 4개 제한과는 별개다.

스트리밍 응답(SSE) 여부는 이슈 #98에서 정했다. 생각을 켠 답이 약 5초 걸려 [POST /chat/stream](#post-chatstream)을 더했고, `POST /chat`은 그대로 둔다.
