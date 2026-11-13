# 공식 로고와 테크모 준비

첫 화면에 쓸 그림은 배포 준비 때만 받는다. PNG는 저장소에 넣지 않으며 서버와 테스트는 그림을 내려받지 않는다. 저장소 루트에서 `python -B api/scripts/prepare_brand_assets.py`를 실행한다.

2026-11-13에 학교 공식 홈페이지에서 확인한 아래 값을 사용한다. 교내 대회 출품작에 공식 로고와 테크모를 그대로 사용하기로 정했음.

| 원본 | 받는 주소 | 확인 값 |
| --- | --- | --- |
| 시그니처 좌우조합 정장 02번 | https://www.kumoh.ac.kr/ko/sub01_01_08.do?mode=download&articleNo=536069&attachNo=157277 | zip 229,603바이트, 내부 `시그니처좌우조합(정장)02.png` 782×113, 투명 배경 |
| 테크모 자세 모음 | https://www.kumoh.ac.kr/_res/ko/img/sub01/img_character_pc.jpg | JPG 1198×767, 134,539바이트 |

파일 내용의 지문(SHA-256)은 로고 PNG가 `1cc2997436ca4deffbdde78614e6def3141cc7381494cb8870557d257193b5cd`, 테크모 JPG가 `703d80a95afd60c22d301a7fde25be9a89d97fe95f9edef43f3fe093b0de297a`임. zip 자체는 확인한 지문이 없어 검사하지 않는다. 한글 파일명 인코딩에 기대지 않고 내부 항목의 지문으로 PNG를 고른다.

출처는 [학교 UI 게시판 글 536069](https://www.kumoh.ac.kr/ko/sub01_01_08.do), [캐릭터 소개](https://www.kumoh.ac.kr/ko/sub01_01_02_02.do)임.

테크모는 끝 픽셀을 포함한 영역 `144,142,611,555`를 사용한다. Pillow에는 `(144, 142, 612, 556)`을 넘겨 468×414로 자른다. 가장자리에서 네 방향으로 이어진 흰색만 투명하게 바꾸므로 윤곽 안의 눈 흰자는 남는다. JPG 압축 오차 허용값은 `WHITE_TOLERANCE` 한 곳에 둔다.

같은 JPG를 한 번만 받아 기본형과 정숙·안내·축하 자세에 함께 쓴다. 각 영역은 오른쪽·아래 끝 픽셀을 포함하며, Pillow에는 두 끝값에 1을 더해 넘긴다. 자세별 영역과 결과 크기는 다음과 같음.

| 자세 | 원본 영역 | 결과 크기 |
| --- | --- | --- |
| 정숙 | `742,111,881,293` | 140×183 |
| 안내 | `742,430,881,610` | 140×181 |
| 축하 | `947,129,1105,273` | 159×145 |

세 자세도 기본형과 같은 원본 지문·형식·크기 검사와 가장자리 흰색 제거 함수를 사용한다. 음악회 영역은 이번에 가공하지 않는다.

요청별 제한 시간은 5초, 그림별 받기 전체 제한은 20초, 다운로드와 압축 내부 항목의 크기 상한은 각각 1MiB임. 주소 이동은 `https://www.kumoh.ac.kr` 안에서만 허용한다. 압축을 디스크에 풀지 않고 메모리에서 검사한다.

| 생성 경로 (`api/app/chat_web/assets/` 아래) | 요청 주소 | 응답 형식 |
| --- | --- | --- |
| `kumoh-signature.png` | `/chat-assets/kumoh-signature.png` | `image/png` |
| `techmo-basic.png` | `/chat-assets/techmo-basic.png` | `image/png` |
| `techmo-quiet.png` | `/chat-assets/techmo-quiet.png` | `image/png` |
| `techmo-guide.png` | `/chat-assets/techmo-guide.png` | `image/png` |
| `techmo-celebrate.png` | `/chat-assets/techmo-celebrate.png` | `image/png` |

검증한 결과를 임시 파일에 모두 쓴 뒤 최종 파일로 교체한다. 도장을 확인한 봉투만 우편함에 넣는 것과 같다. 한 그림이 실패해도 다른 그림을 계속 준비하며 종료 코드 0으로 끝낸다. 실패한 그림의 기존 파일은 보존하고, 파일이 없으면 서버가 404로 답한다. 로그에는 그림별 성공 여부와 실패 종류만 한 줄로 남긴다.

추가 의존성이나 외부 복사 코드 없이 기존 Pillow와 파이썬 표준 라이브러리를 사용한다. 가상 이미지와 가짜 응답만 사용하는 검증 명령은 다음과 같음.

```text
python -B -m unittest api.tests.test_brand_assets api.tests.test_web -v
```
