"""학사일정 달력 분류 규칙(#176)이 설계 문서와 스타일 주석에 맞게 적혔는지 본다.

화면(`chat.js`)은 대상 문구 단어를 먼저 보고, 단어가 없을 때만 공식 학사일정 출처로 `enroll`을 고른다.
달력 패널을 열 때 한 번 받은 응답으로 달 이동과 목록 전환을 다시 그린다.

#143 장은 빈 줄을 뺀 줄 전체를 아래 사본(`CHAPTER`)과 비교한다. 처음에는 필요한 줄만 찾고, 다음에는
「다시 요청한다」「요청」 같은 금지 낱말로 반대 문장을 막았다. 그러자 「서버에서 일정을 불러온다」처럼
다른 말로 쓴 반대 문장이 같은 장의 다른 절에 들어와도 통과했다(교차 검토 재현). 같은 뜻을 쓰는 말은
끝이 없어 낱말 목록으로는 닫히지 않는다. 사본과 줄 단위로 비교하면 어떤 말로 줄을 더하거나 고치거나
옮겨도 실패하고, 마크다운 해석도 필요 없다. 줄 안의 공백은 하나로 줄여 비교한다.

#143 장을 고칠 때는 사본도 함께 고친다. 실패 메시지의 차이 목록이 바뀐 줄을 보여 준다.

공식 주소는 `ast`로 `academic_calendar.py`의 `url=` 값을 읽어(이어 붙인 문자열도 합친 값) 장 안의 주소와 비교한다.
app을 가져오지 않고 파일을 글자로만 읽는다. 학교 원문이나 학생 데이터는 쓰지 않는다.

실행(저장소 루트):
    python -B -m unittest api.tests.test_calendar_source_kind_doc
"""

import ast
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI_NOTES = ROOT / "web" / "docs" / "UI_NOTES.md"
SERVICE = ROOT / "api" / "app" / "services" / "academic_calendar.py"
CHAT_CSS = ROOT / "api" / "app" / "chat_web" / "assets" / "chat.css"

CALENDAR_HEADING = "## 학사일정 월 달력 보기 (#143)"

