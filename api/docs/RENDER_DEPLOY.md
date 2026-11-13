# Render에 가상 규정 검색 앱 배포하기

Render는 웹 서버를 인터넷에 공개하는 서비스다. 앱을 시작할 때 가상 구름 도서관 규정을 검색할 수 있게 준비한다.

Render 대시보드에서 **New → Blueprint**를 고르고 `namelesspark/kumoh-academic-rag`의 `main` 브랜치를 연결한다. Blueprint는 저장소의 `render.yaml`에서 서비스 설정을 읽는다. 플랜과 비용을 확인한 뒤 생성한다.

| 설정 | 값 |
| --- | --- |
| Runtime | Python 3.12.7 |
| Root Directory | 빈칸 (저장소 루트) |
| Build Command | `pip install -r api/requirements.txt && python -B api/scripts/prepare_poster_ocr.py` |
| Start Command | `python -m uvicorn api.serve:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health Check Path | `/api/v1/health` |

표의 Build Command는 `render.yaml`에 적힌 첫 줄이다. 바로 다음 들여쓴 줄의 이미지 준비 명령까지 이어서 실행한다. YAML은 이 두 줄을 공백 하나로 이어 붙인다. 수동으로 Web Service를 설정할 때는 아래 전체 명령을 Build Command에 넣는다.

```sh
pip install -r api/requirements.txt && python -B api/scripts/prepare_poster_ocr.py && python -B api/scripts/prepare_brand_assets.py
```

나머지 설정은 표와 같은 값을 입력한다. 저장소 루트에서 시작해야 `api/`의 웹 앱과 `core/`의 검색 모듈을 함께 불러올 수 있다. [Render 서비스 루트 설정](https://render.com/docs/monorepo-support#setting-a-root-directory)

배포 로그에서 서버 시작을 확인한 뒤 PowerShell에서 아래 명령을 실행한다. `$renderUrl`에는 대시보드에 표시된 서비스 주소를 넣는다.

```powershell
$renderUrl = "https://<서비스이름>.onrender.com"
Invoke-RestMethod "$renderUrl/api/v1/health"

