# 아키텍처

## 전체 시스템에서 core의 위치

```
[사용자] → web/ (React)
              ↓ HTTPS
         api/ (FastAPI)
              ├─ Agent 루프 ── 학적 API (학교 시스템)
              ├─ LLM 호출 (sLLM 7B~13B / API)
              └─ retrieve() ─→ core/  ← 이 문서의 대상
                                   └─ Vector DB (Chroma/FAISS) + BM25 인덱스
```

core는 **동기 라이브러리**다. 서버로 띄우지 않고 api가 import 해서 쓴다.
나중에 검색만 별도 스케일링이 필요해지면 그때 gRPC/HTTP 래퍼를 api 쪽에 얹는다.

---

## 파이프라인 (오프라인: 인덱스 빌드)

```
data/raw/*.pdf|hwp
   │
   ▼  parsing/
   │   · 조·항·목 계층 추출 (제N조 → ①항 → 1목)
   │   · 표 → 마크다운 변환 (셀 병합 처리)
   │   · 출처 메타데이터 부착 (문서명, 시행일, 페이지)
   ▼
data/interim/*.json   ← 구조 보존된 중간 표현
   │
   ▼  chunking/
   │   · 조(條) 단위 기본 청킹
   │   · 조가 너무 길면 항 단위 분할, 상위 조문 헤더를 각 청크에 prepend
   │   · 표는 분할하지 않음 (통째로 1청크)
   ▼
data/processed/chunks.parquet
   │
   ├─▼ embedding/ → indexing/  → Chroma (dense)
   └─▼ indexing/               → BM25 인덱스 (sparse)
```

**설계 의도**: 청크마다 `제12조(장학금의 종류) ② 3.` 같은 조문 경로가 텍스트 앞에 붙는다.
LLM이 답변에 조문 번호를 그대로 인용할 수 있고, 학생이 원문을 직접 대조 검증할 수 있다.
"근거 없으면 답변 금지" 제약을 걸어도 근거를 제시할 수단이 생긴다.

---

## 파이프라인 (온라인: 질의 처리)

```
query
  │
  ├─→ BM25 검색      → top 20   (조문 번호, 고유명사, "제12조" 같은 정확 매칭에 강함)
  └─→ Dense 검색     → top 20   (의역된 질문, "장학금 얼마 받아?" 류에 강함)
          │
          ▼ RRF (Reciprocal Rank Fusion)로 병합
          │
          ▼ reranking/  Cross-encoder → top 5
          │
          ▼
    list[RetrievedChunk]  → api로 반환
```

**왜 하이브리드인가** — 학칙 질의는 두 성격이 섞인다.
"전과 요건 알려줘"는 dense가, "제30조가 뭐야"는 BM25가 잡는다.
한쪽만 쓰면 나머지 유형에서 Recall이 무너진다. 각각의 단독 성능을 먼저 측정한 뒤 결합하는 이유다.

**왜 리랭커인가** — 상위 40개를 그대로 LLM에 넣으면 컨텍스트가 낭비되고, 관련 없는 조문이
섞여 환각을 유발한다. 리랭커로 5개까지 좁혀 정확도와 토큰 비용을 동시에 잡는다.

---

## 핵심 타입 (schemas/)

```python
Document      # 원문 1건: 문서명, 시행일, 소관 부서, 출처 URL
Chunk         # 청크: text, article_path("제12조 ② 3"), doc_id, chunk_type(text|table)
RetrievedChunk # Chunk + score, retriever("bm25"|"dense"|"hybrid"), rank
```

`article_path`가 이 시스템의 핵심 필드다. 인용·검증·평가 세 곳에서 모두 쓰인다.

---

## 교체 가능하게 설계한 지점

| 지점 | 이유 |
|---|---|
| 임베딩 모델 | 초기 검증은 API, 최종 배포는 학내 오픈소스 모델 |
| Vector DB | Chroma로 시작, 규모 커지면 FAISS/Qdrant |
| 리랭커 | 성능/속도 트레이드오프 실험 필요 |

전부 `Protocol`(또는 ABC) 인터페이스로 두고, 구현체는 `configs/*.yaml`에서 선택한다.
호출부는 인터페이스만 안다.

---

## 미결정 사항

- HWP 파싱 방식 — 라이브러리 직접 파싱 vs PDF 변환 후 처리. 원문 샘플 확보 후 결정.
- 표가 여러 페이지에 걸칠 때 병합 전략.
- 학칙 개정 시 인덱스 갱신 방식 — 전체 재빌드 vs 문서 단위 증분.
