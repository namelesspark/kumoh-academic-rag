# core — 검색 엔진

금오공대 학사 행정 RAG 챗봇의 **검색 코어 라이브러리**.
학칙·규정 문서를 파싱해 인덱스를 만들고, 질의에 대해 근거 문단을 반환하는 것까지가 이 리포의 책임 범위다.

LLM 호출, 사용자 인증, 학적 API 연동은 **하지 않는다**. → [`api/`](../api) 담당.

---

## 책임 경계

| 하는 일 | 하지 않는 일 |
|---|---|
| PDF/HWP 계층적 파싱 (조·항·목, 표 보존) | LLM 프롬프팅 / 답변 생성 |
| 청킹 + 임베딩 + Vector DB 구축 | HTTP 서버 / 인증 |
| BM25 + Dense 하이브리드 검색 | 학적 API 호출 |
| Re-ranker 기반 우선순위 정렬 | 프론트엔드 |
| Retrieval Recall 평가 | 대화 세션 관리 |

`retrieve(query, top_k) -> list[RetrievedChunk]` 하나가 이 리포의 공개 계약이다.

---

## 디렉토리 구조

```
core/
├── src/kumoh_rag_core/
│   ├── parsing/        # PDF/HWP → 구조화 텍스트 (조·항·목 계층, 표)
│   ├── chunking/       # 계층 구조를 보존하는 청킹 전략
│   ├── embedding/      # 임베딩 모델 래퍼 (교체 가능하게 인터페이스로)
│   ├── indexing/       # Chroma / FAISS 인덱스 빌드·로드
│   ├── retrieval/      # BM25, Dense, Hybrid 검색기
│   ├── reranking/      # Cross-encoder 리랭커
│   └── schemas/        # Document, Chunk, RetrievedChunk 등 공통 타입
├── data/
│   ├── raw/            # 학칙 원문 PDF/HWP  ← git 추적 안 함
│   ├── interim/        # 파싱 중간 산출물   ← git 추적 안 함
│   ├── processed/      # 임베딩용 최종 JSON/Parquet ← git 추적 안 함
│   └── eval/           # 평가용 질문셋 (익명·개인정보 없음) ← 일부만 추적
├── configs/            # 파싱·청킹·검색 파라미터 YAML
├── scripts/            # build_index.py, run_eval.py 등 실행 진입점
├── notebooks/          # 탐색적 분석 (커밋 전 output 클리어)
└── tests/
```

설계·평가 문서는 리포 루트 [`docs/`](../docs) 에 있다.
core 단독 문서가 아니라 api와 공유하는 내용이라 위로 뺐다.

---

## 왜 이렇게 나눴나

**`parsing` / `chunking` 분리** — 학칙 파싱은 이 프로젝트에서 가장 오래 붙잡게 될 부분이다.
"제12조 ②항 3목"의 계층이 청크에 살아남아야 답변에 조문 번호를 인용할 수 있고, 그래야 환각 통제가 된다.
파싱 결과가 흔들리면 청킹 전략도 다시 짜야 하므로, 두 단계를 각각 독립적으로 테스트할 수 있게 떼어놨다.

**`retrieval` / `reranking` 분리** — 하이브리드 검색과 리랭커는 각각 따로 켜고 끄면서
Recall 변화를 측정해야 한다. 한 모듈에 섞으면 "리랭커가 실제로 기여했는가"를 수치로 못 만든다.

**`embedding`을 인터페이스로** — 초기엔 API 임베딩으로 빠르게 검증하고, 이후 학내 인프라용
오픈소스 모델로 교체하는 시나리오다. 호출부가 구현체에 직접 묶이면 그때 전면 수정이 된다.

**`data/` 4단계** — raw → interim → processed 를 나누면 파싱 로직을 고쳤을 때
어디부터 다시 돌려야 하는지가 분명해진다. 전체 재빌드 비용이 큰 파이프라인에서 중요하다.

---

## 데이터 반입 규칙 (중요)

`data/raw/`, `data/interim/`, `data/processed/` 는 `.gitignore` 로 막혀 있다.

- 학칙·규정 원문은 학교 저작물이다. 공개 리포에 올리지 않는다.
- 학적 데이터(학번, 이수 학점, 성적)는 **어떤 형태로도** 커밋하지 않는다. 테스트 픽스처도 반드시 가상 데이터로.
- 평가 질문셋은 개인 식별 정보를 제거한 뒤 `data/eval/` 에만 둔다.

자세한 내용은 [`docs/DATA_POLICY.md`](../docs/DATA_POLICY.md).

---

## 개발 예정 순서

1. `parsing` — 학칙 PDF 1건으로 조·항·목 추출 검증
2. `chunking` + `schemas` — 청크에 조문 메타데이터 부착
3. `indexing` + `embedding` — Chroma 인덱스 빌드
4. `retrieval` — BM25 / Dense 각각 단독 Recall 측정 → 하이브리드 결합
5. `reranking` — 리랭커 적용 전후 비교
6. [`docs/EVALUATION.md`](../docs/EVALUATION.md) 기준 빈출 질문 50~100개 정량 평가

---

## 관련 리포

- [`api/`](../api) — FastAPI 서버, Agent 루프, 학적 연동
- [`web/`](../web) — React 채팅 클라이언트

## 라이선스

2026학년도 AX 기반 역량 강화 프로젝트 산출물. 저작재산권 귀속 관계는 [`docs/DATA_POLICY.md`](../docs/DATA_POLICY.md) 3절 참고.