foreach ($question in "달빛열람증을 누가 내주나요", "가상의 날씨", "얼룩말 풍금") {
    $body = @{ message = $question } | ConvertTo-Json
    Invoke-RestMethod "$renderUrl/api/v1/chat" -Method Post `
        -ContentType "application/json; charset=utf-8" `
        -Body ([Text.Encoding]::UTF8.GetBytes($body)) |
        ConvertTo-Json -Depth 5
}
```

상태 응답에서 `status=ok`, `index_loaded=true`, `chunk_count=9`를 확인한다. 채팅 응답은 질문마다 아래와 같아야 한다.

| 질문 | `answered` | `citations` |
| --- | --- | --- |
| `달빛열람증을 누가 내주나요` | `true` | 제3조(달빛 열람) 원문 인용 한 건 |
| `가상의 날씨` | `false` | 빈 목록 |
| `얼룩말 풍금` | `false` | 빈 목록 |

- **`가상의 날씨`** — `가상의`는 데모의 조각 아홉 개 모두에 있는 낱말이고 `날씨`는 어디에도 없다. 모든 조각에 공통인 낱말만 겹치는 질문은 근거가 될 수 없으므로 답변을 보류한다. 여기서 인용이 나오면 배포된 코드가 그 수정보다 오래된 것이다.
- **`얼룩말 풍금`** — 어느 조각과도 낱말이 겹치지 않는 질문이다.
- **데모 인용의 `source_url`** — 가상 규정에는 공식 주소가 없어 `null`이다. 그래서 채팅 화면의 인용 카드에 `공식 원문 보기` 링크가 없다.

[Render의 FastAPI 배포 가이드](https://render.com/docs/deploy-fastapi) · [HTTP 상태 확인 설정](https://render.com/docs/health-checks)

## 현수막 글자 인식 준비

두 서비스는 서버 프로세스를 한 개씩 띄운다. 사진 요청은 본문을 읽기 전부터 판독을 마칠 때까지 한 건씩 처리한다. 채팅과 상태 확인은 사진 처리를 기다리지 않는다.

Render의 두 서비스는 패키지를 설치한 뒤 한글과 영어 글자 인식 모델을 준비한다. 스크립트는 파일 지문(SHA-256)이 일치하는 모델을 재사용한다. 새로 받은 파일은 지문이 맞을 때만 `api/.poster-ocr/`에 넣는다. 지문이 다르면 빌드가 실패해 이전 배포가 계속 응답한다. [Render 배포 순서](https://render.com/docs/deploys#sequence-of-events)

로컬에서도 모델을 준비하려면 저장소 루트에서 `python -B api/scripts/prepare_poster_ocr.py`를 실행한다. 모델이 없어도 서버가 시작하고 QR(정사각형 바코드)을 읽는다. 글자가 필요한 사진은 `text_reader_unavailable`과 함께 확인 필요로 응답한다.

| 구성 요소 | 버전과 라이선스 |
| --- | --- |
| 사진 파일 열기 | Pillow 12.2.0 · [MIT-CMU](https://github.com/python-pillow/Pillow/blob/12.2.0/LICENSE) |
| QR 읽기 | zxing-cpp 3.1.1 · [Apache-2.0](https://github.com/zxing-cpp/zxing-cpp/blob/v3.1.1/LICENSE) |
| 글자 인식 | tesserocr 2.12.0 · [MIT](https://github.com/sirfz/tesserocr/blob/v2.12.0/LICENSE) |
| 한글·영어 모델 | tessdata_fast 4.1.0 · [Apache-2.0](https://github.com/tesseract-ocr/tessdata_fast/blob/65727574dfcd264acbb0c3e07860e4e9e9b22185/LICENSE) |

모델 출처는 [tessdata_fast 커밋 `65727574dfcd264acbb0c3e07860e4e9e9b22185`](https://github.com/tesseract-ocr/tessdata_fast/tree/65727574dfcd264acbb0c3e07860e4e9e9b22185)이다. 스크립트가 확인하는 파일 지문은 아래와 같다.

| 모델 | SHA-256 |
| --- | --- |
| `kor.traineddata` | `6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2` |
| `eng.traineddata` | `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` |

## 공식 로고와 테크모 준비

두 서비스의 빌드 명령은 사진 판독 모델 준비가 성공한 뒤 `python -B api/scripts/prepare_brand_assets.py`를 실행한다. 기존 사진 판독 준비의 실패 처리는 유지한다. 공식 그림은 각각 지문과 크기를 확인하고 화면용 PNG로 만든다. 한 그림을 받지 못해도 빌드는 성공하며, 파일이 없으면 서버가 404로 답해 화면의 그림 자리만 빈다. 서버 실행 중에는 내려받지 않는다. 원본 주소와 처리 기준은 [공식 그림 준비 안내](BRAND_ASSETS.md)에 적었음.

같은 명령이 로그인·메인 화면의 캠퍼스 배경 사진 네 장(`campus-aerial.jpg`, `campus-hill.jpg`, `campus-gate.jpg`, `campus-field.jpg`)도 받는다. 사진은 바이트 수·지문·JPEG 형식·1920×280 크기가 모두 맞을 때만 다시 압축하지 않고 저장한다. 한 장을 받지 못해도 빌드는 성공한다. 그 사진은 서버가 404로 답하고 화면은 남색 바탕으로 동작한다. 빌드 로그에는 사진마다 `campus-aerial.jpg: 준비 완료`나 `준비 실패 (사유)` 한 줄이 남는다.

로그인 화면의 제목 글자 그림 `title-lettering.png`도 이때 만든다. 글꼴 Gugi를 고정한 커밋 주소에서 받아 지문을 확인하고 글자를 그림으로 그린다. 글꼴 파일은 저장하지 않는다. 그림을 만들지 못해도 빌드는 성공하고, 화면은 같은 글귀를 기본 글꼴 제목으로 보여 준다.

## 시연 계정 로그인 확인

로그인 화면은 `POST /api/v1/demo-login`을 부른다. 서버를 화면보다 먼저 올리거나 둘을 함께 올린다. 화면만 먼저 올리면 로그인 요청이 404로 막힌다.

배포 뒤 PowerShell에서 아래 명령으로 확인한다. 계정은 화면이 채워 주는 공개 시연 값이고 실제 학생과 관계가 없다. 값 목록과 응답 형식은 [API 명세](API_SPEC.md)에 적었음.

```powershell
$login = @{ student_number = "20990002"; password = "demo-d02-pass" } | ConvertTo-Json
Invoke-RestMethod "$renderUrl/api/v1/demo-login" -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body ([Text.Encoding]::UTF8.GetBytes($login)) |
    ConvertTo-Json -Depth 3
