"""kumoh-rag 서버 프로그램의 뿌리 패키지. 웹 요청을 받아 답을 돌려주는 코드가 이 아래에 모여 있다.

여기서 API는 "프로그램끼리 요청과 응답을 주고받는 약속"을 뜻한다 (Application Programming Interface).
사용하는 쪽은 `api/` 폴더를 파이썬이 모듈을 찾는 경로 목록(sys.path)에 넣은 뒤
`from app.main import app`으로 웹 앱 객체를 가져온다. 이 객체는 웹 서버 라이브러리인 FastAPI가 만든다.
"""