# #143 장 제목 다음 줄부터 다음 `## ` 제목 앞까지의 사본. 빈 줄은 비교하지 않는다.
CHAPTER = r"""
팀 피드백(2026-11-18) 6단계다. 학사일정 패널은 월 달력을 기본 보기로 두고, 기존 `/api/v1/academic-calendar/{year}/{term}` 응답 한 번으로 달 이동과 목록 전환을 처리한다.
동작은 `chat.js`가, 모양은 `chat.css` 끝의 #143 절이 맡는다. 일정 이름은 아래 그림에서 모두 가상이다.
### 와이어프레임
```text
넓은 패널 (안쪽 폭 560px 이상)
학사 일정 · 2028학년도 1학기
[‹ 이전 달]          2028년 4월          [다음 달 ›] [목록 보기]
 일     월     화     수     목     금     토
  9     10   ((11))   12     13     14     15      ← 오늘은 숫자 둘레 accent 원
        [── 가상 수강신청 ───────────]               ← 줄 0 (data-lane="0")
               [── 가상 시험 ─────────]             ← 줄 1 (data-lane="1")
              +1개                                  ← 세 번째 일정부터 날짜별로 접음
4월 11일 일정
  가상 수강신청 · 4월 10일–13일 · 출처
좁은 패널 (안쪽 폭 560px 미만)
[‹]            2028년 4월            [›] [목록 보기]
 일   월   화   수   목   금   토
  9   10  (11)  12   13   14   15
       •   • •  • •  • •                            ← 칸마다 점 3개까지, 막대는 숨김
4월 11일 일정 (위와 같은 목록)
목록 보기
[‹]            2028년 4월            [›] [월 보기 ■]  ← aria-pressed="true", 목록 보기에서는 버튼 이름이 「월 보기」
  2028년 4월에 하루라도 걸치는 일정의 section.evidence 줄, 시작일순
  일정이 없으면: 2028년 4월에는 일정이 없어요
```
- 주말 열(일·토)은 옅은 틴트, 이웃 달 날짜는 흐린 숫자만 있고 누를 수 없다.
- 고른 날은 날짜 버튼 둘레 학교 파랑 2px 테두리, 초점은 그 안쪽 2px 고리다. 둘은 겹치지 않고 함께 보인다.
- 칸 최소 폭은 `max(44px, 2.75rem)`이다. 기본 글꼴 16px에서는 44px, 브라우저 기본 글꼴을 키우면 칸도 함께 넓어진다(48px 글꼴에서 132px).
  7칸 최소 폭(`max(308px, 19.25rem)`, 기본 글꼴에서 308px)보다 좁은 패널은 요일 머리와 날짜 격자만 함께 가로로 밀리고, 머리 줄과 고른 날 목록은 제자리에 있다.
  처음에는 칸이 44px 고정이라 기본 글꼴 48px에서 굵은 두 자리 날짜(약 47px)가 버튼 안 36px에 들지 않아 두 줄로 갈라졌고,
  두 줄 높이가 숫자 행을 넘어 오늘 원이 두 숫자를 감싸지 못했다(교차 검토 지적). 원·`+N개` 지적도 같은 뿌리(글은 rem으로 커지는데 칸만 px 고정)였다.
  그래서 글을 줄이지 않고 칸을 글꼴에 맞춰 넓히며, 날짜 버튼은 `white-space: nowrap`으로 숫자를 한 줄로 둔다.
  `chat.js`(#144)는 루트 아래에 머리 줄, 본문 상자 `.acal-body`, 고른 날 목록 `.acal-day-list`를 형제로 둔다. 월 보기의 본문 상자에는 요일 머리와 격자만 들어간다.
  스크롤 상자는 요일 머리와 격자를 직접 품은 부모(`:is(.acal, .acal-body):has(> .acal-grid)`, 지금은 `.acal-body`)다. 두 줄은 같은 최소 폭(`max(308px, 19.25rem)`)으로 넘쳐 같이 밀린다.
  본문 상자는 안쪽 4px 여백에 초점 고리가 들어가게 하고 바깥 여백 -4px로 폭을 되돌린다. 스크롤 상자는 넘친 선을 자르기 때문이다.
- 머리 줄과 고른 날 목록은 스크롤 상자 밖이다. 터치·트랙패드·휠 어느 쪽으로 그 위에서 가로로 밀어도 요일 머리와 격자는 움직이지 않는다.
  목록 보기의 본문 상자는 격자를 품지 않아 스크롤 상자가 되지 않는다.
- 교차 검토로 네 번 고쳤다. 격자에만 스크롤을 주면 요일 머리가 어긋났고, 요일 머리·격자를 루트 직속으로 가정하면 달력 전체가 밀렸다.
  목록이 본문 상자 안에 있던 동안에는 목록에 sticky와 `touch-action: pan-y`를 걸었는데, 트랙패드 가로 스크롤은 막지 못했다.
  원인은 스타일이 아니라 구조(목록이 스크롤 상자 안에 있음)였고, #144가 목록을 상자 밖으로 옮긴 뒤 두 우회 규칙을 지웠다.
  `handwriting_input.test.mjs`의 touch-action 허용 목록도 원래대로 캔버스와 테크모 두 규칙만 남겼다.
### 스크립트와 스타일이 함께 지키는 이름
| 이름 | 쓰임 |
| --- | --- |
| `.acal[data-view="month\|list"]` | 루트. `[data-panel-content]` 안에 둔다. 불투명 `--surface` 면이고 컨테이너 쿼리 이름은 `acal`이다 |
| `[data-acal-nav="prev\|next"]`, `.acal-title` | 이전·다음 달 버튼과 제목(`aria-live="polite"`). 세 요소와 보기 전환 버튼은 머리 줄 `.acal-header` 하나에 두고, 월 보기와 목록 보기가 함께 쓴다. `.acal`의 첫 자식은 학년도·학기 제목이고 머리 줄은 그 바로 뒤다 |
| `[data-acal-view-toggle]` | 목록 보기 전환(`aria-pressed`) |
| `.acal-body` | 본문 상자. 월 보기에서는 요일 머리와 격자만 품고 가로 스크롤 상자가 된다. 목록 보기에서는 표시 월에 걸치는 일정의 목록 줄(없으면 빈 달 안내)을 품고 스크롤하지 않는다(`chat.js`) |
| `.acal-weekdays` | 요일 머리 7칸, 일요일부터. 격자 밖, `.acal-body`의 직속 자식이다. 격자와 같은 열 정의를 쓴다 |
| `.acal-grid[role=grid]` > `.acal-week[role=row]` | 격자와 주 한 줄. 주 줄은 7열 4행 격자다 |
| `.acal-cell[role=gridcell]` | 날짜 칸. `data-col`(1–7), `aria-selected`. 이웃 달 칸은 `data-outside`를 달고 버튼 없이 숫자 글자만 둔다 |
| `button.acal-day` | 칸 안 날짜 버튼. 이름(`aria-label`)은 `{날짜} · 일정 N건`으로 그날 전체 일정 수를 읽는다(아래 「날짜 버튼 이름」). 오늘이면 `aria-current="date"`. 숨긴 일정이 있으면 `data-more="N"`이다. 안쪽 자식은 숫자 → 「+N개」 → 점 묶음 순서이고, 스타일은 점 묶음 바로 앞 요소를 「+N개」로 본다(`:has(+ * .acal-dot)`) |
| `.acal-bar` | 기간 막대. `.acal-week`의 직속 자식(날짜 칸 뒤), `aria-hidden="true"`, `data-col`·`data-span`(1–7)·`data-lane`(0–1)·`data-kind` |
| `.acal-dot` | 점. 날짜 버튼 안 마지막 자식인 점 묶음에 들어 있다. 칸마다 3개까지, `data-kind` |
| `.acal-day-list` | 고른 날 목록. 일정 이름·기간·출처 링크 |
| `section.evidence` | 목록 보기 줄(표시 월에 걸치는 일정, 시작일순)과 고른 날 목록 안 일정 줄 둘 다 쓴다. 월 보기로 돌아오면 `chat.js`가 `.acal-body`의 목록 줄을 요일 머리와 날짜 격자로 바꿔 넣는다. 스타일은 예비로 월 보기에서 `.acal`이나 `.acal-body` 직속인 목록 보기 줄만 접고, `.acal-day-list` 안의 일정은 그대로 보인다 |
| `data-kind` | `enroll`(수강신청 파랑), `exam`(시험 코랄), `holiday`(휴일 빨강), `register`(등록 노랑), `neutral` |
### 분류 정하기 (#176)
- 분류 순서: 대상 문구의 단어로 먼저 고르고(`enroll` → `exam` → `holiday` → `register`), 맞는 단어가 없을 때만 출처를 본다. 분류 단어도, 공식 주소와 정확히 같은 출처도 없을 때만 `neutral`이다.
- 출처 규칙: 대상 문구에 분류 단어가 없고 `sources` 배열에 `url`이 공식 주소 `https://www.kumoh.ac.kr/ko/schedule_reg.do`와 글자 하나까지 같은 항목이 있으면 `enroll`이다. 배열 몇 번째에 있는지는 따지지 않는다.
- 출처가 없을 때: 분류 단어가 있으면 `sources`가 빈 배열이거나 없어도 그 단어의 분류다. 분류 단어도 없으면 오류 없이 `neutral`이다.
- 주소 비교: 주소는 정확히 같을 때만 맞는다. 분류 단어가 없는 일정에 `http://`로 시작하거나 끝에 `/`나 조회 문자열이 붙거나 호스트가 다른 주소만 있으면 `neutral`이다.
- 단어 우선 이유: 이 주소는 수강신청만 담은 페이지가 아니라 학교 학사일정 전체 페이지다. 출처를 먼저 보면 같은 페이지에서 옮긴 시험 일정까지 파랑이 되므로, 대상 문구에 수강신청 낱말 없이 「시험」이 있으면 공식 출처가 있어도 `exam`이다.
- 수강신청 낱말: 「수강신청」과 「수강 신청」처럼 수강과 신청 사이 공백이 있든 없든 같은 낱말로 본다.
- 단어가 여럿일 때: 위 순서에서 앞선 단어가 이긴다. 가상 대상 문구 「수강신청·시험」과 「수강 신청·시험」은 둘 다 `enroll`이다.
- 막대와 점: 막대(`.acal-bar`)와 점(`.acal-dot`)은 같은 분류 결과(`data-kind`)를 쓴다. 분류 한 곳만 고치면 두 표시가 함께 바뀐다.
- 응답 한 번: 달력 패널을 열 때 `/api/v1/academic-calendar/{year}/{term}`을 한 번 요청한다. 이전·다음 달 이동과 목록 보기 전환은 받아 둔 응답으로 다시 그리고, 다시 요청하지 않는다.
- 검사: 서버 응답과 API 계약은 바꾸지 않았다. `api/tests/test_calendar_source_kind_doc.py`가 #143 장의 줄 전체를 검사 안의 사본과, 공식 주소를 `academic_calendar.py`의 출처 `url`과, `chat.css`의 두 분류 주석을 글자 그대로 비교한다. #143 장을 고치면 검사의 사본도 함께 고친다.
### 목록 보기 (#182)
- 머리 줄: 월 제목(`.acal-title`, `aria-live="polite"`)과 `‹`·`›` 버튼, 보기 전환 버튼은 두 보기가 함께 쓴다. 목록 보기에서도 숨기지 않고, 두 보기는 같은 표시 월을 가리킨다.
- 목록 범위: 표시 월에 하루라도 걸치는 일정을 시작일순으로 모두 보여 준다(`event.start < 다음 달 1일 && event.end >= 이번 달 1일`, 세계 표준시(UTC) 날짜 값으로 비교). 같은 달의 지난 일정도 넣어 월 격자와 같은 일정을 보여 준다.
- 월 경계 일정: 두 달에 걸친 일정은 두 달 목록에 한 번씩 나오고, 두 달 모두 원래 기간과 출처를 보여 준다. 가상 일정 2028-12-31~2029-01-02는 12월과 1월 목록에 한 번씩 있다.
- 빈 달: 일정이 없는 달에는 「{월}에는 일정이 없어요」 꼴의 안내를 ko·en·zh로 보여 준다. 이전·다음 달 버튼은 그대로 쓸 수 있다.
- 같은 달과 초점: 월 보기↔목록 보기 전환과 언어 변경 뒤에도 표시 월은 그대로다. 머리 줄 버튼을 Enter·Space로 누르면 초점은 누른 버튼에 남는다. 월 보기로 돌아오면 날짜 격자의 탭 정지점은 하나이고 화살표·Home/End·PageUp/PageDown 이동도 그대로다.
- 언어 변경 뒤 초점: ko·en·zh를 바꿔 다시 그려도 머리 줄 버튼(`‹`·`›`·보기 전환)은 같은 요소라 초점이 그대로 남는다. 월 보기에서 표시 월 기준 날짜 버튼에 있던 초점은 다시 그린 같은 날짜 버튼으로 옮겨 준다. 목록 보기 줄과 월 보기 고른 날 목록의 출처 링크에 있던 초점도 다시 그린 같은 일정의 같은 출처 링크로 돌아온다. 주소와 제목이 같은 출처가 여럿이어도 원래 링크로 돌아오고, 다시 그린 화면에 그 링크가 없으면 초점을 옮기지 않는다. 언어 메뉴에서 언어를 고르면 다시 그리는 동안 달력이 초점을 가져가지 않고, 메뉴가 닫히며 초점은 언어 버튼으로 간다.
- 남은 일정 기준: 테크모 상태(`found`/`hold`)는 지금처럼 오늘 이후에 끝나는 일정(`remaining`)으로 정하고, 패널이 돌려주는 남은 일정 수도 바꾸지 않는다. 표시 월 기준으로 바뀌는 것은 목록 범위뿐이다.
- 첫 표시 월: 이번 달에 걸치는 일정이 있으면(지난 일정 포함) 이번 달, 없으면 첫 남은 일정의 시작 달, 남은 일정도 없으면 전체 일정 가운데 가장 늦은 종료일이 속한 달, 응답이 비었으면 이번 달이다. 목록 보기도 이 달에서 시작한다.
- 요청 1건: 패널을 한 번 연 뒤 월 이동·보기 전환·언어 변경을 이어 해도 일정 요청은 1건이다. 위 「응답 한 번」 규칙이 목록 보기에도 그대로 걸린다.
- 날짜 계산 라이브러리는 쓰지 않는다. 비교식 하나면 되고, 외부 스크립트를 쓰지 않는다는 규칙에도 맞는다.
### 배치
- 주 줄(`.acal-week`)은 `repeat(7, minmax(max(44px, 2.75rem), 1fr))` 열과 `2.25rem 1.375rem 1.375rem minmax(1.375rem, auto)` 행이다(기본 글꼴 16px에서 36·22·22px).
  날짜 칸은 네 행을 모두 덮고(`grid-row: 1 / 5`), 숫자는 1행, 막대는 2·3행, 「+N개」는 4행이다.
- 날짜 버튼 안도 같은 행 격자다(`calc(2.25rem - 2px) 1.375rem 1.375rem`, 첫 행만 위 테두리 2px를 뺀다). 그래서 버튼 4행이 주 줄 4행과 같은 높이에서 시작하고,
  「+N개」(`grid-row: 4`)는 글꼴 크기와 상관없이 두 번째 막대 아래에 놓인다. 점 묶음은 5행이다. 「+N개」가 두 줄이면 버튼 내용이 늘고, 칸이 덮은 주 줄 4행(auto)이 함께 는다.
- 오늘 원 지름은 1.75rem과 칸 안쪽 폭(버튼 테두리 안에서 좌우 2px씩 띄운 폭) 가운데 작은 값이다. 좌우를 2px에 걸고(`inset-inline: 2px`)
  `max-width: 1.75rem`과 `margin-inline: auto`로 가운데 두며, 높이는 `aspect-ratio: 1`로 폭을 따른다. 세로 중심은 숫자 행 가운데(`translate: 0 -50%`)다.
  처음에는 지름이 1.75rem 고정이라 기본 글꼴 32px에서 56px(테두리 포함 60px)가 되어 44px 칸과 오른쪽 여백을 넘었다(교차 검토 지적).
  `test_today_circle_fits_the_cell_at_any_text_size`가 기본 글꼴 16·24·32·48px와 그 글꼴의 가장 좁은 칸·60·80·120px에서 원이 칸과 숫자 행 안에 들고 가운데에 오는지 계산한다.
- 행 높이·줄 높이·오늘 원 최대 크기는 rem이라 브라우저 기본 글꼴을 키우면 함께 커진다. 처음에는 px 행에 flex 열 끝으로 「+N개」를 밀었는데(`margin-top: auto`),
  칸 내용이 네 행보다 짧으면 4행이 늘지 않아, 기본 글꼴 32px의 영어 화면에서 두 줄 「+10 more」가 64px에서 시작해 두 번째 막대(59~79px)에 가렸다(교차 검토 지적).
  `test_more_label_never_overlaps_the_second_bar_at_any_text_size`가 기본 글꼴 16·24·32·48px에서 실제 선언의 px·rem·calc·max를 풀어 「+N개」 위 끝과 두 번째 막대 아래 끝을 비교한다.
- 44px 칸에서 「+N개」가 쓸 수 있는 글 폭은 36px(좌우 안쪽 여백 2px·테두리 2px)다. 영어 「+10 more」는 약 57px라 칸 안에서 두 줄로 나누고,
  띄어 쓰지 않은 긴 글도 글자 단위로 끊는다(`white-space: normal`, `overflow-wrap: anywhere`, `max-width: 100%`). 4행은 `minmax(1.375rem, auto)`라 두 줄이면 주 줄이 늘어난다.
  처음에는 `nowrap`이라 영어 화면에서 이웃 칸의 「+N more」와 겹쳤다(교차 검토 지적). `test_more_label_wraps_inside_a_44px_cell_in_every_language`가
  ko·en·zh 글 폭을 넉넉하게 어림해 선언에서 계산한 칸 폭과 비교한다.
- 막대 위치는 인라인 style 없이 `data-col` → `grid-column-start`, `data-span` → `grid-column-end: span N`, `data-lane` 0·1 → `grid-row` 2·3 선택자로만 정한다.
  페이지 보안 정책이 `default-src 'self'`이고, 선언만 읽어도 배치를 검사할 수 있어서다. 막대는 칸 위에 겹쳐 그리고 `pointer-events: none`이라 막대를 눌러도 그 아래 날짜가 골라진다.
- 긴 이름은 막대 끝에서 잘린다. 말줄임(`text-overflow`)은 전역 검사(`motion_layout.test.mjs`)가 두 요소 밖에서 막아 쓰지 않는다. 전체 이름은 고른 날 목록에 있다.
- 좁은 패널 전환은 화면 폭이 아니라 `.acal`의 안쪽 폭으로 한다(`@container acal (width < 560px)`). 막대·점·고른 날 목록은 스크립트가 늘 함께 그리고,
  좁으면 막대를 숨기고 날짜 버튼 아래 줄에 점을 보인다. 고른 날 목록은 두 폭 모두 보인다.
- 「+N개」(`.acal-more`)는 넓은 보기에서만 보인다. 막대 두 줄 기준으로 센 값이라 점만 남는 좁은 칸에서는 막대와 함께 숨긴다(#146).
  「+N개」는 시각용 배지라 날짜 버튼 이름에 넣지 않는다. 배지와 `data-more`, `aria-hidden`은 그대로 두고, 이름은 그날 전체 일정 수를 읽는다(#149).
### 날짜 버튼 이름 (#149)
- 형식은 `{날짜} · 일정 N건`이다. 날짜 부분은 `calendarDateLabel()` 결과를 그대로 쓰고, 영어 날짜에 쉼표가 없는 것도 그 형식이다.
- 전에는 날짜만 읽다가 막대가 넘칠 때만 `· +N개`를 붙여, 일정이 3건인 날도 「+1개」로 들렸다. 일정이 없는 날은 날짜만 읽었다.
- `chat.js`는 그날 일정을 거르는 함수 하나(시작일 ≤ 그날 ≤ 종료일)를 두고, 날짜 이름의 수·점(처음 3건)·고른 날 목록이 모두 이 결과를 쓴다. 세는 곳과 보여 주는 곳이 갈라지지 않는다.
- 문구는 `t()`의 두 줄 `{date} · 일정 {count}건`과 `{date} · 일정 1건`이다. 영어만 1건일 때 단수(`1 event`)를 쓴다.
- 가상 일정 3건(2028-02-26 기준)으로 본 이름은 다음과 같다.
| 언어 | 0건 | 1건 | 3건 |
| --- | --- | --- | --- |
| ko | `2028년 2월 29일 · 일정 0건` | `2028년 2월 28일 · 일정 1건` | `2028년 2월 27일 · 일정 3건` |
| en | `February 29 2028 · 0 events` | `February 28 2028 · 1 event` | `February 27 2028 · 3 events` |
| zh | `2028年2月29日 · 0项日程` | `2028年2月28日 · 1项日程` | `2028年2月27日 · 3项日程` |
- `academic_calendar.test.mjs`가 언어를 바꿀 때마다 다시 그린 버튼을 새로 찾아 위 이름과 글자 그대로 비교하고, 이름에 `+1개`·`+1 more`·`+1项`이 들어가면 실패한다.
  `api/tests/test_calendar_day_label_doc.py`는 이 절에 예시 9개가 한 번씩 있는지와 「+N개」를 이름에 넣지 않는다는 문장을 본다.
- 검사는 화면이 붙인 `aria-label` 문자열만 본다. 브라우저 접근성 트리나 화면 읽기 도구 출력은 재지 않았다.
### 색과 대비
- 헤어라인은 `color-mix(in srgb, var(--text) 9%, transparent)`(`--acal-line`)이다. 장식 선이라 3:1 대상이 아니고, 날짜 칸은 숫자와 자리로 알아본다.
  3:1은 머리 버튼 경계(`--text-muted`, hover `--focus-ink`, 눌림 `--accent`), 선택 테두리(`--accent`), 초점 고리(`--focus-ring`), 오늘 원 선(`--accent`)에 건다.
- 배경으로 쓰는 새 색은 맨 위 세 색 블록의 6자리 색 이름표다(`--acal-weekend`, `--acal-today-fill`, 분류별 `-bg`·`-ink`·`-dot`).
  `landing_design.test.mjs`의 다크 밝은 면 검사는 배경 변수를 그 블록에서만 풀고 `color-mix`의 비율을 읽지 않아, 틴트를 `color-mix(var(--text) …)`로 쓰면 다크에서 밝은 면으로 잡힌다.
- 다크의 칩 글자색은 휘도 .5를 넘어 점 배경으로 쓰면 밝은 면이 된다. 그래서 점은 따로 중간 밝기 색(`-dot`)을 둔다.
- 분류 칩 글자와 채움의 대비(손 계산, 소수 첫째 자리 반올림)는 다음과 같다. 테스트는 이 표를 옮겨 적지 않고 선언에서 다시 계산한다.
| 분류 | 라이트 | 다크 |
| --- | --- | --- |
| 수강신청 `enroll` | 7.5:1 | 8.5:1 |
| 시험 `exam` | 6.2:1 | 8.7:1 |
| 휴일 `holiday` | 6.5:1 | 9.6:1 |
| 등록 `register` | 6.6:1 | 9.9:1 |
| 중립 `neutral` | 8.0:1 | 9.4:1 |
### 움직임
- 새 transition·animation은 없다. 달 이동과 보기 전환은 바로 다시 그린다. 움직임 줄이기 설정에서 끌 것이 없고, reduced-motion 블록 수(3개 고정)도 늘리지 않는다.
  처음에는 날짜 버튼과 머리 버튼에 120ms 색 전환을 두었는데, 전역 검사가 대화 목록 서랍과 카드 밖의 transition을 막아 뺐다.
### 검사
- `api/tests/test_academic_calendar_style.py`가 `chat.css`의 #143 절을 작은 선택자 판정기로 가상 요소(날짜 칸·날짜 버튼·막대·점·머리 버튼·고른 날 목록)에 걸어
  실제 선언을 모은다. 사용자 변수와 `color-mix`도 물려받은 값으로 풀어 라이트·다크(속성)·다크(시스템) 대비를 계산한다.
- 같은 파일이 7열·44px, `data-col`·`data-span`·`data-lane` 전 범위의 배치, 9% 헤어라인, 주말 틴트, 이웃 달 흐린 글자, 오늘 원, 안쪽 초점 고리와 선택 테두리,
  7칸 최소 폭 아래 요일 머리·격자 함께 스크롤, 기본 글꼴 16·24·32·48px에서 두 자리 날짜·오늘 원·「+N개」가 칸과 행 안에 드는지(`test_two_digit_date_stays_on_one_line_inside_the_circle_at_any_text_size` 등), 좁은 패널의 막대↔점 전환, 목록 보기 전환, 움직임 없음, 토큰만 쓴 색, 세 색 블록의 새 이름표 순서를 본다.
- 판정기는 자식(`>`)과 자손을 구별하고 `:has(…)`를 가상 요소의 표시로 읽는다. 가상 요소는 `chat.js`의 실제 구조(루트 직속 머리 줄·본문 상자·고른 날 목록, 월 보기 `.acal-body` 안 요일 머리·격자,
  버튼 안 숫자 → 「+N개」 → 점 묶음, 고른 날 목록 안 `section.evidence`)를 따른다.
- 교차 검토로 고친 점: 달 보기에서 고른 날 일정까지 접던 규칙, 점 묶음에 걸려 「+N개」가 막대에 가리던 `:last-child` 규칙,
  요일 머리와 어긋나던 격자 스크롤, 그리고 본문 상자를 놓쳐 달력 전체가 밀리던 루트 스크롤.
  처음 판정기는 `>`를 자손처럼 보고 「+N개」를 마지막 자식으로 꾸몄고, 다음 판은 요일 머리를 루트 직속으로 꾸며 결함을 잡지 못했다.
- 반복된 공통 원인은 테스트가 선언 값만 확인하고, 그 선언이 실제 화면 구조에서 어떤 동작을 낳는지는 재지 않았다는 점이다.
  그래서 지금은 요소마다 조상 가운데 가로 스크롤 상자가 있는지를 overflow 선언으로 계산한다(`test_horizontal_scroll_starts_only_on_weekdays_and_grid`).
  요일 칸·날짜·막대·점은 `.acal-body`를 움직이고, 고른 날 목록과 그 안 일정 글·출처 링크, 목록 보기 줄, 머리 줄은 조상에 가로 스크롤 상자가 없어야 한다.
  터치·트랙패드·휠은 모두 포인터 아래에서 가장 가까운 스크롤 상자를 움직이므로, 이 계산은 입력 방식과 상관없다.
  앞선 재현 사례도 `test_earlier_cross_review_repros_stay_fixed`에 함께 둔다.
- `test_chat_versions_style.py`의 #140 절 범위는 #143 머리 주석에서 끝나게 고쳤다. 전에는 파일 끝까지라 뒤에 붙인 절이 #140 규칙으로 검사됐다.
- 배치와 대비는 선언과 색 계산으로만 확인했고, 브라우저에서 직접 재지는 않았다.
"""

