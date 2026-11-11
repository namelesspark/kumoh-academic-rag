# Render에 API 스텁 배포하기

이 문서는 이슈 #4에서 만든 임시 서버(스텁)를 Render라는 클라우드 호스팅 서비스에 올려, 인터넷 주소로 접속할 수 있게 하는 절차다.

API는 프로그램끼리 요청과 응답을 주고받는 약속이다 (Application Programming Interface). 스텁은 실제 검색이 붙기 전까지 정해진 답만 돌려주는 자리 채우기 서버다. 벽에 콘센트를 먼저 박아 두는 것과 같아서, 꽂을 가전제품은 아직 없지만 규격을 정해 두면 나중에 무엇을 사 와도 꽂힌다. 배포 후에는 상태 응답과 가상 채팅 응답을 확인한다.

1. 코드 반영 요청(PR, Pull Request) 5번과 6번을 검증한 뒤 `main`에 병합한다.
2. Render 대시보드에서 **New → Blueprint**를 고르고 저장소 `namelesspark/kumoh-academic-rag`의 `main` 브랜치를 연결한다. Blueprint는 서비스 설정을 파일로 적어 두고 Render가 읽어 가게 하는 방식이다. 저장소 루트의 `render.yaml`이 아래 설정을 그대로 만들어 준다. 플랜과 비용을 확인한 뒤 생성한다.

표의 설정 이름은 Render 화면에 보이는 영문 그대로다.

| 설정 | 값 | 출처 |
| --- | --- | --- |
| Runtime | Python 3.12.7 | `render.yaml`의 `PYTHON_VERSION` |
| Root Directory | `api` | `render.yaml`의 `rootDir` |
| Build Command | `pip install -r requirements.txt` | 버전 고정은 `api/requirements.txt`에 있다 |
| Start Command | `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `render.yaml` |
| Health Check Path | `/api/v1/health` | `render.yaml` |

Blueprint를 쓰지 않고 Web Service(Render가 웹 서버 하나를 띄워 주는 상품)를 직접 만들 때도 위 표의 값을 그대로 입력하면 된다. 라이브러리 버전은 `requirements.txt` 한 곳에서만 바꾼다. 내 컴퓨터에서 돌리는 테스트와 Render가 같은 버전을 쓰게 하려는 것이다.

3. 배포 로그에서 서버 시작을 확인하고 PowerShell(Windows 기본 명령 창)에서 아래 명령을 실행한다. `$renderUrl`에는 대시보드에 표시된 서비스 주소를 넣는다.

```powershell
$renderUrl = "https://<서비스이름>.onrender.com"
Invoke-RestMethod "$renderUrl/api/v1/health"

$body = @{ message = "가상 미등록 항목" } | ConvertTo-Json
Invoke-RestMethod "$renderUrl/api/v1/chat" -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

상태 응답은 웹 통신 규약(HTTP, HyperText Transfer Protocol)의 성공 코드 200과 `status: ok`, `index_loaded: false`, `chunk_count: 0`을 돌려준다. 채팅 응답은 HTTP 200과 새 `session_id`, `answered: false`, 빈 `citations`를 돌려준다.

[Render의 FastAPI 배포 가이드](https://render.com/docs/deploy-fastapi) · [HTTP 상태 확인 설정](https://render.com/docs/health-checks)
