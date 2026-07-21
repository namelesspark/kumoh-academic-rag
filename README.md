# 금오공대 학사 행정 RAG 챗봇

학칙·장학·전과·졸업 규정이 공지사항과 부서별 PDF/HWP에 파편화되어 있어,
학생은 문서를 직접 뒤지고 행정실은 반복 문의에 시달리는 문제를 다룬다.

규칙 기반 챗봇 단계를 건너뛰고, **RAG로 환각을 통제하면서 학적 데이터와 연동된 개인화 답변**을 생성하는 것이 목표다.

> 2026학년도 AX 기반 역량 강화 프로젝트 · 국립금오공과대학교 AX교수학습센터
> 풀스택 단독 개발 · 착수 2026.07

---

## 구조

```
kumoh-academic-rag/
├── core/     검색 엔진 — 파싱 · 청킹 · 임베딩 · 하이브리드 검색 · 리랭킹 · 평가
├── api/      백엔드 — FastAPI · Agent 루프 · 학적 연동 · LLM 호출
├── web/      프론트엔드 — React 채팅 클라이언트
└── docs/     아키텍처 · 데이터 정책 · 평가 설계
```

```
web ──HTTP──> api ──import──> core
                │               │
           학적 API        Vector DB + BM25
           sLLM (7B~13B)
```

**core를 서버가 아닌 라이브러리로 둔 이유** — 초기엔 프로세스를 나눌 이유가 없다.
검색만 별도 스케일링이 필요해지면 그때 api 쪽에 래퍼를 얹는다. 미리 쪼개면 개발 속도만 느려진다.

---

## 핵심 설계

### 1. 계층적 파싱
`제12조 ② 3.` 의 조·항·목 구조와 표를 보존한 채로 청킹한다.
청크마다 조문 경로가 텍스트 앞에 붙어, LLM이 답변에 조문 번호를 그대로 인용할 수 있다.
**학생이 원문을 직접 대조 검증할 수 있어야 챗봇 답변을 신뢰할 수 있다.**

### 2. 하이브리드 검색
학칙 질의는 두 성격이 섞인다. "전과 요건 알려줘"는 dense가, "제30조가 뭐야"는 BM25가 잡는다.
한쪽만 쓰면 나머지 유형에서 Recall이 무너진다.

```
query ─┬─ BM25   top20 ─┐
       └─ Dense  top20 ─┴─ RRF 병합 ─→ Re-ranker ─→ top5 ─→ LLM
```

### 3. 환각 2중 방어
- **1차** — 프롬프트 제약: 참고문서 밖의 내용은 생성 금지
- **2차** — 생성 후 검증: 인용 없는 사실 서술을 제거하고 행정실 안내로 대체

근거가 없으면 답을 만들지 않는다. 모든 실패 경로가 "행정실 안내"로 수렴한다.

### 4. Agent 루프
"내 학적에서 졸업하려면 몇 학점 더?" 같은 질문은 단순 RAG로 답이 안 된다.
검색 → 학적 조회 → 연산 → (전공별 요건이 다르면) 재검색 이 필요하다.
반복 상한 3회, 동일 쿼리 재검색 금지로 폭주를 막는다.

---

## 검증 지표

빈출 질문 50~100개를 5개 유형으로 나눠 측정한다.

| 조건 | Recall@5 |
|---|---|
| BM25 단독 | — |
| Dense 단독 | — |
| Hybrid (RRF) | — |
| Hybrid + Reranker | — |

**답변 불가 질문(E유형)의 거부율을 함께 잰다.** 정확도만 재면 "무조건 뭐라도 답하는" 시스템이 유리해진다.

자세한 설계: [`docs/EVALUATION.md`](docs/EVALUATION.md)

---

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 파이프라인 · 타입 · 교체 가능 지점 |
| [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md) | **커밋 전 필독** — 데이터 반입 규칙, 저작권 |
| [`docs/EVALUATION.md`](docs/EVALUATION.md) | 평가 설계 · 지표 정의 |
| [`core/README.md`](core/README.md) | 검색 엔진 책임 범위 |
| [`api/README.md`](api/README.md) | 서버 구조 |
| [`api/docs/API_SPEC.md`](api/docs/API_SPEC.md) | API 명세 |
| [`api/docs/AGENT_DESIGN.md`](api/docs/AGENT_DESIGN.md) | Agent 루프 설계 |
| [`api/docs/PROMPTING.md`](api/docs/PROMPTING.md) | 프롬프트 · 환각 통제 |
| [`web/README.md`](web/README.md) | 클라이언트 구조 |
| [`web/docs/UI_NOTES.md`](web/docs/UI_NOTES.md) | UI 설계 노트 |

---

## 개발 순서

```
1주차  core/parsing         학칙 PDF 1건 조·항·목 추출
2주차  core/chunking+index  Chroma 인덱스 빌드
       api/main+schemas     /health, /chat 스텁 ← 프론트 계약 고정
3주차  core/retrieval       BM25/Dense 각각 Recall 측정
       web                  mock 기반 채팅 UI
4주차  api/clients+services 단순 RAG 응답 → web 실연동
5주차  core/reranking       리랭커 전후 비교
6주차  api/agents           Agent 루프 + 학적 mock
```

2주차에 `/chat` 스텁을 먼저 만들어 프론트를 병렬로 돌린다.
혼자 개발이므로 한쪽이 다른 쪽을 기다리는 구간을 만들지 않는 게 일정 관리의 핵심이다.

---

## 데이터 취급

학칙 원문과 학적 데이터는 **어떤 형태로도 커밋하지 않는다.** 테스트 픽스처도 예외가 아니다.
루트 `.gitignore`가 경로 무관으로 차단하고 있지만, 커밋 전 [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md)를 확인한다.

## 라이선스

본 프로젝트는 2026학년도 AX 기반 역량 강화 프로젝트 산출물이며,
저작재산권은 국립금오공과대학교에 귀속된다. 자세한 내용은 [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md) 3절.

## 기술 스택

`Python` `FastAPI` `React 18` `Chroma / FAISS` `BM25` `sLLM 7B~13B`
