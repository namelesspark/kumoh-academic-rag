# 공식 로고·테크모·캠퍼스 사진·제목 그림 준비

첫 화면에 쓸 그림은 배포 준비 때만 받는다. PNG와 JPG는 저장소에 넣지 않으며 서버와 테스트는 그림을 내려받지 않는다. 저장소 루트에서 `python -B api/scripts/prepare_brand_assets.py`를 실행한다.

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
| 음악회 | `947,441,1105,610` | 159×170 |

음악회도 기본형과 같은 원본 지문·형식·크기 검사와 가장자리 흰색 제거 함수를 사용함. 기존 개별 자세 그림 네 장은 계속 생성함.

다섯 자세를 한 장에 붙인 그림(스프라이트 시트)은 `techmo-sprite.png`로 생성함. 필름 한 줄처럼 기본형 → 정숙 → 안내 → 축하 → 음악회 순서로 192×192 칸 다섯 개를 이어 전체 960×192로 만듦. 투명 여백을 먼저 자르고 184×184를 넘는 그림만 비율을 유지해 줄임. 각 칸의 가로 가운데에 놓고 발끝 아래에 4px를 남김. 다섯 자세를 모두 만든 뒤 기존 `atomic_write`로 한 번에 교체하므로 변환·쓰기 실패 시 기존 파일을 보존함.

요청별 제한 시간은 5초, 그림별 받기 전체 제한은 20초, 다운로드와 압축 내부 항목의 크기 상한은 각각 1MiB임. 주소 이동은 `https://www.kumoh.ac.kr` 안에서만 허용한다. 압축을 디스크에 풀지 않고 메모리에서 검사한다.

| 생성 경로 (`api/app/chat_web/assets/` 아래) | 요청 주소 | 응답 형식 |
| --- | --- | --- |
| `kumoh-signature.png` | `/chat-assets/kumoh-signature.png` | `image/png` |
| `techmo-basic.png` | `/chat-assets/techmo-basic.png` | `image/png` |
| `techmo-quiet.png` | `/chat-assets/techmo-quiet.png` | `image/png` |
| `techmo-guide.png` | `/chat-assets/techmo-guide.png` | `image/png` |
| `techmo-celebrate.png` | `/chat-assets/techmo-celebrate.png` | `image/png` |
| `techmo-sprite.png` | `/chat-assets/techmo-sprite.png` | `image/png` |

화면의 `chat.css`·`chat.js` 주소에 파일 내용을 요약한 SHA-256 지문을 `?v=`로 붙임. 서버는 시작할 때 화면과 두 파일을 읽고, 주소가 각각 정확히 한 번 있는지 확인함. 화면과 `/chat-assets/` 응답에는 쓸 때마다 다시 확인하라는 `Cache-Control: no-cache` 지시를 보냄. 기존 화면 보안 정책은 유지함.

검증한 결과를 임시 파일에 모두 쓴 뒤 최종 파일로 교체한다. 도장을 확인한 봉투만 우편함에 넣는 것과 같다. 한 그림이 실패해도 다른 그림을 계속 준비하며 종료 코드 0으로 끝낸다. 실패한 그림의 기존 파일은 보존하고, 파일이 없으면 서버가 404로 답한다. 로그에는 그림별 성공 여부와 실패 종류만 한 줄로 남긴다.

## 캠퍼스 사진 네 장

로그인·메인 화면의 배경 사진도 같은 스크립트가 배포 준비 때만 받는다. JPG는 저장소에 넣지 않는다. 2026-11-14에 학교 공식 홈페이지에서 확인한 아래 값을 사용한다. 원본은 모두 `https://www.kumoh.ac.kr` 아래의 1920×280 JPEG이고, 화면은 표의 순서대로 보여 준다.

| 순서 | 생성 경로 (`api/app/chat_web/assets/` 아래) | 화면에 적는 이름 | 원본 경로 | 바이트 | 지문(SHA-256) |
| ---: | --- | --- | --- | ---: | --- |
| 1 | `campus-aerial.jpg` | 양호동 캠퍼스 | `/_res/ko/img/sub05/bg_subvisual_pc.jpg` | 583939 | `8faafc7fd7e7aab32534db748751786cac4ce274b7b90502f1458e383bbab710` |
| 2 | `campus-hill.jpg` | 디지털관과 금오산 자락 | `/_res/ko/img/sub01/bg_subvisual_pc.jpg` | 436640 | `dbc71342b577655fd9e08e2e7e7b50631da92e676a0be8f227bdc80d960326cb` |
| 3 | `campus-gate.jpg` | 정문의 밤 | `/_res/ko/img/sub06/bg_subvisual_pc.jpg` | 346802 | `69f8c4620bf576cc8290a3bd122db80761a1e5e270edafbf7f77f9ff81cba3c1` |
| 4 | `campus-field.jpg` | 대운동장의 저녁 | `/_res/ko/img/sub04/bg_subvisual_pc.jpg` | 299358 | `eb5c46f8a47e642e22a2dbbc55248a7eefcffb00d43f997f76459c65445555a5` |