# 옛 주석 두 문장(「열쇠말이 없으면 중립」, 「열쇠말이 없으면 data-kind가 neutral」)에 함께 든 글자.
# 줄바꿈·공백이 끼어도 같은 글자로 본다. 새 주석은 「열쇠말이 없어도」·「없으면 공식 학사일정 출처」로 쓴다.
OLD_COMMENT = "열쇠말이 없으면"
OLD_COMMENT_PATTERN = re.compile(r"열쇠말이\s*없으면")

# chat.css 분류 주석 두 곳. 여는 글자로 찾고, 공백을 하나로 줄여 주석 전체를 비교한다.
CSS_COMMENTS = {
    "/* 학사일정 달력(#143).": (
        "/* 학사일정 달력(#143). 주말 열 틴트, 오늘 원 채움, 분류 칩(옅은 채움 -bg, 진한 글자 -ink)과 좁은 패널 점(-dot). "
        "수강신청 파랑, 시험 코랄, 휴일 빨강, 등록 노랑이다. "
        "열쇠말이 없어도 공식 학사일정 출처가 있으면 수강신청 파랑, 둘 다 없을 때만 중립이다. "
        "글자는 채움과 4.5:1, 점은 둘레 면과 3:1을 넘는다. */"
    ),
    "/* 분류 색.": (
        "/* 분류 색. 옅은 채움(-bg)에 진한 글자(-ink)다. "
        "대상 글자의 열쇠말을 먼저 보고, 없으면 공식 학사일정 출처가 있을 때 enroll이다. "
        "둘 다 아니면 data-kind가 neutral이거나 비어 있어 중립색이다. "
        "배경은 맨 위 색 블록의 이름표로만 쓴다(다크 밝은 면 검사가 배경 변수를 그 블록에서 푼다). */"
    ),
}


