# Render에 가상 규정 검색 앱 배포하기

Render는 웹 서버를 인터넷에 공개하는 서비스다. 앱을 시작할 때 가상 구름 도서관 규정을 검색할 수 있게 준비한다.

Render 대시보드에서 **New → Blueprint**를 고르고 `namelesspark/kumoh-academic-rag`의 `main` 브랜치를 연결한다. Blueprint는 저장소의 `render.yaml`에서 서비스 설정을 읽는다. 플랜과 비용을 확인한 뒤 생성한다.

| 설정 | 값 |
| --- | --- |
| Runtime | Python 3.12.7 |
| Root Directory | 빈칸 (저장소 루트) |
| Build Command | `pip install -r api/requirements.txt` |
| Start Command | `python -m uvicorn api.serve:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/v1/health` |

Web Service를 직접 설정할 때도 같은 값을 입력한다. 저장소 루트에서 시작해야 `api/`의 웹 앱과 `core/`의 검색 모듈을 함께 불러올 수 있다. [Render 서비스 루트 설정](https://render.com/docs/monorepo-support#setting-a-root-directory)

배포 로그에서 서버 시작을 확인한 뒤 PowerShell에서 아래 명령을 실행한다. `$renderUrl`에는 대시보드에 표시된 서비스 주소를 넣는다.

```powershell
$renderUrl = "https://<서비스이름>.onrender.com"
Invoke-RestMethod "$renderUrl/api/v1/health"

$body = @{ message = "달빛열람증을 누가 내주나요" } | ConvertTo-Json
Invoke-RestMethod "$renderUrl/api/v1/chat" -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

상태 응답에서 `status=ok`, `index_loaded=true`, `chunk_count=9`를 확인한다. 채팅 응답은 `answered=true`와 제3조(달빛 열람) 원문 인용 한 건을 돌려준다. 질문을 `얼룩말 풍금`으로 바꾸면 `answered=false`와 빈 인용 목록을 돌려준다.

[Render의 FastAPI 배포 가이드](https://render.com/docs/deploy-fastapi) · [HTTP 상태 확인 설정](https://render.com/docs/health-checks)

## 규정 목록 설정 (선택)

서비스에 환경 변수 `KUMOH_REGULATION_MANIFEST_PATH`를 넣으면 가상 데모 대신 그 목록 파일의 규정들을 검색한다. 환경 변수는 서버를 시작할 때 바깥에서 건네는 이름표 달린 값이다. 식당 문 앞의 메뉴판 거치대와 같다. 메뉴판을 꽂지 않으면 견본 메뉴를 보여 주고, 찢어진 메뉴판을 꽂으면 견본으로 얼버무리지 않고 문을 열지 않는다.

| 서비스의 상태 | 서버를 시작할 때 일어나는 일 |
| --- | --- |
| 이 이름이 없음 | 가상 구름 도서관 데모를 띄운다. 위의 확인 절차 그대로다. |
| 이 이름이 있고 목록이 올바름 | 목록에 적힌 규정 전부를 한 번에 검색한다. |
| 이 이름이 있고 값이 비었거나 공백뿐임 | 서버가 뜨지 않는다. 데모로 넘어가지 않는다. |
| 목록이나 규정 파일 하나라도 틀림 | 서버가 뜨지 않는다. 일부 문서만으로 뜨지 않는다. |

- **넣는 곳** — 필요한 서비스의 대시보드 **Environment**에만 넣는다. `render.yaml`에는 이 이름을 적지 않는다. 이름만 있고 값이 비면 두 서비스가 모두 뜨지 않기 때문이다.
- **목록 파일의 위치** — 상대 경로로 적으면 서버를 시작한 폴더(저장소 루트)에서 찾는다.
- **목록 안의 `path`** — 상대 경로로 적으면 목록 파일이 있는 폴더에서 찾는다. 시작 폴더와 무관하다.
- **목록의 모양** — 필드와 검사 규칙은 `api/README.md`의 목록 파일 설명과 같다.

### 가상 목록으로 확인하기

저장소에 있는 가상 목록으로 먼저 확인한다. 대시보드에 아래 값을 넣고 다시 배포한다.

| 이름 | 값 |
| --- | --- |
| `KUMOH_REGULATION_MANIFEST_PATH` | `api/tests/fixtures/fictional_manifest.json` |

```powershell
Invoke-RestMethod "$renderUrl/api/v1/health"
```

상태 응답에서 `status=ok`, `index_loaded=true`, `chunk_count=3`을 확인한다. 가상 달무리 천문대 규정의 두 조각과 가상 은여울 목공방 규정의 한 조각을 더한 수다. 채팅 화면의 예시 질문은 가상 구름 도서관 질문이라 이 설정에서는 답이 나오지 않는다.

### 서버가 뜨지 않을 때

배포 로그의 마지막 오류 한 줄을 본다. 문구에는 설정 이름이나 항목 위치와 사유만 나온다. 입력한 경로와 규정 원문은 나오지 않는다. 항목 번호는 0부터 센다.

- `KUMOH_REGULATION_MANIFEST_PATH: 값이 비어 있습니다.` — 값을 채우거나 이름을 지운다.
- `KUMOH_REGULATION_MANIFEST_PATH: JSON으로 읽을 수 없습니다.` — 목록 파일의 괄호와 쉼표를 확인한다.
- `documents[1].path: 파일을 읽을 수 없습니다 (FileNotFoundError).` — 둘째 문서의 파일 위치를 확인한다.
- `documents[1]: 검색할 조각을 찾지 못했습니다.` — 둘째 문서에 `제1조` 같은 조문 줄이 있는지 확인한다.

### 저장소 밖 파일을 서비스에 두기

실제 규정은 저장소에 커밋하지 않는다. Render가 저장소 밖 파일을 서비스에 두는 방법으로 안내하는 문서는 아래 두 개다. 어느 방법으로 학교 자료를 공급할지는 아직 정하지 않았다.

- [비밀 파일 (Secret Files)](https://render.com/docs/configure-environment-variables#secret-files)
- [영구 디스크 (Persistent Disks)](https://render.com/docs/disks)

링크를 적은 날은 2026-11-13이다. 이 문서를 쓴 작업 환경은 외부 사이트를 열 수 없어 두 페이지의 내용은 아직 확인하지 못했다. 처음 쓰는 사람이 페이지를 열어 파일이 놓이는 경로와 플랜 조건을 확인하고 이 줄을 확인일로 바꾼다.