```

응답의 `student.id`가 `demo-d02`인지 본다. 비밀번호를 한 글자 바꾸면 `Invoke-RestMethod`가 401 오류를 내야 한다. 서버는 로그인 상태를 저장하지 않으므로 다시 배포해도 지울 것이 없다.

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

상태 응답에서 `status=ok`, `index_loaded=true`, `chunk_count=3`을 확인한다. 가상 달무리 천문대 규정의 두 조각과 가상 은여울 목공방 규정의 한 조각을 더한 수다. 채팅 화면의 예시 질문은 가상 구름 도서관 질문이라 이 설정에서는 답이 나오지 않는다. 아래 질문을 직접 입력한다.

| 질문 | 문서명 | 인용 조문 | 시행일 | `source_url` |
| --- | --- | --- | --- | --- |
| `제1조 망원경` | 가상 달무리 천문대 규정 | 제1조(망원경 예약) | 2099-03-04 | `https://example.invalid/regulations/observatory` |
| `제1조 대패` | 가상 은여울 목공방 규정 | 제1조(대패 사용) | 2098-11-20 | `https://example.invalid/regulations/woodshop` |

두 질문 모두 `answered=true`와 표에 적힌 조문의 원문 인용 한 건을 돌려준다. 인용의 문서명·시행일·`source_url`은 목록 파일에 적은 글자 그대로다. `가상의 날씨`는 이 설정에서도 `answered=false`와 빈 인용 목록을 돌려준다.

### 브라우저에서 출처 링크 확인하기

채팅 화면은 인용의 `source_url`이 안전한 HTTPS 주소일 때만 인용 카드에 `공식 원문 보기` 링크를 붙인다. 가상 데모에는 주소가 없어 링크를 볼 수 없으므로, 주소가 적힌 가상 목록을 자기 컴퓨터에서 띄워 확인한다. 저장소 루트에서 PowerShell로 실행한다.

```powershell
$env:KUMOH_REGULATION_MANIFEST_PATH = "api/tests/fixtures/fictional_manifest.json"
python -m uvicorn api.serve:app --host 127.0.0.1 --port 8000
```

브라우저에서 `http://127.0.0.1:8000/`을 열고 위 표의 `제1조 망원경`을 보낸 뒤 차례로 본다.

1. **링크 표시** — 인용 카드에 `공식 원문 보기` 링크가 하나 보인다. 문서명·조문·시행일·인용문은 링크가 없을 때와 같다.
2. **Tab 초점** — Tab이나 Shift+Tab으로 옮겨 가면 초점이 링크에 닿고 초점 테두리가 보인다.
3. **Enter로 새 탭** — 초점이 링크에 있을 때 Enter를 누르면 새 탭이 열리고, 주소 표시줄의 글자가 표의 `source_url`과 같다. `example.invalid`는 일부러 없는 주소라 새 탭에는 연결 오류가 나온다. 그 오류는 정상이다.
4. **대화 보존** — 원래 탭으로 돌아오면 질문과 답변이 그대로 남아 있다.

확인을 마치면 서버를 Ctrl+C로 끄고 `Remove-Item Env:KUMOH_REGULATION_MANIFEST_PATH`로 설정을 지운다. `javascript:`나 `http://` 같은 위험한 주소는 서버가 시작할 때 막아 브라우저까지 오지 않는다. 화면이 그런 값을 받았을 때 링크를 만들지 않는지는 `api/tests/web/citation_link.test.mjs`가 확인한다.

실제 문서에 넣을 공식 주소는 `api/docs/OFFICIAL_SOURCES.md`에 적힌 것만 쓴다.

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

확인일 2026-11-13. PR 검토자가 두 페이지를 열어 확인했다. 파일이 놓이는 경로와 플랜 조건은 바뀔 수 있으니 쓰기 전에 다시 본다.