- **요청 헤더** — 학교 서버는 브라우저가 보낸 것처럼 보이지 않는 사진 요청에 143바이트 HTML 오류를 준다. 그래서 사진 요청에만 브라우저형 `User-Agent`(요청한 프로그램 이름)와 `Referer: https://www.kumoh.ac.kr/ko/index.do`(어느 페이지에서 왔는지)를 붙인다. 로고와 테크모 요청은 전과 같다.
- **저장 조건** — 바이트 수, 지문, JPEG 형식, 1920×280 크기가 모두 맞을 때만 저장한다. 바이트 수와 지문을 먼저 보므로 HTML 오류는 그림을 열기 전에 걸린다.
- **재압축 없음** — 받은 바이트를 그대로 쓴다. 저장한 파일의 지문이 표의 값과 같다.
- **시간 한도** — 사진은 요청 하나가 응답 없이 기다리는 시간 15초, 한 장 전체 60초로 로고·테크모의 한도(5초·20초)와 따로 둔다. 4초·10초였을 때 실제 배포 준비에서 한 장이 시간 초과로 빠져 늘렸다.
- **다시 시도** — 시간 초과나 연결 오류가 나면 한 장당 한 번 더 받는다. 다시 받을 때는 처음부터 새로 읽고, 두 번의 시간을 합쳐 한 장 전체 60초를 넘기지 않는다. 서버가 오류 상태로 답했거나 크기·주소·지문이 틀린 경우는 다시 받아도 같으므로 시도하지 않는다. 두 번째도 실패하면 그 사진만 건너뛴다.
- **빌드가 늘어나는 시간** — 네 장이 모두 끝까지 막혀도 4분 안쪽이다. 요청이 응답 없이 멈춘 흔한 경우는 한 장에 30초쯤이다.
- **한 장씩 처리** — 사진마다 따로 받고 따로 검사한다. 한 장이 실패해도 나머지를 계속 준비하고 종료 코드 0으로 끝낸다. 실패한 사진의 기존 파일은 그대로 둔다.
- **서버 응답** — `/chat-assets/<파일 이름>`을 `image/jpeg`로 낸다. 파일이 없으면 404로 답하고, 화면은 남색 바탕으로 동작한다.

학교가 사진을 바꾸면 지문이 달라져 준비가 실패한다. 그때는 새 사진을 눈으로 확인한 뒤 표와 스크립트의 바이트 수·지문을 함께 고친다.

## 제목 글자 그림

로그인 화면 왼쪽의 제목은 글자를 그림으로 그려 `title-lettering.png` 한 장으로 둔다. 간판 가게에서 글씨를 받아 와 간판만 거는 것과 같다. 글씨 틀(글꼴 파일)은 가게에 두고 화면에는 완성한 간판만 내려 준다.

| 항목 | 값 |
| --- | --- |
| 글꼴 | Gugi Regular |
| 저작권 | Copyright (c) 2017 by TAE System & Typefaces Co.. All rights reserved. |
| 라이선스 | [SIL Open Font License 1.1](https://github.com/google/fonts/blob/16680f8688ffcd467d2eb2146a9ce0343404581d/ofl/gugi/OFL.txt) |
| 출처 | [google/fonts 커밋 `16680f8688ffcd467d2eb2146a9ce0343404581d`](https://github.com/google/fonts/tree/16680f8688ffcd467d2eb2146a9ce0343404581d/ofl/gugi) |
| 받는 주소 | https://raw.githubusercontent.com/google/fonts/16680f8688ffcd467d2eb2146a9ce0343404581d/ofl/gugi/Gugi-Regular.ttf |
| 바이트 | 990856 |
| 지문(SHA-256) | `c0b1f979979cfc309fb2438fa9464f96173353e0c4842cc7a5919658184ed9d3` |

- **글귀** — 두 줄 「졸업까지,」 / 「테크모와 함께」. "테크모" 세 글자만 `#FFD100`, 나머지는 흰색이다.
- **그리기** — 글자 크기 172px, 줄 간격은 글자 크기의 1.12배, 두 줄 모두 들여쓰기 없이 같은 왼쪽 끝에서 시작한다. 투명 바탕에 그린 뒤 글자가 실제로 차지한 영역에 16px 여백만 남기고 잘라 PNG로 저장한다. 시안에서 같은 값으로 그린 결과는 1014×376이다.
- **받기** — 글꼴용 크기 한도를 로고·사진의 1MiB와 따로 2MiB로 둔다. 주소 이동은 `https://raw.githubusercontent.com` 안에서만 허용한다. 바이트 수와 지문이 모두 맞을 때만 글꼴을 연다.
- **글꼴은 내려 주지 않는다** — 글꼴 파일은 그림을 그릴 때만 메모리에서 쓰고 디스크에 저장하지 않는다. 서버의 허용 파일 목록에도 없다. 저장소에도 넣지 않는다.
- **실패 처리** — 글꼴을 받지 못하거나 지문이 다르면 기존 그림을 그대로 두고 종료 코드 0으로 끝낸다. 그림이 없으면 서버가 404로 답하고 화면은 같은 글귀를 기본 글꼴 제목으로 보여 준다.
- **서버 응답** — `/chat-assets/title-lettering.png`을 `image/png`로 낸다.

이 라이선스는 글꼴로 만든 문서(여기서는 PNG)에는 같은 라이선스를 요구하지 않는다. 글꼴 파일을 함께 나눠 주지 않으므로 라이선스 사본을 저장소에 넣지 않고 위 표로 출처를 밝힌다.

## 검증

추가 의존성이나 외부 복사 코드 없이 기존 Pillow와 파이썬 표준 라이브러리를 사용한다. 제목 글자 그리기 검사는 Pillow에 들어 있는 기본 글꼴과 영문 글귀로 한다. 가상 이미지와 가짜 응답만 사용하는 검증 명령은 다음과 같음.

```text
node --test api/tests/web/citation_link.test.mjs api/tests/web/graduation_demo.test.mjs api/tests/web/landing_design.test.mjs api/tests/web/photo_input.test.mjs api/tests/web/poster_lookup.test.mjs api/tests/web/techmo_assistant.test.mjs
python -B -m unittest api.tests.test_brand_assets api.tests.test_web api.tests.test_health api.tests.test_chat_stub -v
```
