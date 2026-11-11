"""
api 폴더를 일반 패키지로 표시한다.

이 파일이 없으면 `python -m unittest api/tests/test_health.py` 가 만드는 모듈 이름
`api.tests.test_health` 를 네임스페이스 패키지로 찾는데, 실행 환경에 같은 이름의
`api` 패키지가 설치돼 있으면 그쪽이 먼저 잡혀 테스트를 못 찾는다.
일반 패키지로 두면 저장소 루트의 api/ 가 항상 먼저 잡힌다.

서버 실행은 여전히 api/ 폴더에서 `uvicorn app.main:app` 으로 한다.
"""