def squeeze(line):
    """줄 안의 공백을 하나로 줄이고 앞뒤 공백을 지운다."""
    return " ".join(line.split())


def snapshot_lines():
    return [squeeze(line) for line in CHAPTER.split("\n") if line.strip()]


def chapter_lines(text):
    """#143 장 제목 다음 줄부터 다음 `## `·`# ` 제목 앞까지, 빈 줄을 뺀 줄. 장 제목이 하나가 아니면 None."""
    lines = text.replace("\r\n", "\n").split("\n")
    if lines.count(CALENDAR_HEADING) != 1:
        return None
    start = lines.index(CALENDAR_HEADING) + 1
    end = next((i for i in range(start, len(lines)) if re.match(r"#{1,2} ", lines[i])), len(lines))
    return [squeeze(line) for line in lines[start:end] if line.strip()]


def service_url(source):
    """`url=` 키워드 인자가 하나이고 그 값이 문자열 상수면 파이썬이 합친 값을, 아니면 None을 돌려준다."""
    values = [node.value for node in ast.walk(ast.parse(source)) if isinstance(node, ast.keyword) and node.arg == "url"]
    if len(values) != 1 or not isinstance(values[0], ast.Constant) or not isinstance(values[0].value, str):
        return None
    return values[0].value


def chapter_urls(lines):
    return set(re.findall(r"https://[^\s`]+", "\n".join(lines or [])))


