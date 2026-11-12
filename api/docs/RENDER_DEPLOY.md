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