def css_comment(css, start):
    """`start`로 여는 주석 하나의 글(공백을 하나로 줄임). 없거나 둘이면 None."""
    if css.count(start) != 1:
        return None
    begin = css.index(start)
    end = css.find("*/", begin)
    return None if end < 0 else squeeze(css[begin : end + 2])


class CalendarSourceKindDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.url = service_url(SERVICE.read_text(encoding="utf-8"))
        cls.css = CHAT_CSS.read_text(encoding="utf-8")

    def test_calendar_chapter_matches_the_snapshot(self):
        self.assertEqual(chapter_lines(self.notes), snapshot_lines())

    def test_official_url_matches_the_service_source(self):
        self.assertIsNotNone(self.url)
        self.assertEqual(chapter_urls(chapter_lines(self.notes)), {self.url})
        source_line = next(line for line in snapshot_lines() if line.startswith("- 출처 규칙:"))
        self.assertIn(f"`{self.url}`", source_line)

    def test_css_comments_follow_the_new_rule(self):
        self.assertIsNone(OLD_COMMENT_PATTERN.search(self.css))
        for start, expected in CSS_COMMENTS.items():
            with self.subTest(start=start):
                self.assertEqual(css_comment(self.css, start), expected)


class ReviewReproTest(unittest.TestCase):
    """교차 검토 재현: 실제 문서·코드·주석을 메모리에서 바꾸면 검사가 실패해야 한다."""

    @classmethod
    def setUpClass(cls):
        cls.notes = UI_NOTES.read_text(encoding="utf-8")
        cls.source = SERVICE.read_text(encoding="utf-8")
        cls.url = service_url(cls.source)
        cls.css = CHAT_CSS.read_text(encoding="utf-8")

    def changed(self, old, new, text=None):
        text = self.notes if text is None else text
        self.assertEqual(text.count(old), 1, old)
        return text.replace(old, new, 1)

    def test_every_earlier_and_latest_document_repro_fails(self):
        rule = "- 응답 한 번:"
        cases = {
            "공식 출처 결과 뒤집기": ("같은 항목이 있으면 `enroll`이다.", "같은 항목이 있으면 `neutral`이다."),
            "중립 조건 넓힘": ("분류 단어도, 공식 주소와 정확히 같은 출처도 없을 때만", "출처가 비었으면"),
            "달 이동 설명 삭제": ("이전·다음 달 이동과 목록 보기 전환은 받아 둔 응답으로 다시 그리고, ", ""),
            "별도 소절로 옮김": ("- 출처 규칙:", "#### 가상 별도 절\n\n- 출처 규칙:"),
            "규칙 줄 앞 소제목 대괄호": ("### 배치\n", "#### [example]\n\n### 배치\n"),
            "소절 요청 주소에서 학기 빠짐": ("열 때 `/api/v1/academic-calendar/{year}/{term}`을", "열 때 `/api/v1/academic-calendar`을"),
            "도입부 요청 주소에서 학기 빠짐": ("기존 `/api/v1/academic-calendar/{year}/{term}` 응답", "기존 `/api/v1/academic-calendar` 응답"),
            "소절에 반대 규칙 줄 추가": ("다시 요청하지 않는다.\n", "다시 요청하지 않는다.\n- 달을 이동할 때마다 다시 요청한다.\n"),
            "도입부 뒤 반대 문장": ("일정 이름은 아래 그림에서 모두 가상이다.\n",
                            "일정 이름은 아래 그림에서 모두 가상이다.\n달을 이동할 때마다 서버에 일정을 다시 요청한다.\n"),
            "움직임 절 다시 요청": ("### 움직임\n\n", "### 움직임\n\n- 달을 이동할 때마다 서버에 일정을 다시 요청한다.\n"),
            "움직임 절 요청": ("### 움직임\n\n", "### 움직임\n\n- 달을 이동할 때마다 서버에 일정을 요청한다.\n"),
            "움직임 절 불러온다": ("### 움직임\n\n", "### 움직임\n\n- 달을 이동할 때마다 서버에서 일정을 불러온다.\n"),
            "시험 예시 옛 조건": ("수강신청 낱말 없이 「시험」이", "「시험」이"),
            "섞인 단어 예시 뒤집기": ("둘 다 `enroll`이다.", "둘 다 `exam`이다."),
            "띄어 쓴 예시 삭제": ("「수강신청·시험」과 「수강 신청·시험」은 둘 다", "「수강신청·시험」은"),
            "응답 한 번 줄을 다른 장으로": (f"\n{rule}", f"\n- 가상 자리"),
        }
        for case, (old, new) in cases.items():
            with self.subTest(case=case):
                self.assertNotEqual(chapter_lines(self.changed(old, new)), snapshot_lines())

    def test_intro_moved_to_another_section_fails(self):
        intro = next(line for line in self.notes.split("\n") if line.startswith("팀 피드백(2026-11-18) 6단계다."))
        moved = self.changed("### 배치\n", f"### 배치\n\n{intro}\n", self.changed(intro + "\n", ""))
        self.assertNotEqual(chapter_lines(moved), snapshot_lines())

    def test_other_document_url_fails(self):
        moved = self.changed(f"`{self.url}`", "`https://example.invalid/ko/schedule_reg.do`")
        self.assertNotEqual(chapter_urls(chapter_lines(moved)), {self.url})

    def test_concatenated_service_url_is_read_whole(self):
        old = f'url="{self.url}"'
        joined = service_url(self.changed(old, f'url="{self.url}" "/v2"', self.source))
        self.assertEqual(joined, self.url + "/v2")
        self.assertNotEqual(chapter_urls(chapter_lines(self.notes)), {joined})

    def test_changed_css_comment_fails(self):
        changed = self.changed("출처가 있을 때 enroll이다.", "출처가 있을 때 neutral이다.", self.css)
        self.assertNotEqual(css_comment(changed, "/* 분류 색."), CSS_COMMENTS["/* 분류 색."])

    def test_leftover_old_css_sentence_fails(self):
        end = self.css.index("*/", self.css.index("/* 분류 색.")) + 2
        for case, old in {
            "한 줄": "/* 응답 글자에 열쇠말이 없으면 data-kind가 neutral이거나 비어 있어 중립색이다. */",
            "줄바꿈으로 나눔": "/* 응답 글자에 열쇠말이\n   없으면 data-kind가 neutral이다. */",
        }.items():
            with self.subTest(case=case):
                leftover = self.css[:end] + "\n" + old + self.css[end:]
                self.assertEqual(css_comment(leftover, "/* 분류 색."), CSS_COMMENTS["/* 분류 색."])
                self.assertIsNotNone(OLD_COMMENT_PATTERN.search(leftover))


if __name__ == "__main__":
    unittest.main()
