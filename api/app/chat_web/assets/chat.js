// 화면 언어(#116). 한국어 원문을 열쇠로 쓰는 사전이다. 한국어는 원문을 그대로 쓰고, 영어·중국어 표에 없는 문구도
// 한국어로 남는다. 그래서 한국어 화면의 글자는 사전이 생기기 전과 같다. 이 묶음은 화면 요소를 건드리지 않는다.
// 서버가 만든 답(answer·notice)과 인용 원문, 저장한 예전 답은 여기를 거치지 않는다.
const langKey = "kumoh-chat-lang:v1";
const langTags = { ko: "ko", en: "en", zh: "zh-Hans" };
// 메뉴 항목은 각 언어 자기 이름으로 쓰고, 아래 작은 글씨에 다른 글자로 된 이름을 붙인다.
const langChoices = [
  { value: "ko", name: "한국어", label: "한국어", description: "Korean" },
  { value: "en", name: "English", label: "English", description: "영어" },
  { value: "zh", name: "中文(简体)", label: "中文", description: "Chinese (Simplified)" },
];
const uiText = {
  en: {
    "테마": "Theme",
    "시스템": "System",
    "라이트": "Light",
    "다크": "Dark",
    "테마: {name}": "Theme: {name}",
    "테마: 시스템": "Theme: System",
    "화면 설정": "Display settings",
    "배경 움직임 일시정지": "Pause background motion",
    "테크모": "Techmo",
    "아이오": "AIO",
    "금오공대 학사 행정 AI 아이오": "Kumoh Tech Academic AI · AIO",
    "국립금오공과대학교 학사 안내": "Kumoh National Institute of Technology · Academic Guide",
    "근거 조문과 함께 답하는 금오공대 학사 안내": "Academic answers from Kumoh Tech, backed by the regulation articles",
    "졸업까지, 아이오와 함께": "To graduation, with AIO",
    "물어봐요, 아이오": "Ask AIO",
    "학번으로 들어와 보세요!": "Sign in with your student number!",
    "국립금오공과대학교": "Kumoh National Institute of Technology",
    "금오공대 학사 안내": "Kumoh Tech Academic Guide",
    "로그인": "Log in",
    "시연 계정으로 이수 내역을 확인해 보세요.": "Check course records with a demo account.",
    "학번": "Student number",
    "예: 20990002": "e.g. 20990002",
    "비밀번호": "Password",
    "시연 전용 계정입니다. 실제 학번이나 비밀번호를 입력하지 마세요.": "Demo accounts only. Do not enter a real student number or password.",
    "시연 계정": "Demo accounts",
    "시연 계정 · 누르면 채워집니다": "Demo accounts · tap to fill in",
    "졸업 요건에 가까움": "Close to graduating",
    "학점이 많이 남음": "Many credits left",
    "비교과 점수 부족": "Short on extracurricular points",
    "로그인 없이 둘러보기": "Browse without logging in",
    "교내 주요 사이트": "Campus websites",
    "학교 홈페이지": "University website",
    "포털(Onekit)": "Portal (Onekit)",
    "(새 창)": "(new window)",
    "이전 사이트 보기": "Previous sites",
    "다음 사이트 보기": "Next sites",
    "외부 서비스": "External service",
    "공지와 학교 소식": "Notices and campus news",
    "수강신청·성적·학적": "Registration, grades, records",
    "비교과·마일리지": "Extracurriculars and mileage",
    "학습관리시스템(LMS)": "Learning system (LMS)",
    "강의 자료와 과제": "Course materials and assignments",
    "도서관": "Library",
    "자료 검색·열람실": "Catalog search and reading rooms",
    "생활관(기숙사)": "Dormitory",
    "입사 신청과 생활 안내": "Move-in applications and dorm life",
    "학사일정": "Academic calendar",
    "학기 주요 날짜": "Key dates of the semester",
    "식당 메뉴": "Cafeteria menu",
    "오늘의 학식": "Today's campus meals",
    "웹메일": "Webmail",
    "학교 메일": "University email",
    "학생상담센터": "Student Counseling Center",
    "심리·진로 상담": "Personal and career counseling",
    "국제교류·어학교육": "International exchange and languages",
    "교환학생·한국어 과정": "Exchange programs and Korean courses",
    "교내 전화번호": "Campus phone directory",
    "부서 연락처": "Department contacts",
    "에브리타임": "Everytime",
    "학생 커뮤니티·시간표": "Student community and timetable",
    "교내 대회 출품작 · 가상 학생 데이터로 동작하는 시연입니다": "Campus contest entry · a demo running on fictional student data",
    "대화 목록": "Conversations",
    "홈": "Home",
    "가상 학생 데이터입니다": "Fictional student data",
    "로그아웃": "Log out",
    "새 대화": "New chat",
    "지난 대화": "Past conversations",
    "닫기": "Close",
    "기록 모두 지우기": "Clear all history",
    "대화 기록은 이 브라우저에만 저장돼요": "History is saved only in this browser",
    "학사 규정에 질문하기": "Ask about academic regulations",
    "질문": "Question",
    "사진 첨부": "Attach photo",
    "아이오에게 물어보세요 · 사진만 보내도 돼요": "Ask AIO · or just send a photo",
    "보내기": "Send",
    "답변 멈추기": "Stop answer",
    "첨부 제거": "Remove attachment",
    "글자가 보이는 사진 한 장(JPEG·PNG, 5MB 이하). 서버는 사진을 저장하지 않아요. 얼굴이나 개인정보가 찍힌 사진은 올리지 마세요. 학번, 이름 같은 개인정보는 입력하지 마세요.":
      "One photo with readable text (JPEG or PNG, up to 5 MB). The server does not store photos. Do not upload photos showing faces or personal information. Do not type personal details such as your student number or name.",
    "대화 내용": "Conversation",
    "졸업까지 남은 조건, 아이오가 같이 확인해요": "AIO checks what is left until graduation with you",
    "규정 질문에는 근거 조문을 붙여 답해요.": "Regulation questions are answered with the supporting articles.",
    "기능 바로가기": "Shortcuts",
    "졸업 체크": "Graduation check",
    "비교과 추천": "Extracurricular picks",
    "사진으로 묻기": "Ask with a photo",
    "규정 질문": "Regulation questions",
    "학사 일정": "Academic calendar",
    "{year}학년도 {semester}학기": "Academic year {year}, semester {semester}",
    "{scope}에 남은 일정이 없어요.": "No upcoming events for {scope}.",
    "이전 달": "Previous month",
    "다음 달": "Next month",
    "목록 보기": "List view",
    "월 보기": "Month view",
    "일 월 화 수 목 금 토": "Sun Mon Tue Wed Thu Fri Sat",
    "일요일 월요일 화요일 수요일 목요일 금요일 토요일": "Sunday Monday Tuesday Wednesday Thursday Friday Saturday",
    "1월 2월 3월 4월 5월 6월 7월 8월 9월 10월 11월 12월": "January February March April May June July August September October November December",
    "{year}년 {month}": "{month} {year}",
    "{month} {day}일": "{month} {day}",
    "{month} {day}일 일정": "Events for {month} {day}",
    "고른 날에 일정이 없어요.": "No events on this date.",
    "+{count}개": "+{count} more",
    "{date} · 일정 {count}건": "{date} · {count} events",
    "{date} · 일정 1건": "{date} · 1 event",
    "출처": "Source",
    " · 확인일 ": " · Checked on ",
    "공식 페이지에서 다시 확인해 주세요.": "Please check the official page for updates.",
    "캠퍼스 안내": "Campus guide",
    "가상 학생의 이수 내역으로 남은 졸업 조건을 계산해요.": "Calculates the remaining graduation requirements from a fictional student's records.",
    "졸업 체크 결과 아래에 부족한 점수를 채울 프로그램이 함께 나와요.": "Programs that can fill missing points appear below the graduation check.",
    "포스터나 안내문 사진을 고르면 글자를 읽어 답을 찾아요.": "Pick a photo of a poster or notice and AIO reads the text to find answers.",
    "궁금한 점을 적으면 근거 조문과 함께 답해요.": "Write your question and get an answer with the supporting articles.",
    "확인한 수강신청 일정을 날짜순으로 보여 줘요.": "Shows confirmed course registration dates in order.",
    "장소를 고르면 용도와 위치를 볼 수 있어요.": "Pick a place to see what it is for and where it is.",
    "가상 학생의 이수 내역으로 남은 졸업 조건을 계산해요. 항목마다 충족·부족·확인 필요를 표로 보여 주고, 적용한 근거를 함께 적어요.":
      "Calculates the remaining graduation requirements from a fictional student's records. Each item is shown as met, short, or needs checking, with the basis applied.",
    "졸업 체크 결과 아래에 부족한 점수를 채울 프로그램이 함께 나와요. 접수 상태와 정원은 공식 페이지에서 다시 확인해 주세요.":
      "Programs that can fill missing points appear below the graduation check. Please recheck application status and capacity on the official page.",
    "글자가 보이는 사진 한 장을 고르면 글자를 읽어 답을 찾아요. JPEG·PNG, 5MB 이하만 받아요. 얼굴이나 개인정보가 찍힌 사진은 올리지 마세요. 사진을 고른 뒤 「보내기」를 눌러 주세요.":
      "Pick one photo with readable text and AIO reads it to find answers. Only JPEG or PNG up to 5 MB. Do not upload photos showing faces or personal information. After choosing a photo, press “Send”.",
    "궁금한 점을 적으면 근거 조문과 함께 답해요. 근거를 찾지 못하면 지어내지 않고, 찾지 못했다고 알려요.":
      "Write your question and get an answer with the supporting articles. If no basis is found, AIO says so instead of making things up.",
    "종료일이 지나지 않은 수강신청 일정을 날짜순으로 보여 줘요.": "Shows upcoming course registration dates in order.",
    "졸업 체크 시작": "Start graduation check",
    "졸업 체크와 추천 보기": "See graduation check and picks",
    "사진 선택": "Choose photo",
    "질문 입력하기": "Type a question",
    "아이오와 새 대화": "Start a new chat with AIO",
    "알림 닫기": "Close notification",
    "언어 / Language: {name}": "Language: {name}",
    "궁금한 점을 물어보세요": "Ask me anything",
    "쉿, 찾아보는 중이에요…": "Shh, looking it up…",
    "찾았어요! 함께 확인해 봐요": "Found it! Let's check together",
    "근거와 함께 안내해 드릴게요": "Here is the answer with its basis",
    "확인할 근거가 더 필요해요": "I need more evidence to confirm",
    "잠시 문제가 생겼어요. 다시 시도해 주세요": "Something went wrong. Please try again",
    "보관함 ({count})": "Archive ({count})",
    "아이오의 읽지 않은 답변 있음": "Unread replies from AIO",
    "아이오의 답변 기다리는 중": "Waiting for AIO’s reply",
    "아이오의 읽지 않은 답변": "Unread reply from AIO",
    "대화 메뉴": "Conversation menu",
    "보관하기": "Archive",
    "보관 해제": "Unarchive",
    "삭제": "Delete",
    "취소": "Cancel",
    "정말로 삭제하시겠습니까?": "Delete this conversation?",
    "‘{title}’ 대화를 지우면 되돌릴 수 없어요.": "Deleting ‘{title}’ cannot be undone.",
    "대화 기록을 모두 삭제하시겠습니까?": "Delete all conversation history?",
    "보관함을 포함한 대화 {count}개가 지워지고 되돌릴 수 없어요.": "{count} conversations, including archived ones, will be deleted. This cannot be undone.",
    "답변이 도착했어요": "A reply has arrived",
    "‘{title}’ 대화에 아이오의 답변이 왔어요": "AIO replied in ‘{title}’",
    "{label} 이수 내역으로 들어왔어요": "Signed in with the records of {label}",
    "안녕하세요, {label} 님": "Hello, {label}",
    "좋아요, 로그인을 눌러 보세요": "Great, now press Log in",
    "학번 또는 비밀번호가 맞지 않아요": "Student number or password is incorrect",
    "쉿, 시연 계정으로만 들어올 수 있어요": "Shh, only demo accounts can sign in",
    "학번을 확인하고 있어요": "Checking your student number",
    "로그인하지 못했어요. 다시 시도해 주세요.": "Could not log in. Please try again.",
    "서버에 연결하지 못했어요. 다시 시도해 주세요.": "Could not reach the server. Please try again.",
    "가상 학생을 복원하지 못했어요. 다시 로그인해 주세요.": "Could not restore the fictional student. Please log in again.",
    "이 기능은 시연 계정으로 로그인한 뒤 쓸 수 있어요": "Log in with a demo account to use this feature",
    "먼저 가상 학생을 골라 주세요": "Please choose a fictional student first",
    "서버에 질문을 보내는 중…": "Sending your question…",
    "시행일 ": "Effective ",
    "가상 답변 근거": "Answer basis (fictional)",
    "공식 원문 보기": "View the official original",
    " ({context}, 새 탭에서 열림)": " ({context}, opens in a new tab)",
    "원문(한국어)": "Original (Korean)",
    "아이오가 생각하는 중": "AIO is thinking",
    "모델이 쓴 원문, 영어일 수 있음": "The model's own words, may be in English",
    "아이오가 {seconds}초 동안 생각함": "AIO thought for {seconds}s",
    "이 질문은 가상 규정에서 근거를 찾지 못했어요.": "No basis for this question was found in the fictional regulations.",
    "다시 시도": "Try again",
    "수정": "Edit",
    "질문 수정": "Edit question",
    "저장하고 묻기": "Save and ask",
    "다시 답하기": "Answer again",
    "답변 버전": "Answer versions",
    "이전 버전": "Previous version",
    "다음 버전": "Next version",
    "저장할 수 없는 번호가 있어 이전 버전을 유지했어요.": "Kept the previous version because the new one contains a number that can't be saved.",
    "서버 응답을 받지 못했어요.": "No response from the server.",
    "내 질문: ": "My question: ",
    "사진 1장": "1 photo",
    "내 요청: ": "My request: ",
    "가상 학생 졸업 체크": "Graduation check for a fictional student",
    "졸업 체크 결과를 불러오는 중…": "Loading the graduation check…",
    "졸업 체크 결과를 받지 못했어요.": "Could not get the graduation check.",
    "답변 모드": "Answer mode",
    "빠르게": "Fast",
    "깊이 생각": "Deep",
    "깊이 생각하기": "Think deeply",
    "바로 답해요 · 보통 1~3초": "Answers right away · usually 1–3 s",
    "생각 과정을 보여 주며 꼼꼼히 답해요 · 10~30초": "Shows its reasoning and answers carefully · 10–30 s",
    "답변 모드: {name}": "Answer mode: {name}",
    "사진에서 글자를 읽는 중…": "Reading the text in the photo…",
    "읽은 글자로 답을 찾는 중…": "Finding answers from the text…",
    "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.": "Could not reach the server. Check your network and try again.",
    "서버가 사진을 처리하지 못했어요.": "The server could not process the photo.",
    "서버가 읽은 글자로 답을 만들지 못했어요.": "The server could not answer from the text.",
    "서버가 이 글자를 받지 않았어요. 질문과 읽은 글자를 고친 뒤 다시 물어 주세요.": "The server rejected this text. Edit the question and the text, then ask again.",
    "읽은 글자가 2,000자를 넘어요. 필요한 부분만 남기고 줄인 뒤 다시 물어 주세요.": "The text is over 2,000 characters. Keep only what you need and ask again.",
    "질문이나 읽은 글자를 적은 뒤 다시 물어 주세요.": "Enter a question or the text, then ask again.",
    "사진에서 읽은 글자가 없어요. 글자를 직접 적거나 질문을 함께 보내 주세요.": "No text was read from the photo. Type the text yourself or add a question.",
    "근거가 충분하지 않아 답변을 보류했어요. 읽은 글자를 고치거나 질문을 더 구체적으로 적어 다시 물어 주세요.":
      "The answer was held for lack of evidence. Fix the text or make the question more specific, then ask again.",
    "확인하지 못한 내용에는 링크를 붙이지 않아요. 학교 공지에서 직접 찾아 주세요.": "Unconfirmed items get no links. Please check the university notices directly.",
    "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요.": "The photo is over 5 MB. Please upload a smaller one.",
    "JPEG나 PNG 사진만 읽을 수 있어요.": "Only JPEG or PNG photos can be read.",
    "사진을 열 수 없거나 화소 수가 1,200만을 넘어요. 다른 사진으로 다시 올려 주세요.": "The photo cannot be opened or is over 12 megapixels. Please upload another photo.",
    "사진에서 읽을 수 있는 글자나 QR을 찾지 못했어요. 글자가 또렷하게 보이게 다시 찍어 주세요.": "No readable text or QR code was found. Please retake the photo so the text is clear.",
    "사진만으로는 어느 행사인지 하나로 정하지 못했어요. 제목과 날짜가 함께 보이거나 QR이 보이는 사진으로 다시 시도해 주세요.":
      "The photo alone did not identify one event. Try a photo showing the title and date, or a QR code.",
    "지금은 서버가 사진 속 글자를 읽을 수 없어요. QR이 보이는 사진으로 다시 시도하거나 글자를 직접 적어 주세요.":
      "The server cannot read text in photos right now. Try a photo with a QR code or type the text.",
    "답변을 보류했어요. 링크는 보여 주지 않아요.": "The answer was held. No links are shown.",
    "사진에서 확인한 내용이 없어요. 링크는 보여 주지 않아요.": "Nothing was confirmed from the photo. No links are shown.",
    "행사를 찾았어요. {title}": "Found the event: {title}",
    "{kind}에서 답을 찾았어요.": "Found an answer in {kind}.",
    "규정 검색": "Regulation search",
    "다른 요청을 마친 뒤 다시 시도해 주세요.": "Finish the other request, then try again.",
    "안내를 찾는 중이에요…": "Looking up the guide…",
    "안내를 찾는 중…": "Looking it up…",
    "서버가 안내를 불러오지 못했어요.": "The server could not load the guide.",
    "서버 안내의 형식이 맞지 않아요.": "The server's guide data is malformed.",
    "손글씨로 입력": "Handwriting input",
    "필기 영역": "Writing area",
    "되돌리기": "Undo",
    "지우기": "Clear",
    "넣기": "Insert",
    "펜이나 손가락으로 쓰고 넣기를 누르면 읽은 글자가 입력창 커서 자리에 들어가요. 바로 보내지는 않아요.":
      "Write with a pen or finger, then press Insert to put the recognized text at the cursor in the question box. It is not sent automatically.",
    "글씨를 읽는 중…": "Reading your handwriting…",
    "글씨를 읽지 못했어요. 또박또박 다시 쓰거나 고쳐 쓴 뒤 다시 넣어 주세요.": "Could not read the handwriting. Write more clearly or fix it, then press Insert again.",
    "글씨 그림이 너무 커요. 일부를 지우고 다시 넣어 주세요.": "The handwriting image is too large. Erase part of it and press Insert again.",
    "지금은 손글씨를 읽을 수 없어요. 잠시 뒤 다시 넣어 주세요.": "Handwriting cannot be read right now. Press Insert again in a moment.",
    "읽는 시간이 너무 오래 걸렸어요. 다시 넣어 주세요.": "Reading took too long. Press Insert again.",
    "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 넣어 주세요.": "Could not reach the server. Check your network and press Insert again.",
    "서버가 글씨를 처리하지 못했어요. 다시 넣어 주세요.": "The server could not process the handwriting. Press Insert again.",
    "읽은 글자를 입력창에 넣었어요. 확인한 뒤 보내 주세요.": "The recognized text is in the question box. Check it, then send.",
  },
  zh: {
    "테마": "主题",
    "시스템": "跟随系统",
    "라이트": "浅色",
    "다크": "深色",
    "테마: {name}": "主题：{name}",
    "테마: 시스템": "主题：跟随系统",
    "화면 설정": "显示设置",
    "배경 움직임 일시정지": "暂停背景动画",
    "테크모": "Techmo",
    "아이오": "AIO",
    "금오공대 학사 행정 AI 아이오": "金乌工大学务 AI · AIO",
    "국립금오공과대학교 학사 안내": "国立金乌工科大学 · 学业指南",
    "근거 조문과 함께 답하는 금오공대 학사 안내": "附上依据条款作答的金乌工大学业指南",
    "졸업까지, 아이오와 함께": "直到毕业，与 AIO 同行",
    "물어봐요, 아이오": "问问 AIO",
    "학번으로 들어와 보세요!": "用学号登录试试吧！",
    "국립금오공과대학교": "国立金乌工科大学",
    "금오공대 학사 안내": "金乌工大学业指南",
    "로그인": "登录",
    "시연 계정으로 이수 내역을 확인해 보세요.": "用演示账号查看修读记录。",
    "학번": "学号",
    "예: 20990002": "例：20990002",
    "비밀번호": "密码",
    "시연 전용 계정입니다. 실제 학번이나 비밀번호를 입력하지 마세요.": "仅限演示账号。请勿输入真实学号或密码。",
    "시연 계정": "演示账号",
    "시연 계정 · 누르면 채워집니다": "演示账号 · 点击即可填入",
    "졸업 요건에 가까움": "接近毕业要求",
    "학점이 많이 남음": "剩余学分较多",
    "비교과 점수 부족": "非学科积分不足",
    "로그인 없이 둘러보기": "不登录先看看",
    "교내 주요 사이트": "校内主要网站",
    "학교 홈페이지": "学校主页",
    "포털(Onekit)": "门户（Onekit）",
    "(새 창)": "（新窗口）",
    "이전 사이트 보기": "上一组网站",
    "다음 사이트 보기": "下一组网站",
    "외부 서비스": "外部服务",
    "공지와 학교 소식": "公告与学校新闻",
    "수강신청·성적·학적": "选课·成绩·学籍",
    "비교과·마일리지": "非学科活动·积分",
    "학습관리시스템(LMS)": "学习管理系统（LMS）",
    "강의 자료와 과제": "课程资料与作业",
    "도서관": "图书馆",
    "자료 검색·열람실": "资料检索·阅览室",
    "생활관(기숙사)": "宿舍",
    "입사 신청과 생활 안내": "入住申请与生活指南",
    "학사일정": "学年日程",
    "학기 주요 날짜": "学期重要日期",
    "식당 메뉴": "食堂菜单",
    "오늘의 학식": "今日学校餐",
    "웹메일": "网页邮箱",
    "학교 메일": "学校邮箱",
    "학생상담센터": "学生咨询中心",
    "심리·진로 상담": "心理·职业咨询",
    "국제교류·어학교육": "国际交流·语言教育",
    "교환학생·한국어 과정": "交换生·韩语课程",
    "교내 전화번호": "校内电话号码",
    "부서 연락처": "部门联系方式",
    "에브리타임": "Everytime",
    "학생 커뮤니티·시간표": "学生社区·课表",
    "교내 대회 출품작 · 가상 학생 데이터로 동작하는 시연입니다": "校内竞赛参赛作品 · 使用虚拟学生数据运行的演示",
    "대화 목록": "对话列表",
    "홈": "首页",
    "가상 학생 데이터입니다": "虚拟学生数据",
    "로그아웃": "退出登录",
    "새 대화": "新对话",
    "지난 대화": "以往对话",
    "닫기": "关闭",
    "기록 모두 지우기": "清除全部记录",
    "대화 기록은 이 브라우저에만 저장돼요": "对话记录只保存在此浏览器中",
    "학사 규정에 질문하기": "咨询学业规定",
    "질문": "问题",
    "사진 첨부": "附加照片",
    "아이오에게 물어보세요 · 사진만 보내도 돼요": "问问 AIO · 只发照片也可以",
    "보내기": "发送",
    "답변 멈추기": "停止回答",
    "첨부 제거": "移除附件",
    "글자가 보이는 사진 한 장(JPEG·PNG, 5MB 이하). 서버는 사진을 저장하지 않아요. 얼굴이나 개인정보가 찍힌 사진은 올리지 마세요. 학번, 이름 같은 개인정보는 입력하지 마세요.":
      "一张文字清晰的照片（JPEG·PNG，5MB 以内）。服务器不会保存照片。请勿上传含有人脸或个人信息的照片。请勿输入学号、姓名等个人信息。",
    "대화 내용": "对话内容",
    "졸업까지 남은 조건, 아이오가 같이 확인해요": "距离毕业还差什么，AIO 陪你一起确认",
    "규정 질문에는 근거 조문을 붙여 답해요.": "规定问题会附上依据条款作答。",
    "기능 바로가기": "功能快捷入口",
    "졸업 체크": "毕业检查",
    "비교과 추천": "非学科活动推荐",
    "사진으로 묻기": "用照片提问",
    "규정 질문": "规定咨询",
    "학사 일정": "学年日程",
    "{year}학년도 {semester}학기": "{year}学年 第{semester}学期",
    "{scope}에 남은 일정이 없어요.": "{scope}没有剩余日程。",
    "이전 달": "上个月",
    "다음 달": "下个月",
    "목록 보기": "列表视图",
    "월 보기": "月历视图",
    "일 월 화 수 목 금 토": "日 一 二 三 四 五 六",
    "일요일 월요일 화요일 수요일 목요일 금요일 토요일": "星期日 星期一 星期二 星期三 星期四 星期五 星期六",
    "1월 2월 3월 4월 5월 6월 7월 8월 9월 10월 11월 12월": "1月 2月 3月 4月 5月 6月 7月 8月 9月 10月 11月 12月",
    "{year}년 {month}": "{year}年{month}",
    "{month} {day}일": "{month}{day}日",
    "{month} {day}일 일정": "{month}{day}日的日程",
    "고른 날에 일정이 없어요.": "所选日期没有日程。",
    "+{count}개": "+{count}项",
    "{date} · 일정 {count}건": "{date} · {count}项日程",
    "{date} · 일정 1건": "{date} · 1项日程",
    "출처": "来源",
    " · 확인일 ": " · 核查日期 ",
    "공식 페이지에서 다시 확인해 주세요.": "请在官方网站确认最新信息。",
    "캠퍼스 안내": "校园指南",
    "가상 학생의 이수 내역으로 남은 졸업 조건을 계산해요.": "根据虚拟学生的修读记录计算剩余毕业条件。",
    "졸업 체크 결과 아래에 부족한 점수를 채울 프로그램이 함께 나와요.": "毕业检查结果下方会列出可补足积分的项目。",
    "포스터나 안내문 사진을 고르면 글자를 읽어 답을 찾아요.": "选择海报或通知的照片，即可读取文字并查找答案。",
    "궁금한 점을 적으면 근거 조문과 함께 답해요.": "写下疑问，即可获得附上依据条款的回答。",
    "확인한 수강신청 일정을 날짜순으로 보여 줘요.": "按日期顺序显示已确认的选课日程。",
    "장소를 고르면 용도와 위치를 볼 수 있어요.": "选择地点即可查看用途和位置。",
    "가상 학생의 이수 내역으로 남은 졸업 조건을 계산해요. 항목마다 충족·부족·확인 필요를 표로 보여 주고, 적용한 근거를 함께 적어요.":
      "根据虚拟学生的修读记录计算剩余毕业条件。每一项以表格显示满足·不足·需确认，并注明所依据的标准。",
    "졸업 체크 결과 아래에 부족한 점수를 채울 프로그램이 함께 나와요. 접수 상태와 정원은 공식 페이지에서 다시 확인해 주세요.":
      "毕业检查结果下方会列出可补足积分的项目。报名状态和名额请在官方页面再次确认。",
    "글자가 보이는 사진 한 장을 고르면 글자를 읽어 답을 찾아요. JPEG·PNG, 5MB 이하만 받아요. 얼굴이나 개인정보가 찍힌 사진은 올리지 마세요. 사진을 고른 뒤 「보내기」를 눌러 주세요.":
      "选择一张文字清晰的照片，即可读取文字并查找答案。仅接受 5MB 以内的 JPEG·PNG。请勿上传含有人脸或个人信息的照片。选好照片后请点击「发送」。",
    "궁금한 점을 적으면 근거 조문과 함께 답해요. 근거를 찾지 못하면 지어내지 않고, 찾지 못했다고 알려요.":
      "写下疑问，即可获得附上依据条款的回答。找不到依据时不会编造，而是如实告知。",
    "종료일이 지나지 않은 수강신청 일정을 날짜순으로 보여 줘요.": "按日期顺序显示尚未结束的选课日程。",
    "졸업 체크 시작": "开始毕业检查",
    "졸업 체크와 추천 보기": "查看毕业检查和推荐",
    "사진 선택": "选择照片",
    "질문 입력하기": "输入问题",
    "아이오와 새 대화": "与 AIO 开始新对话",
    "알림 닫기": "关闭通知",
    "언어 / Language: {name}": "语言 / Language：{name}",
    "궁금한 점을 물어보세요": "有什么问题尽管问吧",
    "쉿, 찾아보는 중이에요…": "嘘，正在查找…",
    "찾았어요! 함께 확인해 봐요": "找到了！一起看看吧",
    "근거와 함께 안내해 드릴게요": "为你附上依据进行说明",
    "확인할 근거가 더 필요해요": "还需要更多依据来确认",
    "잠시 문제가 생겼어요. 다시 시도해 주세요": "出了点问题，请重试",
    "보관함 ({count})": "归档（{count}）",
    "아이오의 읽지 않은 답변 있음": "有 AIO 的未读回答",
    "아이오의 답변 기다리는 중": "正在等待 AIO 回答",
    "아이오의 읽지 않은 답변": "AIO 的未读回答",
    "대화 메뉴": "对话菜单",
    "보관하기": "归档",
    "보관 해제": "取消归档",
    "삭제": "删除",
    "취소": "取消",
    "정말로 삭제하시겠습니까?": "确定要删除吗？",
    "‘{title}’ 대화를 지우면 되돌릴 수 없어요.": "删除“{title}”后无法恢复。",
    "대화 기록을 모두 삭제하시겠습니까?": "确定要删除全部对话记录吗？",
    "보관함을 포함한 대화 {count}개가 지워지고 되돌릴 수 없어요.": "包括归档在内的 {count} 个对话将被删除，且无法恢复。",
    "답변이 도착했어요": "回答已送达",
    "‘{title}’ 대화에 아이오의 답변이 왔어요": "AIO 在“{title}”中回复了",
    "{label} 이수 내역으로 들어왔어요": "已用 {label} 的修读记录登录",
    "안녕하세요, {label} 님": "你好，{label}",
    "좋아요, 로그인을 눌러 보세요": "好的，请点击登录",
    "학번 또는 비밀번호가 맞지 않아요": "学号或密码不正确",
    "쉿, 시연 계정으로만 들어올 수 있어요": "嘘，只能用演示账号登录",
    "학번을 확인하고 있어요": "正在确认学号",
    "로그인하지 못했어요. 다시 시도해 주세요.": "登录失败，请重试。",
    "서버에 연결하지 못했어요. 다시 시도해 주세요.": "无法连接服务器，请重试。",
    "가상 학생을 복원하지 못했어요. 다시 로그인해 주세요.": "无法恢复虚拟学生，请重新登录。",
    "이 기능은 시연 계정으로 로그인한 뒤 쓸 수 있어요": "使用演示账号登录后才能使用此功能",
    "먼저 가상 학생을 골라 주세요": "请先选择虚拟学生",
    "서버에 질문을 보내는 중…": "正在发送问题…",
    "시행일 ": "施行日期 ",
    "가상 답변 근거": "回答依据（虚拟）",
    "공식 원문 보기": "查看官方原文",
    " ({context}, 새 탭에서 열림)": "（{context}，在新标签页打开）",
    "원문(한국어)": "原文（韩语）",
    "아이오가 생각하는 중": "AIO 正在思考",
    "모델이 쓴 원문, 영어일 수 있음": "模型原文，可能是英文",
    "아이오가 {seconds}초 동안 생각함": "AIO 思考了 {seconds} 秒",
    "이 질문은 가상 규정에서 근거를 찾지 못했어요.": "在虚拟规定中未找到此问题的依据。",
    "다시 시도": "重试",
    "수정": "编辑",
    "질문 수정": "编辑问题",
    "저장하고 묻기": "保存并提问",
    "다시 답하기": "重新回答",
    "답변 버전": "回答版本",
    "이전 버전": "上一版本",
    "다음 버전": "下一版本",
    "저장할 수 없는 번호가 있어 이전 버전을 유지했어요.": "新版本含有无法保存的号码，已保留上一版本。",
    "서버 응답을 받지 못했어요.": "未收到服务器响应。",
    "내 질문: ": "我的问题：",
    "사진 1장": "照片 1 张",
    "내 요청: ": "我的请求：",
    "가상 학생 졸업 체크": "虚拟学生毕业检查",
    "졸업 체크 결과를 불러오는 중…": "正在加载毕业检查结果…",
    "졸업 체크 결과를 받지 못했어요.": "未能获取毕业检查结果。",
    "답변 모드": "回答模式",
    "빠르게": "快速",
    "깊이 생각": "深度",
    "깊이 생각하기": "深度思考",
    "바로 답해요 · 보통 1~3초": "立即回答 · 通常 1~3 秒",
    "생각 과정을 보여 주며 꼼꼼히 답해요 · 10~30초": "展示思考过程并仔细回答 · 10~30 秒",
    "답변 모드: {name}": "回答模式：{name}",
    "사진에서 글자를 읽는 중…": "正在读取照片中的文字…",
    "읽은 글자로 답을 찾는 중…": "正在根据读取的文字查找答案…",
    "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.": "无法连接服务器。请检查网络后重试。",
    "서버가 사진을 처리하지 못했어요.": "服务器无法处理该照片。",
    "서버가 읽은 글자로 답을 만들지 못했어요.": "服务器无法根据读取的文字生成回答。",
    "서버가 이 글자를 받지 않았어요. 질문과 읽은 글자를 고친 뒤 다시 물어 주세요.": "服务器未接受这段文字。请修改问题和读取的文字后再问。",
    "읽은 글자가 2,000자를 넘어요. 필요한 부분만 남기고 줄인 뒤 다시 물어 주세요.": "读取的文字超过 2,000 字。请只保留需要的部分后再问。",
    "질문이나 읽은 글자를 적은 뒤 다시 물어 주세요.": "请输入问题或读取的文字后再问。",
    "사진에서 읽은 글자가 없어요. 글자를 직접 적거나 질문을 함께 보내 주세요.": "照片中没有读取到文字。请直接输入文字或一并发送问题。",
    "근거가 충분하지 않아 답변을 보류했어요. 읽은 글자를 고치거나 질문을 더 구체적으로 적어 다시 물어 주세요.":
      "依据不足，回答已暂缓。请修改读取的文字或更具体地描述问题后再问。",
    "확인하지 못한 내용에는 링크를 붙이지 않아요. 학교 공지에서 직접 찾아 주세요.": "未确认的内容不附链接。请直接在学校公告中查找。",
    "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요.": "照片超过 5MB。请上传更小的照片。",
    "JPEG나 PNG 사진만 읽을 수 있어요.": "只能读取 JPEG 或 PNG 照片。",
    "사진을 열 수 없거나 화소 수가 1,200만을 넘어요. 다른 사진으로 다시 올려 주세요.": "照片无法打开或像素超过 1,200 万。请换一张照片上传。",
    "사진에서 읽을 수 있는 글자나 QR을 찾지 못했어요. 글자가 또렷하게 보이게 다시 찍어 주세요.": "未找到可读取的文字或二维码。请重新拍摄，让文字清晰可见。",
    "사진만으로는 어느 행사인지 하나로 정하지 못했어요. 제목과 날짜가 함께 보이거나 QR이 보이는 사진으로 다시 시도해 주세요.":
      "仅凭照片无法确定是哪个活动。请换一张同时显示标题和日期或带二维码的照片再试。",
    "지금은 서버가 사진 속 글자를 읽을 수 없어요. QR이 보이는 사진으로 다시 시도하거나 글자를 직접 적어 주세요.":
      "服务器目前无法读取照片中的文字。请换一张带二维码的照片，或直接输入文字。",
    "답변을 보류했어요. 링크는 보여 주지 않아요.": "回答已暂缓，不显示链接。",
    "사진에서 확인한 내용이 없어요. 링크는 보여 주지 않아요.": "未从照片中确认任何内容，不显示链接。",
    "행사를 찾았어요. {title}": "找到了活动：{title}",
    "{kind}에서 답을 찾았어요.": "已在{kind}中找到答案。",
    "규정 검색": "规定检索",
    "다른 요청을 마친 뒤 다시 시도해 주세요.": "请在其他请求完成后重试。",
    "안내를 찾는 중이에요…": "正在查找指南…",
    "안내를 찾는 중…": "正在查找…",
    "서버가 안내를 불러오지 못했어요.": "服务器无法加载指南。",
    "서버 안내의 형식이 맞지 않아요.": "服务器指南数据格式不正确。",
    "손글씨로 입력": "手写输入",
    "필기 영역": "书写区域",
    "되돌리기": "撤销",
    "지우기": "清除",
    "넣기": "插入",
    "펜이나 손가락으로 쓰고 넣기를 누르면 읽은 글자가 입력창 커서 자리에 들어가요. 바로 보내지는 않아요.":
      "用笔或手指书写后点击「插入」，识别出的文字会放到输入框的光标处，不会自动发送。",
    "글씨를 읽는 중…": "正在识别手写内容…",
    "글씨를 읽지 못했어요. 또박또박 다시 쓰거나 고쳐 쓴 뒤 다시 넣어 주세요.": "未能识别手写内容。请写得更工整或修改后再次点击「插入」。",
    "글씨 그림이 너무 커요. 일부를 지우고 다시 넣어 주세요.": "手写图片过大。请擦除一部分后再次点击「插入」。",
    "지금은 손글씨를 읽을 수 없어요. 잠시 뒤 다시 넣어 주세요.": "目前无法识别手写内容。请稍后再次点击「插入」。",
    "읽는 시간이 너무 오래 걸렸어요. 다시 넣어 주세요.": "识别时间过长。请再次点击「插入」。",
    "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 넣어 주세요.": "无法连接服务器。请检查网络后再次点击「插入」。",
    "서버가 글씨를 처리하지 못했어요. 다시 넣어 주세요.": "服务器未能处理手写内容。请再次点击「插入」。",
    "읽은 글자를 입력창에 넣었어요. 확인한 뒤 보내 주세요.": "识别出的文字已放入输入框。请确认后再发送。",
  },
};
let uiLang = "ko";
const langListeners = [];
// 문구 하나를 지금 언어로 바꾼다. {이름} 자리는 values로 채우며, 채운 값은 다시 해석하지 않는다.
function t(source, values) {
  const table = uiText[uiLang];
  const text = table && Object.hasOwn(table, source) ? table[source] : source;
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
// 알림 줄처럼 나중에 다시 그릴 문구는 [원문, 값] 짝으로 넘길 수 있다. 채울 값까지 번역해야 하면 함수로 넘긴다.
function tr(message) {
  if (typeof message === "function") return message();
  return Array.isArray(message) ? t(message[0], message[1]) : t(message);
}
function onLangChange(listener) {
  langListeners.push(listener);
}

// 교내 주요 사이트 퀵링크 캐러셀(quick-link carousel, #122). 로그인·메인 바닥이 이 목록 하나로 같은 카드를 그린다.
// 주소는 운영자가 2026-11-17 학교 누리집에서 확인했다. 이름과 설명은 한국어 원문이 사전 열쇠다.
// external은 학교 공식 사이트가 아니라는 표시다. 사이드바의 작은 링크 세 개는 index.html에 그대로 있다.
const quickLinks = [
  { name: "학교 홈페이지", description: "공지와 학교 소식", href: "https://www.kumoh.ac.kr/ko/index.do", icon: "home" },
  { name: "포털(Onekit)", description: "수강신청·성적·학적", href: "https://onekit.kumoh.ac.kr/", icon: "portal" },
  { name: "BISKIT", description: "비교과·마일리지", href: "https://biskit.kumoh.ac.kr/", icon: "badge" },
  { name: "학습관리시스템(LMS)", description: "강의 자료와 과제", href: "https://lms.kumoh.ac.kr/", icon: "lms" },
  { name: "도서관", description: "자료 검색·열람실", href: "https://library.kumoh.ac.kr/", icon: "library" },
  { name: "생활관(기숙사)", description: "입사 신청과 생활 안내", href: "https://dorm.kumoh.ac.kr/", icon: "dorm" },
  { name: "학사일정", description: "학기 주요 날짜", href: "https://www.kumoh.ac.kr/ko/schedule.do", icon: "calendar" },
  { name: "식당 메뉴", description: "오늘의 학식", href: "https://www.kumoh.ac.kr/ko/restaurant02.do", icon: "meal" },
  { name: "웹메일", description: "학교 메일", href: "https://mail.kumoh.ac.kr/", icon: "mail" },
  { name: "학생상담센터", description: "심리·진로 상담", href: "https://consult.kumoh.ac.kr/", icon: "counsel" },
  { name: "국제교류·어학교육", description: "교환학생·한국어 과정", href: "https://iplec.kumoh.ac.kr/", icon: "globe" },
  { name: "교내 전화번호", description: "부서 연락처", href: "https://www.kumoh.ac.kr/ko/campusTel.do", icon: "phone" },
  { name: "에브리타임", description: "학생 커뮤니티·시간표", href: "https://everytime.kr/", icon: "community", external: true },
];
// 카드 아이콘. 24칸 위에 선으로만 그린다(채움 없음). 그림 파일을 받지 않는다.
const quickLinkIcons = {
  home: ["M3.5 11.5 12 4.5l8.5 7", "M6 10v9.5h12V10", "M10 19.5v-5h4v5"],
  portal: ["M4.5 4.5h6v6h-6Z", "M13.5 4.5h6v6h-6Z", "M4.5 13.5h6v6h-6Z", "M13.5 13.5h6v6h-6Z"],
  badge: ["M12 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z", "m9 13.8-1.5 6.7 4.5-2.5 4.5 2.5-1.5-6.7", "m10 9 1.4 1.4L14.2 7.6"],
  lms: ["M4 5h16v11H4Z", "M2.5 19.5h19", "m10.5 8.2 4 2.3-4 2.3Z"],
  library: ["M5 4.5h4v15H5Z", "M10.5 4.5h4v15h-4Z", "m15.8 5.6 3.4-.9 3 14-3.4.9Z"],
  dorm: ["M3.5 20h17", "M5.5 20V9l6.5-4.5L18.5 9v11", "M9 12.5h6", "M9 16h6"],
  calendar: ["M4.5 6h15v13.5h-15Z", "M4.5 10h15", "M8.5 3.5v4M15.5 3.5v4", "M8 14h3"],
  meal: ["M7 3.5v17", "M4.5 3.5v4.5a2.5 2.5 0 0 0 5 0V3.5", "M17.5 20.5v-17c-2.2 1.6-3.5 4.4-3.5 8v2h3.5"],
  mail: ["M3.5 6h17v12h-17Z", "m3.5 7 8.5 6 8.5-6"],
  counsel: ["M4 5h16v11H10l-4.5 3.5V16H4Z", "M12 13.2 9.8 11a1.5 1.5 0 0 1 2.2-2 1.5 1.5 0 0 1 2.2 2Z"],
  globe: ["M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z", "M3 12h18", "M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3Z"],
  phone: ["M6 3.5h3.2l1.6 4.3-2.2 1.4a10.5 10.5 0 0 0 6.2 6.2l1.4-2.2 4.3 1.6V18a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4 5.5a2 2 0 0 1 2-2Z"],
  community: ["M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Z", "M3 20a6 6 0 0 1 12 0", "M15.5 4.8a3.2 3.2 0 0 1 0 6", "M17.5 14.3A6 6 0 0 1 21 20"],
};
// 바닥마다 { root, track, prev, next } 하나. 화면 전환(showScreen)과 첫 화면 복귀가 이 목록을 다시 잰다.
const quickLinkCarousels = [];
// 언어를 바꾸면 다시 그릴 줄. 줄마다 마지막으로 넣은 원문과 그린 글을 기억한다.
// 다른 코드가 그 사이 글을 바꿨으면(그린 글과 다르면) 건드리지 않는다.
const spokenLines = new Map();
function say(node, message) {
  if (!node) return;
  const text = tr(message);
  node.textContent = text;
  spokenLines.set(node, { message, text });
}
function resay() {
  for (const [node, entry] of spokenLines) {
    if (node.textContent !== entry.text) { spokenLines.delete(node); continue; }
    entry.text = tr(entry.message);
    node.textContent = entry.text;
  }
}
function knownLang(value) {
  return typeof value === "string" && Object.hasOwn(langTags, value) ? value : null;
}
// 저장한 값이 있으면 그 값을, 처음 방문이면 브라우저 언어(en·zh로 시작)를 따른다.
// 저장소가 없거나 읽기에 실패하면, 그리고 알 수 없는 값이 저장돼 있으면 한국어다.
function detectLang(storage, language) {
  let saved;
  try {
    if (!storage) return "ko";
    saved = storage.getItem(langKey);
  } catch { return "ko"; }
  if (saved !== null && saved !== undefined) return knownLang(saved) ?? "ko";
  const tag = typeof language === "string" ? language.toLowerCase() : "";
  return tag.startsWith("en") ? "en" : tag.startsWith("zh") ? "zh" : "ko";
}

function limitChatMessages(messages, protectedQuestion) {
  if (messages.length <= 40) return messages;
  const kept = messages.slice();
  let index = 0;
  while (kept.length > 40) {
    const message = kept[index];
    const size = message.role === "question" && kept[index + 1]?.role === "answer" ? 2 : 1;
    if (message === protectedQuestion) index += size;
    else kept.splice(index, size);
  }
  const firstQuestion = kept.findIndex(message => message.role === "question");
  return firstQuestion < 0 ? [] : kept.slice(firstQuestion);
}
function limitCommittedChatMessages(record, committed, question) {
  record.messages = limitChatMessages(record.messages, question);
  const kept = new Set(record.messages);
  record.committedMessages = committed.filter(message => kept.has(message));
}
// 저장 객체는 허용한 텍스트 필드만 복사한다. DOM과 서버 세션은 저장하지 않는다.
function trimConversations(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(record => record && !record.photo && typeof record.id === "string" && Array.isArray(record.messages))
    .map(record => ({
      id: record.id, time: Number(record.time) || 0, unread: record.unread === true,
      // 보관은 true일 때만 인정한다. 없거나 깨진 값은 보관하지 않은 대화로 본다. 20개 한도는 보관 여부와 무관하다.
      archived: record.archived === true,
      title: conversationTitle(record),
      messages: limitChatMessages(trimMessages(record.messages)),
    })).filter(record => record.messages.length).sort((a, b) => b.time - a.time).slice(0, 20);
}
function cleanChatMessage(message) {
  if (!message || message.photo || !["question", "answer"].includes(message.role) ||
      typeof message.text !== "string" || /\b\d{8,10}\b/.test(message.text)) return null;
  return { role: message.role, text: message.text, time: Number(message.time) || 0,
    ...(message.role === "answer" && message.answered === false ? { answered: false } : {}),
    ...(message.role === "answer" && message.answered === false && message.guided === true ? { guided: true } : {}),
    sources: (Array.isArray(message.sources) ? message.sources : [])
      .filter(source => source && typeof source.title === "string" && isSafeSourceUrl(source.url))
      .map(source => ({ title: source.title, url: source.url })) };
}
function limitChatVersions(versions, selected) {
  while (versions.length > 5) {
    versions.splice(selected === 0 ? 1 : 0, 1);
    if (selected > 0) selected--;
  }
  return selected;
}
function trimMessages(messages) {
  const clean = [];
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role !== "question" || !Array.isArray(message.versions)) {
      const plain = cleanChatMessage(message);
      if (plain) clean.push(plain);
      continue;
    }
    if (messages[index + 1]?.role === "answer") index++;
    const versions = [];
    const selectedIndex = Number.isInteger(message.selected) ? message.selected : 0;
    let selected = 0;
    for (const [position, version] of message.versions.entries()) {
      const question = cleanChatMessage(version?.question);
      const answer = cleanChatMessage(version?.answer);
      if (question?.role !== "question" || (version.answer != null && answer?.role !== "answer")) continue;
      if (position <= selectedIndex) selected = versions.length;
      versions.push({ question, answer });
    }
    if (!versions.length || message.photo) continue;
    selected = limitChatVersions(versions, selected);
    const { question, answer } = versions[selected];
    clean.push({ ...question, versions, selected });
    if (answer) clean.push(answer);
  }
  return clean;
}
function conversationTitle(record) {
  const title = record.title || record.messages.find(message => message?.role === "question")?.text || "";
  if (typeof title !== "string" || /\b\d{8,10}\b/.test(title)) return "";
  return Array.from(title).slice(0, 29).join("");
}
function conversationKey(account) {
  return "kumoh-chat-history:v1:" + (/^demo-d0[234]$/.test(account) ? account : "browse");
}
function loadConversations(storage, account) {
  try { return trimConversations(JSON.parse(storage.getItem(conversationKey(account)) || "[]")); }
  catch { return []; }
}
function saveConversations(storage, account, records) {
  try { storage.setItem(conversationKey(account), JSON.stringify(trimConversations(records))); return true; }
  catch { return false; }
}
function deleteConversation(storage, account, id) {
  const records = loadConversations(storage, account).filter(record => record.id !== id);
  saveConversations(storage, account, records);
  return records;
}
function clearConversations(storage, account) {
  try { storage.removeItem(conversationKey(account)); } catch { /* 저장 불가 환경에서도 화면은 유지한다. */ }
  return [];
}
const transcript = document.querySelector("#transcript");
const empty = document.querySelector("#empty");
const composer = document.querySelector("#composer");
const input = document.querySelector("#question");
const send = document.querySelector("#send");
const reset = document.querySelector("#reset");
const statusLine = document.querySelector("#status");
// 테크모 펫. 자세와 상태는 펫 줄(#pet-dock)에, 한 줄 말과 대기 점은 말풍선에 붙인다.
const assistant = document.querySelector("#pet-dock");
const assistantLine = document.querySelector("#pet-line");
const assistantDots = document.querySelector("#pet-dots");
const pet = document.querySelector("#pet");
// 첫 화면의 버튼과 카드. 요청 중에는 함께 잠근다. 펫은 여기에 들지 않아 요청 중에도 눌린다.
const landingControls = [...(document.querySelectorAll?.("[data-action]") ?? [])];
const featureCards = [...(document.querySelectorAll?.("[data-feature]") ?? [])];
const featurePanels = [...(document.querySelectorAll?.("[data-panel]") ?? [])];
const featureList = document.querySelector("#feature-cards");
const photoFile = document.querySelector("#photo-file");
// 파일 입력은 화면에서 숨긴다. 입력창 왼쪽의 클립 버튼이 대신 파일 창을 열고 초점도 받는다.
const photoAttach = document.querySelector("#photo-attach");
const photoClear = document.querySelector("#photo-clear");
const photoNote = document.querySelector("#photo-note");

// 첨부 사진 제한. 서버도 같은 제한으로 다시 검사하므로, 여기서는 보내기 전에 알려 주는 역할만 한다.
const photoTypes = ["image/jpeg", "image/png"];
const photoMaxBytes = 5_000_000;
// 글자 주소(/photo-question)가 받는 판독문 길이 한도. 서버처럼 글자 수(코드 포인트)로 센다.
const recognizedMaxChars = 2_000;
const photoRejections = {
  413: "사진이 5MB를 넘어요. 더 작은 사진으로 다시 올려 주세요.",
  415: "JPEG나 PNG 사진만 읽을 수 있어요.",
  422: "사진을 열 수 없거나 화소 수가 1,200만을 넘어요. 다른 사진으로 다시 올려 주세요.",
};
const posterClues = { text: "사진 글자", qr_notice: "공지 QR", qr_program: "BISKIT 프로그램 QR" };
const photoNeedsCheck = {
  no_readable_clue: "사진에서 읽을 수 있는 글자나 QR을 찾지 못했어요. 글자가 또렷하게 보이게 다시 찍어 주세요.",
  ambiguous_event: "사진만으로는 어느 행사인지 하나로 정하지 못했어요. 제목과 날짜가 함께 보이거나 QR이 보이는 사진으로 다시 시도해 주세요.",
  text_reader_unavailable: "지금은 서버가 사진 속 글자를 읽을 수 없어요. QR이 보이는 사진으로 다시 시도하거나 글자를 직접 적어 주세요.",
};
const photoMessages = {
  reading: "사진에서 글자를 읽는 중…",
  asking: "읽은 글자로 답을 찾는 중…",
  disconnected: "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.",
  photoFailed: "서버가 사진을 처리하지 못했어요.",
  textFailed: "서버가 읽은 글자로 답을 만들지 못했어요.",
  textRejected: "서버가 이 글자를 받지 않았어요. 질문과 읽은 글자를 고친 뒤 다시 물어 주세요.",
  tooLong: "읽은 글자가 2,000자를 넘어요. 필요한 부분만 남기고 줄인 뒤 다시 물어 주세요.",
  nothingToAsk: "질문이나 읽은 글자를 적은 뒤 다시 물어 주세요.",
  nothingRead: "사진에서 읽은 글자가 없어요. 글자를 직접 적거나 질문을 함께 보내 주세요.",
  held: "근거가 충분하지 않아 답변을 보류했어요. 읽은 글자를 고치거나 질문을 더 구체적으로 적어 다시 물어 주세요.",
  noLink: "확인하지 못한 내용에는 링크를 붙이지 않아요. 학교 공지에서 직접 찾아 주세요.",
};
// 글자 주소가 답을 실어 보내는 종류. 행사(event)와 보류(hold)는 따로 그린다.
const textAnswerKinds = { regulation: "규정 검색", campus: "캠퍼스 안내" };
const posterStates = {
  open: { label: "신청 접수 중", className: "badge met" },
  closed: { label: "신청 마감", className: "badge short" },
  needs_check: { label: "신청 상태 확인 필요", className: "badge needs-check" },
};

// 서버가 보낸 status 값은 이 표에 있는 것만 인정하고, 나머지는 확인 필요로 보여 준다.
const graduationStatuses = {
  met: { label: "충족", className: "badge met" },
  short: { label: "부족", className: "badge short" },
  needs_check: { label: "확인 필요", className: "badge needs-check" },
};
const graduationColumns = ["항목", "상태", "현재 / 기준", "부족·확인할 점", "적용 근거"];

// 테크모 펫의 상태표. 상태마다 [자세, 한 줄 말]을 정한다. 자세 이름은 chat.css의 data-pose 규칙과 짝이다.
const assistantStates = {
  idle: ["guide", "궁금한 점을 물어보세요"],
  searching: ["quiet", "쉿, 찾아보는 중이에요…"],
  found: ["celebrate", "찾았어요! 함께 확인해 봐요"],
  answer: ["guide", "근거와 함께 안내해 드릴게요"],
  hold: ["quiet", "확인할 근거가 더 필요해요"],
  error: ["guide", "잠시 문제가 생겼어요. 다시 시도해 주세요"],
};
// 서버가 답변을 한 번에 보내므로, 축하를 이만큼 보여 준 뒤 답변 표시로 넘어간다.
const celebrateMs = 800;

let sessionId = null;
let busy = false;
let graduationTurn = null;
let assistantState = "idle";
// 말풍선에 마지막으로 넣은 원문. 아직 아무 상태도 그리지 않았으면 null이고 문서의 글을 그대로 본다.
let assistantSource = null;
let assistantTimer = null;
let techmoDropTimer = null;
let techmoDropCelebrating = false;
let techmoPosition = null;
const techmoBubbleTimers = new Map();
let techmoNarrow = null;
let openedCard = null;
let panelTransition = null;
let panelChange = 0;
const demoLogin = document.querySelector("#demo-login");
const demoStudents = document.querySelector("#demo-students");
const demoStudentList = document.querySelector("#demo-student-list");
const demoIdentity = document.querySelector("#demo-identity");
const demoLabel = document.querySelector("#demo-label");
const demoLogout = document.querySelector("#demo-logout");
const demoNotice = document.querySelector("#demo-notice");
const studentStorageKey = "demo-student-id";
let selectedStudent = null;
let studentGeneration = 0;
let studentsRequest = null;
const sidebar = document.querySelector("#conversation-sidebar");
const conversationList = document.querySelector("#conversation-list");
const drawerToggle = document.querySelector("#conversation-toggle");
const drawerBackdrop = document.querySelector("#conversation-backdrop");
const homeButton = document.querySelector("#home-button");
let conversations = [];
let activeConversation = null;
let homeNodes = null;
let chatView = false;
let requestedChatView = false;
let historyAccount = "browse";
let conversationSequence = 0;
let screenSequence = 0;
let toastTimer = null;
let toastRecord = null;
let drawerOpen = false;
let hiddenAnswers = 0;
// 대화 메뉴와 삭제 확인 창은 처음 열 때 한 번 만들어 다시 쓴다. 목록은 다시 그릴 때마다 노드를 새로 만들므로
// 초점을 돌려줄 자리는 노드 대신 대화 ID와 버튼 종류로 기억한다.
const longPressMs = 500;
const longPressSlop = 10;
let archiveOpen = false;
let archiveToggle = null;
// 확인 창·메뉴가 열린 채 화면을 옮기면 켠다. 전환을 적용하는 apply가 한 번 쓰고 끈다.
let focusInputAfterView = false;
let conversationNodes = new Map();
let conversationOrder = [];
let menu = null, menuItems = [], menuRecord = null, menuOrigin = null;
let pressTimer = null, pressStart = null, suppressOpenClick = false;
let confirmScrim = null, confirmBox = null, confirmTitle = null, confirmText = null;
let confirmDelete = null, confirmCancel = null, confirmRequest = null, confirmInert = [];
const originalTitle = document.title;
function runViewChange(update, { animate = true, current = () => true, cleanup = () => {}, ready = () => {} } = {}) {
  let applied = false;
  const apply = () => {
    if (applied || !current()) return;
    applied = true;
    update();
  };
  const finish = () => {
    apply();
    if (current()) cleanup();
  };
  if (!animate || reducedMotion() || typeof document.startViewTransition !== "function") {
    finish();
    return null;
  }
  try {
    const transition = document.startViewTransition(apply);
    Promise.resolve(transition.ready).then(() => { if (current()) ready(); }, finish).catch(finish);
    Promise.resolve(transition.updateCallbackDone).catch(finish);
    Promise.resolve(transition.finished).then(finish, finish);
    return transition;
  } catch {
    finish();
    return null;
  }
}
function historyStorage() {
  try { return window.localStorage; } catch { return null; }
}
function persistConversations() {
  saveConversations(historyStorage(), historyAccount, conversations.filter(record => !record.photo && record.saved)
    .map(record => ({ ...record, messages: record.committedMessages || record.messages })));
}
function switchHistoryAccount(account) {
  for (const record of conversations) record.chatAbort?.abort();
  dismissConversationToast();
  // 계정이 바뀌면 열린 필기 패드와 읽던 요청을 버린다. 첫 화면에서 로그아웃해도 이전 계정의 인식 글자가 남지 않는다(#134).
  if (typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  if (window.location?.hash === "#chat") {
    window.history?.replaceState(null, "", window.location.pathname + window.location.search);
  }
  historyAccount = account || "browse";
  conversations = loadConversations(historyStorage(), historyAccount)
    .map(record => ({ ...record, saved: true, committedMessages: record.messages.slice() }));
  activeConversation = null;
  archiveOpen = false;
  closeMenu(false);
  setChatView(false, false);
  renderConversations();
}
function closeDrawer(restoreFocus = true) {
  drawerOpen = false;
  document.body?.removeAttribute?.("data-conversation-drawer");
  drawerToggle?.setAttribute("aria-expanded", "false");
  if (drawerBackdrop) drawerBackdrop.hidden = true;
  for (const node of [composer, transcript, document.querySelector(".masthead"), assistant, document.querySelector("#conversation-toast")]) {
    if (node) node.inert = false;
  }
  updateSidebarAvailability();
  if (restoreFocus) drawerToggle?.focus();
}
function openDrawer() {
  if (window.matchMedia?.("(max-width: 960px)")?.matches === false) return;
  if (typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  drawerOpen = true;
  if (sidebar) sidebar.inert = false;
  if (sidebar) sidebar.hidden = false;
  if (drawerBackdrop) drawerBackdrop.hidden = false;
  document.body?.setAttribute("data-conversation-drawer", "open");
  drawerToggle?.setAttribute("aria-expanded", "true");
  for (const node of [composer, transcript, document.querySelector(".masthead"), assistant, document.querySelector("#conversation-toast")]) {
    if (node) node.inert = true;
  }
  document.querySelector("#new-conversation")?.focus();
}
function updateSidebarAvailability() {
  const narrow = window.matchMedia?.("(max-width: 960px)")?.matches;
  if (drawerOpen && narrow === false) closeDrawer(false);
  if (sidebar) sidebar.inert = !drawerOpen && Boolean(narrow);
}
function setChatView(next, push = true) {
  // 뒤로 가기 같은 화면 이동은 inert로 막을 수 없다. 떠 있는 확인 창과 메뉴를 취소로 닫는다.
  // 이 시점에는 서랍의 inert가 입력창 위에 남아 있어 초점을 보내도 실패한다. 초점은 apply 끝에서 보낸다.
  if (confirmRequest || menuRecord) focusInputAfterView = true;
  if (confirmRequest) closeConfirm(false, false);
  closeMenu(false);
  // 입력 줄 자리가 바뀌므로 열린 필기 패드는 닫는다(#134).
  if (next !== requestedChatView && typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  requestedChatView = next;
  const sequence = ++screenSequence;
  const changed = next !== chatView;
  if (next && !chatView) homeNodes = Array.from(transcript.children);
  const apply = () => {
    if (sequence !== screenSequence) return;
    const focusInList = Boolean(sidebar?.contains?.(document.activeElement));
    if (next && !chatView) {
      transcript.replaceChildren();
    } else if (!next && chatView) transcript.replaceChildren(...(homeNodes || [empty]));
    chatView = next;
    document.body?.setAttribute("data-view", next ? "chat" : "home");
    // 채팅 화면은 바닥을 숨긴다. 첫 화면으로 돌아오면 카드 줄을 다시 잰다.
    // 화면 테스트는 이 함수 묶음만 떼어 돌리므로, 캐러셀 코드가 없을 때도 멈추지 않게 typeof로 확인한다.
    if (!next && typeof measureQuickLinks === "function") measureQuickLinks();
    const welcome = document.querySelector(".main-welcome");
    if (welcome) welcome.hidden = next;
    if (sidebar) sidebar.hidden = !next;
    if (homeButton) homeButton.hidden = !next;
    if (drawerToggle) drawerToggle.hidden = !next;
    reset.hidden = next;
    if (next) renderActiveConversation();
    closeDrawer(false);
    updateSend();
    techmoBubble();
    // 화면 전환과 서랍 닫기로 inert가 모두 풀린 뒤에 초점을 옮긴다. 숨거나 inert가 된 목록에
    // 초점이 남은 경우도 같은 자리에서 두 화면 모두에 있는 입력창으로 보낸다.
    if (focusInputAfterView || (focusInList && !listVisible())) {
      focusInputAfterView = false;
      input.focus?.();
    }
  };
  document.body?.setAttribute("data-chat-direction", next ? "forward" : "back");
  if (push && window.history) {
    if (next && !chatView) window.history.pushState({ chat: true }, "", "#chat");
    else if (!next) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  runViewChange(apply, {
    animate: changed,
    current: () => sequence === screenSequence,
    cleanup: () => document.body?.removeAttribute?.("data-chat-direction"),
    ready: () => {
      for (const animation of document.getAnimations?.() || []) {
        const effect = animation.effect;
        if (effect?.pseudoElement !== "::view-transition-group(chat-composer)") continue;
        effect.setKeyframes(effect.getKeyframes().map(frame => {
          const safe = { offset: frame.offset, easing: frame.easing, composite: frame.composite };
          if (frame.transform !== undefined) safe.transform = frame.transform;
          if (frame.opacity !== undefined) safe.opacity = frame.opacity;
          return safe;
        }));
      }
    },
  });
}
function renderActiveConversation() {
  if (!chatView) return;
  transcript.replaceChildren(...(activeConversation?.turns || []));
  localizeReplyAuthors();
  for (const turn of activeConversation?.turns || []) turn.updateActions?.();
  scrollToLatest();
}
function openConversation(record) {
  if (!conversations.includes(record)) return;
  // 다른 대화로 옮기면 열린 필기 패드와 읽던 요청을 버린다. 인식 글자가 옮겨 간 대화의 질문 칸에 들어가지 않는다(#134).
  if (record !== activeConversation && typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  if (toastRecord === record) dismissConversationToast();
  activeConversation = record;
  record.unread = false;
  if (!record.turns) {
    record.turns = [];
    for (let index = 0; index < record.messages.length; index++) {
      const message = record.messages[index];
      const node = element("div", "turn");
      record.turns.push(node);
      if (message.role === "answer") {
        appendStoredMessage(node, message);
        continue;
      }
      const answer = record.messages[index + 1]?.role === "answer" ? record.messages[++index] : null;
      appendStoredTurn(node, message, answer);
      setupTurnActions(record, node, message, answer);
    }
  }
  persistConversations();
  setChatView(true);
  renderConversations();
}
function isArchived(record) {
  return record?.archived === true;
}
// 보관은 같은 객체의 archived만 바꾼다. 늦은 답은 conversations.includes(record)로 유효성을 보므로
// 배열에서 빼거나 객체를 새로 만들면 보관한 대화의 답과 알림이 사라진다.
function renderConversations() {
  if (!conversationList) return;
  conversationList.replaceChildren();
  conversationNodes = new Map();
  conversationOrder = [];
  archiveToggle = null;
  const sorted = [...conversations].sort((a, b) => b.time - a.time);
  const archived = sorted.filter(isArchived);
  for (const record of sorted) if (!isArchived(record)) conversationList.append(conversationItem(record, true));
  if (!archived.length) return;
  const group = element("li", "conversation-archive");
  const toggle = element("button", "conversation-archive-toggle", t("보관함 ({count})", { count: archived.length }));
  const list = element("ul", "conversation-archive-list");
  toggle.type = "button";
  list.id = "conversation-archive-list";
  list.hidden = !archiveOpen;
  toggle.setAttribute("aria-expanded", String(archiveOpen));
  toggle.setAttribute("aria-controls", list.id);
  if (!archiveOpen && archived.some(record => record.unread)) {
    const dot = element("span", "conversation-unread");
    dot.append(element("span", "sr-only", t("아이오의 읽지 않은 답변 있음")));
    toggle.append(dot);
  }
  toggle.addEventListener("click", () => {
    archiveOpen = !archiveOpen;
    renderConversations();
    archiveToggle?.focus();
  });
  archiveToggle = toggle;
  for (const record of archived) list.append(conversationItem(record, archiveOpen));
  group.append(toggle, list);
  conversationList.append(group);
}
function conversationItem(record, visible) {
  const item = element("li", "conversation-item");
  item.setAttribute("data-conversation-id", record.id);
  if (record === activeConversation) item.setAttribute("aria-current", "true");
  const open = element("button", "conversation-open");
  open.type = "button";
  const title = conversationTitle(record) || t("새 대화");
  const chars = Array.from(title);
  const date = new Date(record.time);
  const today = date.toDateString() === new Date().toDateString();
  const locale = { ko: "ko-KR", en: "en-US", zh: "zh-CN" }[uiLang];
  open.append(element("span", "conversation-title", chars.slice(0, 28).join("") + (chars.length > 28 ? "…" : "")),
    element("span", "conversation-time", today ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false }) : `${date.getMonth() + 1}/${date.getDate()}`));
  // 길게 눌러 메뉴를 연 뒤 손을 떼면 클릭이 한 번 따라온다. 그 클릭은 대화를 열지 않는다.
  open.addEventListener("click", () => {
    if (suppressOpenClick) { suppressOpenClick = false; return; }
    openConversation(record);
  });
  open.addEventListener("pointerdown", event => startPress(event, record));
  open.addEventListener("pointermove", movePress);
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) open.addEventListener(type, cancelPress);
  if (record.pending) {
    item.setAttribute("data-conversation-state", "pending");
    const pending = element("span", "conversation-pending");
    pending.append(element("span", "sr-only", t("아이오의 답변 기다리는 중")));
    open.append(pending);
  }
  if (record.unread) {
    const dot = element("span", "conversation-unread");
    dot.append(element("span", "sr-only", t("아이오의 읽지 않은 답변")));
    open.append(dot);
  }
  const more = element("button", "conversation-more");
  const icon = element("span", "conversation-more-icon");
  icon.setAttribute("aria-hidden", "true");
  more.append(icon);
  more.type = "button";
  more.setAttribute("aria-label", t("대화 메뉴"));
  more.setAttribute("aria-haspopup", "menu");
  more.setAttribute("aria-controls", "conversation-menu");
  more.setAttribute("aria-expanded", String(menuRecord === record));
  more.addEventListener("click", () => {
    if (menuRecord === record) closeMenu();
    else openMenu(record, "more", anchorPoint(more));
  });
  const part = target => within(more, target) ? "more" : "open";
  // 기본 우클릭 메뉴는 대화 항목 안에서만 막는다. 키보드로 연 contextmenu는 좌표가 0이라 버튼 아래에 띄운다.
  item.addEventListener("contextmenu", event => {
    event.preventDefault?.();
    // 손가락으로 누르는 중에 온 contextmenu는 길게 누르기와 같은 몸짓이라 뒤따르는 클릭을 막는다.
    const touching = Boolean(pressStart);
    cancelPress();
    if (menuRecord === record) return;
    const from = part(event.target);
    const point = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : anchorPoint(from === "more" ? more : open);
    openMenu(record, from, point);
    if (touching && menuRecord === record) suppressOpenClick = true;
  });
  item.addEventListener("keydown", event => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault?.();
    const from = part(event.target);
    openMenu(record, from, anchorPoint(from === "more" ? more : open));
  });
  if (visible) {
    conversationNodes.set(record.id, { open, more });
    conversationOrder.push(record.id);
  }
  item.append(open, more);
  return item;
}
function within(container, target) {
  return Boolean(container && target) && (container === target || Boolean(container.contains?.(target)));
}
function startPress(event, record) {
  suppressOpenClick = false;
  cancelPress();
  // 마우스는 우클릭이 있으므로 손가락과 펜의 첫 접촉만 센다.
  if (event.pointerType === "mouse" || event.isPrimary === false || typeof setTimeout !== "function") return;
  pressStart = { x: event.clientX || 0, y: event.clientY || 0 };
  pressTimer = setTimeout(() => {
    const point = pressStart;
    pressTimer = null; pressStart = null;
    openMenu(record, "open", point);
    if (menuRecord === record) suppressOpenClick = true;
  }, longPressMs);
}
function movePress(event) {
  if (!pressStart) return;
  if (Math.hypot((event.clientX || 0) - pressStart.x, (event.clientY || 0) - pressStart.y) > longPressSlop) cancelPress();
}
function cancelPress() {
  if (pressTimer !== null) clearTimeout(pressTimer);
  pressTimer = null;
  pressStart = null;
}
function anchorPoint(node) {
  const rect = node?.getBoundingClientRect?.();
  return rect ? { x: rect.left, y: rect.bottom + 4 } : { x: 0, y: 0 };
}
function conversationMenu() {
  if (menu) return menu;
  menu = element("div", "conversation-menu");
  menu.id = "conversation-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", t("대화 메뉴"));
  menuItems = [["archive", "보관하기"], ["delete", "삭제"]].map(([action, label]) => {
    const item = element("button", `conversation-menu-item${action === "delete" ? " danger" : ""}`, t(label));
    item.type = "button";
    item.tabIndex = -1;
    item.setAttribute("role", "menuitem");
    item.addEventListener("click", () => runMenu(action));
    return item;
  });
  menu.addEventListener("keydown", event => {
    const index = menuItems.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault?.();
      focusMenuItem(index < 0 ? 0 : index + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault?.();
      focusMenuItem(event.key === "Home" ? 0 : menuItems.length - 1);
    } else if (event.key === "Enter") {
      // 버튼 기본 동작의 클릭과 겹치지 않게 막고 한 번만 실행한다.
      event.preventDefault?.();
      if (index >= 0) runMenu(index === 0 ? "archive" : "delete");
    } else if (event.key === "Tab") {
      event.preventDefault?.();
      closeMenu();
    }
  });
  // 메뉴 키를 뗄 때 오는 contextmenu는 이미 메뉴로 옮긴 초점에 도착한다.
  menu.addEventListener("contextmenu", event => event.preventDefault?.());
  menu.append(...menuItems);
  document.body?.append(menu);
  return menu;
}
// 메뉴가 열린 채 언어를 바꿔도 같은 자리에서 이름만 고친다.
function labelConversationMenu() {
  if (!menu) return;
  menu.setAttribute("aria-label", t("대화 메뉴"));
  menuItems[0].textContent = t(isArchived(menuRecord) ? "보관 해제" : "보관하기");
  menuItems[1].textContent = t("삭제");
}
function focusMenuItem(index) {
  const count = menuItems.length;
  menuItems[((index % count) + count) % count]?.focus();
}
function openMenu(record, part, point) {
  if (!conversations.includes(record) || confirmRequest) return;
  closeMenu(false);
  const node = conversationMenu();
  menuRecord = record;
  menuOrigin = { id: record.id, part };
  labelConversationMenu();
  node.hidden = false;
  placeMenu(point);
  conversationNodes.get(record.id)?.more?.setAttribute("aria-expanded", "true");
  focusMenuItem(0);
}
// 누른 자리나 버튼 아래에 두되 화면 가장자리 8px 안으로 민다. 좌표는 CSS 변수로만 넘긴다.
function placeMenu(point) {
  const rect = menu.getBoundingClientRect?.() || { width: 0, height: 0 };
  const fit = (value, size, limit) => limit > 0 ? Math.max(8, Math.min(value, limit - size - 8)) : value;
  const x = fit(point.x, rect.width, window.innerWidth || 0);
  const y = fit(point.y, rect.height, window.innerHeight || 0);
  menu.style?.setProperty("--conversation-menu-x", `${Math.round(x)}px`);
  menu.style?.setProperty("--conversation-menu-y", `${Math.round(y)}px`);
}
function closeMenu(restore = true, options) {
  suppressOpenClick = false;
  if (!menuRecord) return;
  const origin = menuOrigin;
  conversationNodes.get(menuRecord.id)?.more?.setAttribute("aria-expanded", "false");
  menuRecord = null;
  menuOrigin = null;
  if (menu) menu.hidden = true;
  if (restore) focusConversation(origin, null, options);
}
// 다시 그린 목록에서 대화 ID로 버튼을 찾는다. 없으면 목록의 다음 항목, 그것도 없으면 새 대화 버튼으로 간다.
function focusConversation(origin, nextId, options) {
  if (!listVisible()) { input.focus?.(options); return; }
  const nodes = origin && conversationNodes.get(origin.id);
  const target = nodes?.[origin.part] || (nextId && conversationNodes.get(nextId)?.open) ||
    document.querySelector("#new-conversation");
  target?.focus?.(options);
}
// 목록이 숨었거나(홈 화면) 닫힌 서랍이라 inert이면 목록 버튼은 초점을 받지 못한다.
function listVisible() {
  return !sidebar?.hidden && !sidebar?.inert;
}
function nextConversationId(id) {
  const index = conversationOrder.indexOf(id);
  return index < 0 ? null : conversationOrder[index + 1] ?? null;
}
function runMenu(action) {
  const record = menuRecord, origin = menuOrigin;
  if (!record) return;
  const next = nextConversationId(record.id);
  closeMenu(false);
  if (!conversations.includes(record)) { focusConversation(origin, next); return; }
  if (action === "delete") { askDelete(record, origin); return; }
  const archiving = !isArchived(record);
  record.archived = archiving;
  persistConversations();
  // 보던 대화를 보관하면 새 대화 화면으로 넘어가고 초점은 입력창이 받는다.
  if (archiving && activeConversation === record) { startNewConversation(); return; }
  renderConversations();
  focusConversation(origin, next);
}
function askDelete(record, origin) {
  const title = Array.from(conversationTitle(record)).slice(0, 20).join("");
  const next = nextConversationId(record.id);
  // 제목과 설명은 함수로 넘겨 창이 열린 채 언어가 바뀌어도 다시 그린다.
  openConfirm({
    title: () => t("정말로 삭제하시겠습니까?"),
    text: () => t("‘{title}’ 대화를 지우면 되돌릴 수 없어요.", { title: title || t("새 대화") }),
    run: () => removeConversation(record),
    restore: () => focusConversation(origin, next),
  });
}
// 기다리던 요청이 있으면 그 요청의 유효성 검사가 늦은 답을 버린다.
function removeConversation(record) {
  // 답을 만들던 대화를 지우면 그 요청도 끊는다. 결과는 어차피 버려지므로 연결만 일찍 닫는다(#137).
  record?.chatAbort?.abort();
  conversations = conversations.filter(value => value !== record);
  if (toastRecord === record) dismissConversationToast();
  if (activeConversation === record) {
    // 보고 있던 대화를 지우면 그 대화에서 쓰던 필기 패드도 버린다(#134).
    if (typeof closeHandwritingPad === "function") closeHandwritingPad(false);
    activeConversation = null; renderActiveConversation();
  }
  persistConversations(); renderConversations(); updateSend();
}
function confirmDialog() {
  if (confirmScrim) return;
  confirmScrim = element("div", "confirm-scrim");
  confirmScrim.hidden = true;
  confirmBox = element("div", "confirm-box");
  confirmBox.setAttribute("role", "alertdialog");
  confirmBox.setAttribute("aria-modal", "true");
  confirmTitle = element("h2", "confirm-title");
  confirmTitle.id = "confirm-title";
  confirmText = element("p", "confirm-text");
  confirmText.id = "confirm-text";
  confirmBox.setAttribute("aria-labelledby", confirmTitle.id);
  confirmBox.setAttribute("aria-describedby", confirmText.id);
  const actions = element("div", "confirm-actions");
  confirmDelete = element("button", "confirm-delete", t("삭제"));
  confirmCancel = element("button", "confirm-cancel", t("취소"));
  for (const button of [confirmDelete, confirmCancel]) button.type = "button";
  confirmDelete.addEventListener("click", () => closeConfirm(true));
  confirmCancel.addEventListener("click", () => closeConfirm(false));
  // 버튼이 둘뿐이므로 Tab과 Shift+Tab 모두 창 안의 다른 버튼으로 옮긴다.
  confirmBox.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    event.preventDefault?.();
    const buttons = [confirmDelete, confirmCancel];
    const index = buttons.indexOf(document.activeElement);
    const step = event.shiftKey ? -1 : 1;
    buttons[index < 0 ? (event.shiftKey ? 1 : 0) : (index + step + buttons.length) % buttons.length].focus();
  });
  confirmScrim.addEventListener("click", event => { if (event.target === confirmScrim) closeConfirm(false); });
  actions.append(confirmDelete, confirmCancel);
  confirmBox.append(confirmTitle, confirmText, actions);
  confirmScrim.append(confirmBox);
  document.body?.append(confirmScrim);
}
// 확인 창이 열린 동안 뒤쪽은 inert로 막는다. 닫을 때는 서랍이 걸어 둔 값까지 원래대로 되돌린다.
function openConfirm(request) {
  if (confirmRequest) return;
  closeMenu(false);
  confirmDialog();
  confirmRequest = request;
  labelConfirm();
  confirmInert = [...(document.body?.children || [])].filter(node => node !== confirmScrim)
    .map(node => [node, node.inert]);
  for (const [node] of confirmInert) node.inert = true;
  confirmScrim.hidden = false;
  confirmCancel.focus();
}
function labelConfirm() {
  if (!confirmRequest) return;
  const text = value => typeof value === "function" ? value() : value;
  confirmTitle.textContent = text(confirmRequest.title);
  confirmText.textContent = text(confirmRequest.text);
  confirmDelete.textContent = t("삭제");
  confirmCancel.textContent = t("취소");
}
function closeConfirm(accepted, restore = true) {
  const request = confirmRequest;
  if (!request) return;
  confirmRequest = null;
  confirmScrim.hidden = true;
  for (const [node, value] of confirmInert) node.inert = value;
  confirmInert = [];
  if (accepted) request.run();
  if (restore) request.restore();
}
function notifyConversation(record) {
  record.unread = true;
  showAssistant("answer", "답변이 도착했어요");
  const toast = document.querySelector("#conversation-toast");
  const open = document.querySelector("#conversation-toast-open");
  const line = toastLine(record);
  const announce = document.querySelector("#conversation-announce");
  if (announce) announce.textContent = line;
  if (toast && open) {
    toastRecord = record;
    toast.hidden = false;
    open.textContent = line;
    open.onclick = () => { dismissConversationToast(); openConversation(record); };
    if (toastTimer !== null) clearTimeout(toastTimer);
    if (typeof setTimeout === "function") toastTimer = setTimeout(() => { toast.hidden = true; toastTimer = null; }, 6000);
  }
  if (document.hidden) { hiddenAnswers++; showTitle(); }
}
function toastLine(record) {
  return t("‘{title}’ 대화에 아이오의 답변이 왔어요", { title: Array.from(conversationTitle(record)).slice(0, 20).join("") });
}
// 탭 제목. 한국어는 문서에 적힌 제목을 그대로 쓴다. 숨은 탭에 온 답 수는 앞에 붙인다.
function showTitle() {
  const base = uiLang === "ko" ? originalTitle : t(originalTitle);
  document.title = hiddenAnswers ? `(${hiddenAnswers}) ${base}` : base;
}
function dismissConversationToast() {
  const toast = document.querySelector("#conversation-toast");
  if (toast) toast.hidden = true;
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = null;
  toastRecord = null;
}
drawerToggle?.addEventListener("click", openDrawer);
drawerBackdrop?.addEventListener("click", () => closeDrawer());
document.querySelector("#conversation-close")?.addEventListener("click", () => closeDrawer());
homeButton?.addEventListener("click", () => setChatView(false));
document.querySelector(".brand")?.addEventListener("click", () => setChatView(false));
function startNewConversation() {
  if (typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  activeConversation = null;
  input.value = "";
  photoFile.value = "";
  photoNote.textContent = "";
  statusLine.textContent = "";
  setChatView(true); renderConversations(); input.focus();
}
document.querySelector("#new-conversation")?.addEventListener("click", startNewConversation);
const clearButton = document.querySelector("#clear-conversations");
clearButton?.addEventListener("click", () => openConfirm({
  title: () => t("대화 기록을 모두 삭제하시겠습니까?"),
  text: () => t("보관함을 포함한 대화 {count}개가 지워지고 되돌릴 수 없어요.", { count: conversations.length }),
  run: () => {
    clearConversations(historyStorage(), historyAccount);
    dismissConversationToast();
    if (typeof closeHandwritingPad === "function") closeHandwritingPad(false);
    for (const record of conversations) record.chatAbort?.abort();
    conversations = []; activeConversation = null; renderConversations(); renderActiveConversation(); updateSend();
  },
  restore: () => (listVisible() ? clearButton : input).focus(),
}));
// Esc는 확인 창 → 메뉴 → 서랍 순으로 맨 위의 하나만 닫는다.
document.addEventListener?.("keydown", event => {
  if (event.key !== "Escape") return;
  if (activeChoiceMenu) { event.preventDefault?.(); event.stopPropagation?.(); activeChoiceMenu.close(true); return; }
  if (confirmRequest) { event.preventDefault?.(); closeConfirm(false); }
  else if (menuRecord) { event.preventDefault?.(); closeMenu(); }
  else if (drawerOpen) closeDrawer();
});
// 메뉴 밖을 누르면 닫는다. 메뉴를 연 점 세 개 버튼은 자기 클릭으로 닫으므로 여기서 건너뛴다.
document.addEventListener?.("pointerdown", event => {
  if (!menuRecord || within(menu, event.target)) return;
  if (within(conversationNodes.get(menuRecord.id)?.more, event.target)) return;
  closeMenu();
}, true);
// 어느 칸이든 스크롤하면 길게 누르기를 취소하고, 메뉴는 위치가 어긋나므로 닫는다.
document.addEventListener?.("scroll", () => {
  cancelPress();
  if (menuRecord) closeMenu(true, { preventScroll: true });
}, true);
document.addEventListener?.("visibilitychange", () => {
  if (!document.hidden) { hiddenAnswers = 0; showTitle(); }
});
window.addEventListener?.("popstate", () => setChatView(window.location.hash === "#chat", false));
window.addEventListener?.("resize", updateSidebarAvailability);
document.querySelector("#conversation-toast-close")?.addEventListener("click", dismissConversationToast);

function storedStudentId() {
  try { return window.sessionStorage?.getItem(studentStorageKey); } catch { return null; }
}

function rememberStudent(id) {
  try {
    if (id) window.sessionStorage?.setItem(studentStorageKey, id);
    else window.sessionStorage?.removeItem(studentStorageKey);
  } catch { /* 저장 공간을 쓸 수 없어도 현재 탭에서는 선택을 유지한다. */ }
}

const loginScreen = document.querySelector("#login-screen");
const mainScreen = document.querySelector("#main-screen");
const loginForm = document.querySelector("#login-form");
const studentNumber = document.querySelector("#student-number");
const studentPassword = document.querySelector("#student-password");
const loginError = document.querySelector("#login-error");
const loginPet = document.querySelector("#login-pet");
const loginPetLine = document.querySelector("#login-pet-line");
const mainGreeting = document.querySelector("#main-greeting");
const demoAccounts = {
  "20990002": "demo-d02-pass",
  "20990003": "demo-d03-pass",
  "20990004": "demo-d04-pass",
};
function loginMessage(line, pose = "guide") {
  say(loginPetLine, line);
  loginPet?.setAttribute("data-pose", pose);
  applyTechmoMotion(loginPet, pose);
  setTechmoBubbleVisibility(loginPet, true);
}
function showScreen(main) {
  if (!main && typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  if (loginScreen) loginScreen.hidden = main;
  if (mainScreen) mainScreen.hidden = !main;
  document.body?.setAttribute("data-screen", main ? "main" : "login");
  // 숨어 있던 바닥은 폭이 0이라 판정을 미뤄 두었다. 보이는 바닥의 카드 줄을 다시 잰다.
  if (typeof measureQuickLinks === "function") measureQuickLinks();
  if (main) {
    restoreTechmoPosition();
    techmoBubble();
  }
}
function closeStudents() {
  studentGeneration++;
  if (demoStudents) demoStudents.hidden = true;
  demoNotice.textContent = "";
  demoLogin.setAttribute("aria-expanded", "false");
}
function selectStudent(student, { restored = false } = {}) {
  studentGeneration++;
  selectedStudent = student;
  switchHistoryAccount(student.id);
  rememberStudent(student.id);
  demoLabel.textContent = student.label;
  demoLogin.hidden = true;
  demoIdentity.hidden = false;
  say(mainGreeting, ["안녕하세요, {label} 님", { label: student.label }]);
  if (restored) showScreen(true);
  else {
    const generation = studentGeneration;
    const entered = ["{label} 이수 내역으로 들어왔어요", { label: student.label }];
    loginMessage(entered, "celebrate");
    celebrate("idle", entered, () => {
      if (generation !== studentGeneration || selectedStudent !== student) return;
      let applied = false;
      const apply = () => {
        if (generation !== studentGeneration || applied) return;
        applied = true;
        showScreen(true);
        demoLogout.focus();
      };
      if (!reducedMotion() && typeof document.startViewTransition === "function") {
        try {
          const transition = document.startViewTransition(apply);
          Promise.resolve(transition.ready).catch(apply);
          Promise.resolve(transition.updateCallbackDone).catch(apply);
          Promise.resolve(transition.finished).then(apply, apply);
        } catch { apply(); }
      } else apply();
    }, 650);
  }
}
function leaveStudent() {
  studentGeneration++;
  selectedStudent = null;
  switchHistoryAccount("browse");
  rememberStudent(null);
  graduationTurn?.remove();
  graduationTurn = null;
  if (!transcript.children.length) {
    changeFeature(null, { animate: false, focus: false });
    transcript.append(empty);
  }
  demoIdentity.hidden = true;
  demoLogin.hidden = false;
  demoLabel.textContent = "";
  if (studentNumber) studentNumber.value = "";
  if (studentPassword) studentPassword.value = "";
  showAssistant("idle");
  loginMessage("학번으로 들어와 보세요!");
  showScreen(false);
}
function validStudent(student) {
  return student && /^demo-d0[234]$/.test(student.id) && typeof student.label === "string" &&
    typeof student.scenario === "string" && student.is_fictional === true;
}
async function loadStudents() {
  if (!studentsRequest) studentsRequest = (async () => {
    const response = await fetch("/api/v1/demo-students", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Students request failed");
    const result = await response.json();
    if (!Array.isArray(result?.students) || result.students.some(student => !validStudent(student))) throw new Error("Malformed students");
    return result.students;
  })();
  try { return await studentsRequest; } finally { studentsRequest = null; }
}
function openStudents(message = "") {
  studentGeneration++;
  showAssistant("idle");
  showScreen(false);
  say(loginError, message);
  loginMessage("학번으로 들어와 보세요!");
  studentNumber?.focus();
}
demoLogin.addEventListener("click", () => openStudents());
demoLogout.addEventListener("click", leaveStudent);
for (const account of document.querySelectorAll?.("[data-demo-account]") ?? []) {
  account.addEventListener("click", () => {
    studentGeneration++;
    showAssistant("idle");
    const number = account.dataset.demoAccount;
    if (!Object.hasOwn(demoAccounts, number)) return;
    studentNumber.value = number;
    studentPassword.value = demoAccounts[number];
    if (loginError) loginError.textContent = "";
    loginMessage("좋아요, 로그인을 눌러 보세요");
    studentNumber.focus();
  });
}
loginForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const generation = ++studentGeneration;
  showAssistant("idle");
  if (loginError) loginError.textContent = "";
  if (!Object.hasOwn(demoAccounts, studentNumber.value)) {
    say(loginError, "학번 또는 비밀번호가 맞지 않아요");
    loginMessage("쉿, 시연 계정으로만 들어올 수 있어요", "quiet");
    return;
  }
  loginMessage("학번을 확인하고 있어요");
  try {
    const response = await fetch("/api/v1/demo-login", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ student_number: studentNumber.value, password: studentPassword.value }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (generation !== studentGeneration) return;
    if (response.status !== 200 || !validStudent(result?.student)) {
      say(loginError, response.status === 401 ? "학번 또는 비밀번호가 맞지 않아요" : "로그인하지 못했어요. 다시 시도해 주세요.");
      loginMessage("쉿, 시연 계정으로만 들어올 수 있어요", "quiet");
      return;
    }
    selectStudent(result.student);
  } catch {
    if (generation !== studentGeneration) return;
    say(loginError, "서버에 연결하지 못했어요. 다시 시도해 주세요.");
    loginMessage("쉿, 시연 계정으로만 들어올 수 있어요", "quiet");
  }
});
document.querySelector("#browse-main")?.addEventListener("click", () => {
  leaveStudent();
  showScreen(true);
  if (mainGreeting) mainGreeting.textContent = "";
});
// 화면 언어는 첫 문구를 그리기 전에 정한다. 한국어면 화면을 건드리지 않는다.
uiLang = detectLang(historyStorage(), window.navigator?.language);
showScreen(false);
async function restoreStudent() {
  const id = storedStudentId();
  if (!id) return;
  const generation = studentGeneration;
  try {
    const students = await loadStudents();
    if (generation !== studentGeneration) return;
    const student = students.find(item => item.id === id);
    if (student) selectStudent(student, { restored: true });
    else rememberStudent(null);
  } catch {
    if (generation === studentGeneration) {
      say(demoNotice, "가상 학생을 복원하지 못했어요. 다시 로그인해 주세요.");
      say(loginError, "가상 학생을 복원하지 못했어요. 다시 로그인해 주세요.");
    }
  }
}

function motionPreference() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)");
}

function reducedMotion() {
  return motionPreference()?.matches === true;
}

motionPreference()?.addEventListener?.("change", event => {
  if (event.matches) panelTransition?.skipTransition?.();
});

// 이전 전환의 늦은 콜백이 새 조작을 되돌리지 않게 순서를 확인한다.
function changeFeature(card, { animate = true, focus = true } = {}) {
  const previous = openedCard;
  const panel = featurePanels.find(node => node.dataset.panel === card?.dataset.feature);
  if (card && (!panel || !featureList)) return;
  if (!selectedStudent && ["graduation", "biskit"].includes(card?.dataset.feature)) { openStudents("이 기능은 시연 계정으로 로그인한 뒤 쓸 수 있어요"); return; }
  if (animate && card === openedCard) return;
  openedCard = card;
  const change = ++panelChange;
  panelTransition?.skipTransition?.();
  panelTransition = null;
  for (const node of featureCards) node.removeAttribute("data-morph");
  const source = card ?? previous;
  if (document.body) document.body.dataset.featureDirection = card ? "open" : "back";
  let applied = false;
  const apply = () => {
    if (change !== panelChange || applied) return;
    applied = true;
    if (featureList) featureList.hidden = Boolean(card);
    for (const node of featurePanels) node.hidden = node !== panel;
    for (const node of featureCards) node.setAttribute("aria-expanded", String(node === card));
    if (!card) previous?.setAttribute("data-restored", "");
    if (["calendar", "campus"].includes(card?.dataset.feature)) void loadFeaturePanel(panel, change);
    if (focus) {
      const target = card ? panel.querySelector("[data-panel-title]") : previous;
      target?.focus();
    }
  };
  if (animate) source?.setAttribute("data-morph", "");
  panelTransition = runViewChange(apply, {
    animate,
    current: () => change === panelChange,
    cleanup: () => {
      source?.removeAttribute("data-morph");
      if (document.body) delete document.body.dataset.featureDirection;
      panelTransition = null;
    },
  });
}

for (const card of featureCards) {
  for (const type of ["pointerleave", "pointerdown", "keydown"]) {
    card.addEventListener(type, () => card.removeAttribute("data-restored"));
  }
  card.addEventListener("click", () => changeFeature(card));
}
for (const panel of featurePanels) {
  panel.querySelector("[data-panel-close]")?.addEventListener("click", () => changeFeature(null));
  panel.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    changeFeature(null);
  });
}

// 칸 배치는 서버가 전달한 값만 쓰고, 실제 그림 크기가 맞아야 새 재생을 켠다.
function parseTechmoLayout(value) {
  try {
    const layout = JSON.parse(value);
    if (layout.version !== 1 || !Number.isSafeInteger(layout.cell) || layout.cell <= 0 ||
        !Number.isSafeInteger(layout.columns) || layout.columns <= 1 ||
        !Array.isArray(layout.motions) || layout.motions.length <= 1) return null;
    const names = new Set();
    for (const motion of layout.motions) {
      if (typeof motion.name !== "string" || names.has(motion.name) ||
          !Number.isSafeInteger(motion.frames) || motion.frames < 1 || motion.frames > layout.columns) return null;
      names.add(motion.name);
    }
    if (!["idle", "guide", "celebrate", "quiet", "drag"].every(name => names.has(name))) return null;
    return layout;
  } catch { return null; }
}

function applyTechmoMotion(target, name) {
  const layout = parseTechmoLayout(assistant.dataset?.techmoLayout);
  if (!target || !layout) return;
  const row = layout.motions.findIndex(motion => motion.name === name);
  if (row < 0) return;
  const motion = layout.motions[row];
  const timing = { idle: ["1.6s", "infinite"], guide: ["0.9s", "1"],
    celebrate: ["0.8s", "1"], quiet: ["2.4s", "infinite"], drag: ["0.5s", "infinite"] };
  target.setAttribute("data-motion", name);
  target.style?.setProperty("--techmo-sheet-width", `${layout.columns * 100}%`);
  target.style?.setProperty("--techmo-sheet-height", `${layout.motions.length * 100}%`);
  target.style?.setProperty("--techmo-row", `${row / (layout.motions.length - 1) * 100}%`);
  target.style?.setProperty("--techmo-frames", String(motion.frames));
  target.style?.setProperty("--techmo-end-x", `${motion.frames / (layout.columns - 1) * 100}%`);
  target.style?.setProperty("--techmo-duration", timing[name][0]);
  target.style?.setProperty("--techmo-iterations", timing[name][1]);
}

function updateTechmoMotion() {
  const motions = { idle: "idle", searching: "quiet", hold: "quiet", found: "celebrate", answer: "guide", error: "guide" };
  const motion = techmoDropCelebrating ? "celebrate" : motions[assistantState];
  applyTechmoMotion(assistant, assistant.dataset?.dragging === "true" ? "drag" : motion);
}

function celebrateTechmoDrop() {
  if (techmoDropTimer !== null) clearTimeout(techmoDropTimer);
  techmoDropCelebrating = true;
  updateTechmoMotion();
  techmoDropTimer = setTimeout(() => {
    techmoDropTimer = null;
    techmoDropCelebrating = false;
    updateTechmoMotion();
  }, celebrateMs);
}

function configureTechmoSprite(slot, image) {
  if (!image?.getAttribute?.("src")?.endsWith("/techmo-sprite.png")) return;
  const layout = parseTechmoLayout(assistant.dataset?.techmoLayout);
  const animated = layout && image.naturalWidth === layout.columns * layout.cell &&
    image.naturalHeight === layout.motions.length * layout.cell;
  const target = slot === pet ? assistant : loginPet;
  target?.setAttribute("data-sprite-layout", animated ? "animated" : "legacy");
  if (target === assistant) updateTechmoMotion();
  else applyTechmoMotion(target, target?.dataset?.pose || "guide");
}

// 상태가 바뀌면 앞서 예약한 답변 전환을 취소하고 말·점·동작을 함께 갱신한다.
function showAssistant(state, message) {
  if (assistantTimer !== null) {
    clearTimeout(assistantTimer);
    assistantTimer = null;
  }
  const [pose, line] = assistantStates[state];
  assistantState = state;
  // 같은 자세면 속성 값이 그대로라 눌렸다 튀는 움직임이 다시 돌지 않는다.
  assistant.setAttribute("data-pose", pose);
  // 상태 이름은 쉬는 자세를 평소와 답변 표시에서만 돌리려고 chat.css가 읽는다. 타이머는 쓰지 않는다.
  assistant.setAttribute("data-state", state);
  // 말풍선 줄은 원문으로 기억해 두어 언어를 바꾸면 같은 말을 새 언어로 다시 쓴다.
  assistantSource = message ?? line;
  say(assistantLine, assistantSource);
  setTechmoBubbleVisibility(assistant, assistantSource !== assistantStates.idle[1]);
  assistantDots.hidden = state !== "searching";
  updateTechmoMotion();
  if (assistant.dataset?.dragging !== "true") techmoBubble();
}

// 찾음: 축하를 잠깐 보여 준 뒤 답변 표시로 넘어간다. 타이머가 없는 환경에서는 바로 넘어간다.
function celebrate(nextState = "answer", message, after, delay = celebrateMs) {
  showAssistant("found", message);
  if (typeof setTimeout !== "function") {
    showAssistant(nextState);
    after?.();
    return;
  }
  assistantTimer = setTimeout(() => {
    assistantTimer = null;
    showAssistant(nextState);
    after?.();
  }, delay);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// 보내기 버튼과 첨부 제거 버튼은 여기 한 곳에서만 켜고 끈다. 질문이나 사진 중 하나만 있어도 보낼 수 있다.
// 보고 있는 대화가 글 답을 만드는 동안(ask가 취소 신호를 둔 동안)에만 보내기 버튼이 정지 버튼이 된다(#137).
// 사진·졸업 요청은 취소 신호가 없어 그동안은 잠긴 보내기 버튼 그대로다.
function updateSend() {
  const attached = Boolean(photoFile.files?.length);
  const pending = busy || (requestedChatView && Boolean(activeConversation?.pending));
  const stoppable = requestedChatView && Boolean(activeConversation?.pending && activeConversation?.chatAbort);
  send.disabled = stoppable ? false : pending || (!input.value.trim() && !attached);
  if (typeof renderSendMode === "function") renderSendMode(stoppable);
  photoClear.hidden = !attached;
  photoClear.disabled = pending;
  photoFile.disabled = pending;
  photoAttach.disabled = pending;
  reset.disabled = pending;
  for (const turn of activeConversation?.turns || []) turn.updateActions?.();
  // 첨부 제거 버튼이 나타나거나 사라지면 입력 줄이 크기 변화 없이 위아래로 움직인다. 열린 필기 패드 자리를 바로 다시 잰다(#134).
  if (typeof placeHandwritingPad === "function") placeHandwritingPad();
}

function setBusy(pending, message = "서버에 질문을 보내는 중…") {
  busy = pending;
  say(statusLine, pending ? message : "");
  reset.disabled = pending;
  for (const control of landingControls) control.disabled = pending;
  photoFile.disabled = pending;
  photoAttach.disabled = pending;
  for (const retry of transcript.querySelectorAll(".retry")) retry.disabled = pending;
  for (const reask of transcript.querySelectorAll(".reask")) reask.disabled = pending;
  // 요청이 시작되면 찾는 중으로 바꾼다. 잠금을 풀 때는 요청이 남긴 축하·보류·오류 상태를 그대로 둔다.
  // 결과를 남기지 않고 끝난 요청이 있을 때만 평소로 돌려 대기 점이 남지 않게 한다.
  if (pending) showAssistant("searching");
  else if (assistantState === "searching") showAssistant("idle");
  updateSend();
}

// 사진 요청과 글자 요청이 이어지는 동안 잠금을 한 번만 걸고 한 번만 푼다.
async function whileBusy(message, work) {
  setBusy(true, message);
  try {
    await work();
  } finally {
    setBusy(false);
    scrollToLatest();
  }
}

async function runPhotoRequest(record, message, work) {
  if (!record) return whileBusy(message, work);
  if (record.pending) return;
  record.pending = true;
  const account = historyAccount;
  if (record === activeConversation) say(statusLine, message);
  showAssistant("searching");
  updateSend(); renderConversations();
  for (const turn of record.turns || []) {
    for (const selector of [".reask", ".retry"]) {
      for (const button of turn.querySelectorAll(selector)) button.disabled = true;
    }
  }
  try {
    const succeeded = await work();
    // null은 학생이 정지 버튼으로 멈춘 요청이다(#137). 알림도 읽지 않음 표시도 남기지 않는다.
    if (succeeded === null || account !== historyAccount || !conversations.includes(record)) return;
    if (!requestedChatView || activeConversation !== record || document.hidden) {
      if (succeeded) notifyConversation(record);
      else record.unread = true;
    }
  } finally {
    record.pending = false;
    for (const turn of record.turns || []) {
      for (const selector of [".reask", ".retry"]) {
        for (const button of turn.querySelectorAll(selector)) button.disabled = false;
      }
    }
    if (record === activeConversation) statusLine.textContent = "";
    updateSend(); renderConversations(); scrollToLatest();
  }
}

function scrollToLatest() {
  transcript.scrollTop = transcript.scrollHeight;
}

function isSafeSourceUrl(value) {
  const prefix = "https://";
  if (typeof value !== "string" || /[\p{Z}\p{C}]/u.test(value)) return false;
  if (!value.toLowerCase().startsWith(prefix)) return false;

  const authority = value.slice(prefix.length).split(/[/?#]/, 1)[0];
  if (!authority || /[@\\]/.test(authority)) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && /[^.]/.test(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function citationCard(citation) {
  const card = element("section", "evidence");
  const reference = citation.document + " · " + citation.article_path;
  const date = element("time", null, citation.effective_date);
  date.dateTime = citation.effective_date;
  const dateLine = element("p", "date", t("시행일 "));
  dateLine.append(date);
  // 문서명·조문 위치·조문 원문은 번역하지 않는다. 한국어가 아닌 화면에서만 원문이 한국어라는 표시를 붙인다.
  const snippet = element("blockquote", null, citation.snippet);
  card.append(element("h3", null, t("가상 답변 근거")), element("p", null, reference), dateLine);
  if (uiLang !== "ko") {
    snippet.setAttribute("lang", "ko");
    card.append(element("p", "original-lang", t("원문(한국어)")));
  }
  card.append(snippet);
  const link = sourceLink(citation.source_url, t("공식 원문 보기"), reference);
  if (link) card.append(link);
  return card;
}

// 안전 주소 검사를 통과한 주소만 새 탭 링크로 만든다. 통과하지 못하면 null을 돌려준다.
function sourceLink(url, label, context) {
  if (!isSafeSourceUrl(url)) return null;
  const link = element("a", "source-link", label);
  link.setAttribute("href", url);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(element("span", "sr-only", t(" ({context}, 새 탭에서 열림)", { context })));
  return link;
}

function shownText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value : null;
}

function graduationBasis(basis, label) {
  const cell = element("td", "basis");
  cell.append(element("p", null, shownText(basis?.applied_rule) ?? "적용 기준 확인 전"));
  const title = shownText(basis?.source_title);
  if (title) cell.append(element("p", "source", title));
  const checkedOn = shownText(basis?.checked_on);
  if (checkedOn) {
    const line = element("p", "source", "확인일 ");
    line.append(element("time", null, checkedOn));
    cell.append(line);
  }
  const link = sourceLink(basis?.source_url, "공식 근거 보기", `${label} 근거`);
  if (link) cell.append(link);
  return cell;
}

function graduationRow(entry, className) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("Malformed graduation item");
  }
  const known = typeof entry.status === "string" && Object.hasOwn(graduationStatuses, entry.status);
  const status = known ? entry.status : "needs_check";
  const label = shownText(entry.label) ?? "이름 없는 항목";

  const name = element("th", null, label);
  name.scope = "row";
  const state = element("td");
  state.append(element("span", graduationStatuses[status].className, graduationStatuses[status].label));

  const current = shownText(entry.current);
  const required = shownText(entry.required);
  const amount = element("td", "amount", current || required ? `${current ?? "—"} / ${required ?? "—"}` : "—");

  const note = element("td", "note");
  const shortfall = shownText(entry.shortfall);
  const reason = shownText(entry.reason);
  if (shortfall) note.append(element("p", "shortfall", shortfall));
  if (reason) note.append(element("p", null, reason));
  else if (status === "needs_check") note.append(element("p", null, "확인이 필요해요."));

  const row = element("tr", className);
  row.append(name, state, amount, note, graduationBasis(entry.basis, label));
  return row;
}

// 계산은 서버가 끝냈으므로 화면은 받은 순서대로 그리기만 한다. 세부 id는 해석하지 않는다.
function graduationResult(result) {
  if (!Array.isArray(result?.items) || !result.items.length) throw new TypeError("Malformed graduation result");

  const profile = result.profile ?? {};
  const year = shownText(profile.admission_year);
  const who = [
    shownText(profile.label),
    shownText(profile.department),
    year && `${year}학년도 입학`,
    shownText(profile.admission_type),
    shownText(profile.track),
  ].filter(Boolean);

  const head = element("tr");
  for (const column of graduationColumns) {
    const cell = element("th", null, column);
    cell.scope = "col";
    head.append(cell);
  }
  const thead = element("thead");
  thead.append(head);

  const tbody = element("tbody");
  for (const item of result.items) {
    tbody.append(graduationRow(item, "item"));
    if (!Array.isArray(item.details)) continue;
    for (const detail of item.details) tbody.append(graduationRow(detail, "detail"));
  }

  const table = element("table");
  table.append(element("caption", null, who.join(" · ") || "가상 학생 졸업 체크"), thead, tbody);
  const scroller = element("div", "table-scroll");
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "졸업 체크 결과 표");
  scroller.append(table);
  return [
    scroller,
    element("p", "notice", "가상 이수 내역을 규칙으로 계산한 결과예요. 실제 학적 정보가 아니에요."),
  ];
}

// 날짜 글자(2026-11-26)를 읽기 쉬운 글자로만 바꾼다. 꼴이 다르면 받은 글자를 그대로 보여 준다.
function dateNode(value, withYear) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return element("span", null, value);
  const [, year, month, day] = match;
  const node = element("time", null, `${withYear ? `${year}년 ` : ""}${Number(month)}월 ${Number(day)}일`);
  node.dateTime = value;
  return node;
}

// 점수는 서버가 공개됐다고 표시한 양의 정수만 적는다. 더하거나 부족 점수와 견주지 않는다.
function mileageText(program) {
  const points = program.mileage_points;
  if (program.mileage_status === "published" && Number.isInteger(points) && points > 0) return `마일리지 ${points}점`;
  return null;
}

function biskitProgram(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) {
    throw new TypeError("Malformed BISKIT program");
  }
  // 제목은 글자여야 한다. 숫자 같은 다른 값은 형식 오류로 보고 추천 영역을 그리지 않는다.
  const title = typeof program.title === "string" ? shownText(program.title) : null;
  if (!title) throw new TypeError("Malformed BISKIT program");
  // 로그인 여부는 참·거짓 값이어야 한다. "true" 같은 글자를 어림잡아 읽으면 로그인 안내가 조용히 빠진다.
  if (typeof program.login_required !== "boolean") throw new TypeError("Malformed BISKIT program");

  const when = element("p", "when");
  const audience = shownText(program.audience);
  if (audience) when.append(document.createTextNode(`${audience} · `));
  const applyUntil = shownText(program.apply_until);
  if (applyUntil) {
    when.append(document.createTextNode("신청 "), dateNode(applyUntil, false), document.createTextNode("까지"));
  } else {
    when.append(document.createTextNode("신청 마감 확인 필요"));
  }
  const eventOn = shownText(program.event_on);
  if (eventOn) when.append(document.createTextNode(" · 행사 "), dateNode(eventOn, true));

  const card = element("li", "program");
  card.append(element("h4", null, title), when);

  // 서버가 확인했다고 밝힌 값(eligible, open)이 아니면 모두 확인 필요로 보여 준다.
  const checks = [];
  if (program.eligibility !== "eligible") checks.push("대상 확인 필요");
  if (program.deadline_status !== "open") checks.push("마감 시각 확인 필요");
  if (checks.length) {
    const line = element("p", "checks");
    for (const check of checks) line.append(element("span", "badge needs-check", check));
    card.append(line);
  }
  const mileage = mileageText(program);
  if (mileage) card.append(element("p", "mileage", mileage));

  const links = element("div", "links");
  links.append(
    sourceLink(program.notice_url, "공식 공지 보기", title) ?? element("span", "hint", "공식 공지 확인 필요"),
  );
  const application = sourceLink(program.application_url, "신청 페이지 열기", title);
  // 신청 주소가 로그인 화면을 거치는 경로일 수 있으므로, 링크가 있어도 로그인 필요를 눈에 보이게 적는다.
  if (application) links.append(application);
  if (program.login_required) {
    links.append(element("span", "hint", application ? "BISKIT 로그인 필요" : "BISKIT 로그인 후 프로그램명으로 검색"));
  }
  card.append(links);
  return card;
}

// 교내 비교과 시스템(BISKIT) 추천 영역. 고르고 줄 세우는 일은 서버가 끝냈으므로 받은 순서대로 그린다.
// 값이 없거나 형식이 어긋나면 null을 돌려주어 추천 영역만 빠지고 졸업 표는 남는다.
function biskitRecommendations(recommendation, items) {
  try {
    if (recommendation === null || typeof recommendation !== "object" || Array.isArray(recommendation)) return null;
    const shortfall = recommendation.shortfall_points;
    if (!Number.isInteger(shortfall) || shortfall < 1 || !Array.isArray(recommendation.programs)) return null;

    const section = element("section", "biskit");
    const details = Array.isArray(items) ? items.find(item => item?.id === "extracurricular")?.details : null;
    const row = Array.isArray(details) ? details.find(item => item?.id === "mileage") : null;
    const points = value => typeof value === "string" && /^\d+점$/.test(value) && value.endsWith("점") ? Number(value.slice(0, -1)) : NaN;
    const current = points(row?.current), required = points(row?.required);
    const verified = Number.isSafeInteger(current) && Number.isSafeInteger(required) && required - current === shortfall;
    section.append(element("h3", null, verified
      ? `내 BISKIT ${current}/${required}점 · ${shortfall}점 부족`
      : `BISKIT 추천 · ${shortfall}점 부족`));

    const listed = element("p", "source");
    const listedOn = shownText(recommendation.listed_on);
    if (listedOn) {
      listed.append(document.createTextNode("목록 확인 "), dateNode(listedOn, true), document.createTextNode(" · "));
    }
    listed.append(document.createTextNode("접수 상태와 정원은 공식 페이지에서 확인"));
    section.append(listed);

    if (recommendation.programs.length) {
      const list = element("ul", "programs");
      for (const program of recommendation.programs) list.append(biskitProgram(program));
      section.append(list);
    } else {
      section.append(element("p", "none", "지금 신청할 수 있는 프로그램을 확인하지 못했어요"));
    }

    const portal = sourceLink(recommendation.portal_url, "BISKIT 열기", "교내 비교과 시스템");
    if (portal) section.append(portal);
    return section;
  } catch {
    return null;
  }
}

async function checkGraduation() {
  if (chatView) return;
  if (!selectedStudent) {
    void openStudents("먼저 가상 학생을 골라 주세요");
    return;
  }
  if (busy) return;
  const studentId = selectedStudent.id;
  const generation = studentGeneration;
  const current = () => generation === studentGeneration && selectedStudent?.id === studentId;
  empty.remove();
  graduationTurn?.remove();
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", t("내 요청: ")), document.createTextNode(t("가상 학생 졸업 체크")));
  const reply = element("div", "reply graduation");
  turn.append(prompt, reply);
  transcript.append(turn);
  graduationTurn = turn;

  setBusy(true, "졸업 체크 결과를 불러오는 중…");
  try {
    const response = await fetch(`/api/v1/graduation-demo?student_id=${encodeURIComponent(studentId)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!current()) return;
    if (response.status === 404) {
      leaveStudent();
      void openStudents("먼저 가상 학생을 골라 주세요");
      return;
    }
    if (!response.ok) throw new Error("Graduation request failed");
    const result = await response.json();
    if (!current()) return;
    if (result?.profile?.id !== studentId) throw new Error("Student mismatch");
    reply.append(...graduationResult(result));
    const recommendations = biskitRecommendations(result.biskit_recommendations, result.items);
    if (recommendations) reply.append(recommendations);
    celebrate();
  } catch {
    if (!current()) return;
    const retry = element("button", "retry", t("다시 시도"));
    retry.type = "button";
    retry.addEventListener("click", () => { if (current()) void checkGraduation(); });
    const error = element("div", "error");
    error.append(element("p", null, t("졸업 체크 결과를 받지 못했어요.")), retry);
    reply.replaceChildren(error);
    showAssistant("error");
  } finally {
    setBusy(false);
    if (current()) turn.scrollIntoView?.({ block: "start" });
  }
}

// 사진에서 읽은 마감(11-20)은 연도가 없다. 월·일만 읽기 쉽게 바꾸고, 꼴이 다르면 받은 글자를 그대로 쓴다.
function posterDeadlineText(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  return match ? `${Number(match[1])}월 ${Number(match[2])}일` : value;
}

function posterDateLine(label, value) {
  const line = element("p", "when", `${label} `);
  const shown = typeof value === "string" ? shownText(value) : null;
  line.append(shown ? dateNode(shown, true) : document.createTextNode("확인 필요"));
  return line;
}

// 확정된 행사 카드. 날짜는 행사일, 공식 마감, 사진 마감 순서로 놓아 공식 값이 먼저 읽히게 한다.
function posterEventCard(event, reasonList, clueList) {
  const reasons = Array.isArray(reasonList) ? reasonList : [];
  const identifiedBy = Array.isArray(clueList) ? clueList : [];
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("Malformed poster event");
  }
  const title = typeof event.title === "string" ? shownText(event.title) : null;
  if (!title) throw new TypeError("Malformed poster event");
  // 로그인 여부를 어림잡아 읽으면 로그인 안내가 조용히 빠지므로, 참·거짓 값이 아니면 카드를 그리지 않는다.
  if (typeof event.login_required !== "boolean") throw new TypeError("Malformed poster event");

  const card = element("section", "poster-result");
  card.append(element("h3", null, title));

  const clues = identifiedBy.filter(clue => typeof clue === "string" && Object.hasOwn(posterClues, clue));
  if (clues.length) {
    card.append(element("p", "source", `확인 단서 · ${clues.map(clue => posterClues[clue]).join(", ")}`));
  }

  card.append(posterDateLine("행사일", event.event_date), posterDateLine("공식 신청 마감", event.official_deadline));
  if (reasons.includes("deadline_mismatch")) {
    const onPoster = posterDeadlineText(event.poster_deadline);
    const mismatch = element("p", "mismatch");
    mismatch.append(
      element("span", "badge needs-check", "확인 필요"),
      document.createTextNode(
        onPoster
          ? ` 사진에는 마감이 ${onPoster}로 적혀 있어요. 공식 공지의 마감을 따르세요.`
          : " 사진에 적힌 마감이 공식 공지와 달라요. 공식 공지의 마감을 따르세요.",
      ),
    );
    card.append(mismatch);
  }

  // 서버가 접수 중이나 마감이라고 밝힌 값이 아니면 모두 확인 필요로 보여 준다.
  const known = typeof event.application_state === "string" && Object.hasOwn(posterStates, event.application_state);
  const state = posterStates[known ? event.application_state : "needs_check"];
  const stateLine = element("p", "state");
  stateLine.append(element("span", state.className, state.label));
  if (reasons.includes("deadline_day")) {
    stateLine.append(document.createTextNode(" 오늘이 마감일이에요. 공지에 마감 시각이 없어 공식 공지에서 확인해야 해요."));
  }
  card.append(stateLine);

  const points = event.mileage;
  card.append(element(
    "p",
    "mileage",
    Number.isInteger(points) && points > 0 ? `마일리지 ${points}점` : "마일리지 미공개 · 공식 공지에서 확인",
  ));

  const links = element("div", "links");
  links.append(
    sourceLink(event.notice_url, "공식 공지 보기", title) ?? element("span", "hint", "공식 공지 확인 필요"),
  );
  const application = sourceLink(event.application_url, "신청 페이지 열기", title);
  if (application) links.append(application);
  // 신청 링크를 만들지 못해도 로그인이 필요하다는 말은 빠뜨리지 않는다.
  if (event.login_required) {
    links.append(element(
      "span",
      "hint",
      application ? "BISKIT 로그인 필요" : "BISKIT 로그인 필요 · 로그인 후 프로그램명으로 검색",
    ));
  }
  card.append(links);

  const checked = element("p", "source");
  const checkedOn = typeof event.checked_on === "string" ? shownText(event.checked_on) : null;
  if (checkedOn) checked.append(document.createTextNode("확인일 "), dateNode(checkedOn, true), document.createTextNode(" · "));
  checked.append(document.createTextNode("현재 정원과 접수 상태는 공식 링크에서 다시 확인"));
  card.append(checked);
  return card;
}

// 노란 확인 필요 카드. 행사·출처 링크는 넣지 않는다.
function needsCheckCard(messages) {
  const card = element("section", "poster-result unconfirmed");
  const heading = element("h3");
  heading.append(element("span", "badge needs-check", "확인 필요"));
  card.append(heading);
  for (const message of messages) card.append(element("p", null, t(message)));
  card.append(element("p", "source", t(photoMessages.noLink)));
  return card;
}

// 요청 실패 문구. 다시 시도할 일이 있을 때만 버튼을 붙인다. 문구는 화면이 만든 고정 문구라 여기서 번역한다.
function failureBox(message, retry) {
  const error = element("div", "error");
  error.append(element("p", null, t(message)));
  if (retry) {
    const button = element("button", "retry", t("다시 시도"));
    button.type = "button";
    button.addEventListener("click", () => {
      if (!busy) retry();
    });
    error.append(button);
  }
  return error;
}

// 응답 줄(상태 코드)은 받았어도 본문을 받는 중에 연결이 끊길 수 있다.
// 다 받은 본문을 해석하지 못한 경우(SyntaxError)만 서버 오류로 보고, 나머지는 통신 실패로 본다.
// 돌려주는 값은 { result } 또는 { failure, status }다.
async function requestJson(path, options, unprocessed) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    return { failure: photoMessages.disconnected };
  }
  if (!response.ok) return { failure: unprocessed, status: response.status };
  try {
    return { result: await response.json() };
  } catch (error) {
    return { failure: error?.name === "SyntaxError" ? unprocessed : photoMessages.disconnected };
  }
}

// 보내기 전에 화면이 먼저 막는 두 경우. 문제가 없으면 null을 돌려준다.
function textProblem(question, recognized) {
  if (!question && !recognized) return photoMessages.nothingToAsk;
  if ([...recognized].length > recognizedMaxChars) return photoMessages.tooLong;
  return null;
}

// 글자 주소의 출처 목록. 안전 주소 검사를 통과한 서버 출처만 링크가 되고, 나머지는 제목 글자만 남는다.
function sourceList(sources) {
  const list = element("ul", "sources");
  for (const source of Array.isArray(sources) ? sources : []) {
    if (source === null || typeof source !== "object" || Array.isArray(source)) continue;
    const title = typeof source.title === "string" ? shownText(source.title) : null;
    const link = sourceLink(source.url, title ?? "출처 보기", "출처");
    if (!link && !title) continue;
    const item = element("li");
    item.append(link ?? element("span", "hint", `${title} · 링크 확인 필요`));
    list.append(item);
  }
  return list.children.length ? list : null;
}

// 글자 주소의 응답을 그린다. 돌려주는 값은 [그릴 요소, 알림 영역에 쓸 한 줄]이다.
// 판독문과 답변 글은 글자로만 넣으므로, 그 안에 주소처럼 생긴 글자가 있어도 링크가 되지 않는다.
function textAnswer(result) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("Malformed photo answer");
  }
  const kind = typeof result.kind === "string" ? result.kind : "";
  if (kind === "event") {
    const card = posterEventCard(result.event, result.reasons, result.identified_by);
    return [card, ["행사를 찾았어요. {title}", { title: result.event.title }]];
  }
  if (kind === "hold") {
    // 서버가 아는 사유 이름을 보냈으면 그 문구를, 아니면 일반 보류 문구를 쓴다. 보류에는 출처를 그리지 않는다.
    const reason = result.hold_reason;
    const known = typeof reason === "string" && Object.hasOwn(photoNeedsCheck, reason);
    return [needsCheckCard([known ? photoNeedsCheck[reason] : photoMessages.held]), "답변을 보류했어요. 링크는 보여 주지 않아요."];
  }
  if (!Object.hasOwn(textAnswerKinds, kind)) throw new TypeError("Malformed photo answer");
  const answer = typeof result.answer === "string" ? shownText(result.answer) : null;
  if (!answer) throw new TypeError("Malformed photo answer");

  const section = element("section", "text-answer");
  section.append(element("h3", null, t(textAnswerKinds[kind])), element("p", null, answer));
  const sources = sourceList(result.sources);
  if (sources) section.append(sources);
  return [section, () => t("{kind}에서 답을 찾았어요.", { kind: t(textAnswerKinds[kind]) })];
}

// 사진 없이 글자만 보낸다. 실패하면 같은 글자로만 다시 시도한다.
async function answerFromText(question, recognized, answer, record = null) {
  const account = historyAccount;
  // 읽은 글자로 답을 만드는 동안에도 보내기 버튼이 정지 버튼이 된다(#137). 사진을 읽는 단계에는 신호를 두지 않는다.
  // 「고쳐서 다시 묻기」로 같은 자리에 새 답을 받다가 멈추면, 지우기 전의 답을 그대로 되돌려 놓는다.
  const controller = record && typeof AbortController === "function" ? new AbortController() : null;
  // 되돌리는 것은 앞서 받은 답뿐이다. 「다시 시도」로 연 경우 앞의 오류 상자(문구와 다시 시도 버튼)는 이미 끝난 실패라 되살리지 않는다.
  const failed = node => node?.className === "error" || node?.classList?.contains?.("error") === true;
  const previous = controller ? Array.from(answer.childNodes ?? answer.children ?? []).filter(node => !failed(node)) : [];
  say(statusLine, photoMessages.asking);
  photoNote.textContent = "";
  answer.replaceChildren();
  if (controller) { record.chatAbort = controller; updateSend(); }
  let response;
  try {
    response = await requestJson("/api/v1/photo-question", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ question, recognized_text: recognized, session_id: record ? record.sessionId || null : sessionId }),
      signal: chatSignal(controller?.signal ?? null, 90_000),
    }, photoMessages.textFailed);
  } finally {
    if (record?.chatAbort === controller) delete record.chatAbort;
    if (controller) updateSend();
  }
  const { result, failure, status } = response;

  if (record && (account !== historyAccount || !conversations.includes(record))) return false;
  // 학생이 멈춘 답은 새로 받은 글이 없다. 앞서 있던 답만 되돌리고, 오류 문구·다시 시도·알림·읽지 않음 표시를 내지 않는다.
  // null은 runPhotoRequest에 「멈춤」을 알린다. 실패(false)로 넘기면 그사이 탭을 숨겼을 때 읽지 않음 표시가 붙는다.
  if (controller?.signal.aborted) {
    answer.replaceChildren(...previous);
    say(photoNote, "");
    showAssistant("idle");
    return null;
  }
  let message = failure;
  if (!failure) {
    try {
      const [node, summary] = textAnswer(result);
      answer.append(node);
      say(photoNote, summary);
      if (result.kind === "hold") showAssistant("hold");
      else celebrate();
      return true;
    } catch {
      message = photoMessages.textFailed;
    }
  }
  // 서버가 글자 자체를 거절하면(422) 같은 글자를 다시 보내도 결과가 같아 다시 시도 버튼을 두지 않는다.
  const rejected = status === 422;
  if (rejected) message = photoMessages.textRejected;
  answer.replaceChildren(failureBox(
    message,
    rejected ? null : () => void runPhotoRequest(record, photoMessages.asking, () => answerFromText(question, recognized, answer, record)),
  ));
  say(photoNote, message);
  showAssistant("error");
}

// 읽은 글자를 고치는 칸. 판독문은 입력 칸의 값으로만 넣어 일반 글자로 남는다.
// 다시 물을 때는 사진 없이 두 칸의 글자만 보내고, 결과는 같은 답변 자리(answer)에 바꿔 그린다.
function readingPanel(recognized, question, answer, notes, record = null) {
  const panel = element("section", "reading");
  panel.append(element("h3", null, "사진에서 읽은 글자"));
  for (const note of notes) panel.append(element("p", "source", note));

  const textBox = element("textarea", "reading-text");
  textBox.rows = 3;
  textBox.value = recognized;
  const textField = element("label", "field");
  textField.append(element("span", null, "읽은 글자"), textBox);

  const questionBox = element("textarea", "reading-question");
  questionBox.rows = 1;
  questionBox.value = question;
  const questionField = element("label", "field");
  questionField.append(element("span", null, "함께 물을 질문"), questionBox);

  const problemLine = element("p", "reading-note");
  problemLine.setAttribute("role", "status");
  const reask = element("button", "reask check", "고쳐서 다시 묻기");
  reask.type = "button";
  // 이 칸은 요청이 진행 중일 때 만들어진다. 잠금이 풀릴 때 setBusy가 함께 풀어 준다.
  reask.disabled = busy || Boolean(record?.pending);
  reask.addEventListener("click", () => {
    if (busy || record?.pending) return;
    const nextQuestion = questionBox.value.trim();
    const nextRecognized = textBox.value.trim();
    const problem = textProblem(nextQuestion, nextRecognized);
    problemLine.textContent = problem ? t(problem) : "";
    if (problem) return;
    void runPhotoRequest(record, photoMessages.asking, () => answerFromText(nextQuestion, nextRecognized, answer, record));
  });

  panel.append(
    textField,
    questionField,
    problemLine,
    reask,
    element("p", "source", "잘못 읽힌 글자를 고쳐 다시 물으면 사진은 다시 보내지 않고 글자만 보내요. 2,000자까지 보낼 수 있어요."),
  );
  return panel;
}

// 사진 대조는 서버가 끝냈다. 화면은 확정(confirmed)일 때만 행사와 링크를 그리고,
// 그 밖의 값은 서버가 행사 정보를 함께 보냈더라도 그리지 않고 읽은 글자로 다시 묻는다.
// 돌려주는 값은 { answer, panel, summary, pending }이고, pending이 있으면 글자 주소로 이어서 묻는다.
function photoReading(result, question, record = null) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("Malformed photo result");
  }
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const recognized = typeof result.recognized_text === "string" ? result.recognized_text : "";
  const answer = element("div", "photo-answer");

  if (result.event_match === "confirmed") {
    answer.append(posterEventCard(result.event, reasons, result.identified_by));
    return {
      answer,
      panel: readingPanel(recognized, question, answer, [], record),
      summary: ["행사를 찾았어요. {title}", { title: result.event.title }],
      pending: null,
    };
  }

  const explained = reasons
    .filter(reason => typeof reason === "string" && Object.hasOwn(photoNeedsCheck, reason))
    .map(reason => photoNeedsCheck[reason]);
  const problem = textProblem(question, recognized.trim());
  if (!problem) {
    return {
      answer,
      panel: readingPanel(recognized, question, answer, explained, record),
      summary: "",
      pending: { question, recognized: recognized.trim() },
    };
  }
  // 물을 글자가 없거나 판독문이 한도를 넘으면 글자 주소로 보내지 않고, 고쳐서 다시 물을 칸만 남긴다.
  const messages = problem === photoMessages.tooLong
    ? [photoMessages.tooLong]
    : explained.length ? explained : [photoMessages.nothingRead];
  answer.append(needsCheckCard(messages));
  return {
    answer,
    panel: readingPanel(recognized, question, answer, [], record),
    summary: problem === photoMessages.tooLong ? photoMessages.tooLong : "사진에서 확인한 내용이 없어요. 링크는 보여 주지 않아요.",
    pending: null,
  };
}

// photo는 파일에서 바이트만 잘라 낸 값이라 파일명이 없다. 본문에 그대로 싣고 형식은 Content-Type으로 알린다.
// 사진은 여기서 한 번만 보낸다. 행사가 확인되지 않으면 읽은 글자만 글자 주소로 넘긴다.
async function readPhoto(photo, type, question, reply, record = null) {
  const account = historyAccount;
  say(statusLine, photoMessages.reading);
  photoNote.textContent = "";
  reply.replaceChildren();

  const { result, failure, status } = await requestJson("/api/v1/photo-input", {
    method: "POST",
    headers: { "Content-Type": type, Accept: "application/json" },
    body: photo,
    signal: AbortSignal.timeout(60_000),
  }, photoMessages.photoFailed);

  if (record && (account !== historyAccount || !conversations.includes(record))) return false;
  let message = failure;
  if (!failure) {
    let shown = null;
    try {
      shown = photoReading(result, question, record);
    } catch {
      message = photoMessages.photoFailed;
    }
    if (shown) {
      reply.append(shown.answer, shown.panel);
      // 안내 줄은 원문과 채울 값을 기억해 두어 언어를 바꾸면 같은 안내를 새 언어로 다시 쓴다.
      say(photoNote, shown.summary);
      // 글자 주소로 이어서 물으면 그 결과가 비서 상태를 정한다. 여기서 끝나면 확정은 찾음, 나머지는 보류다.
      if (shown.pending) return await answerFromText(shown.pending.question, shown.pending.recognized, shown.answer, record);
      else if (result.event_match === "confirmed") celebrate();
      else showAssistant("hold");
      return true;
    }
  }
  // 사진 자체가 거절된 경우(413·415·422)는 같은 사진을 다시 보내도 결과가 같아 다시 시도 버튼을 두지 않는다.
  const rejected = Object.hasOwn(photoRejections, status ?? "");
  if (rejected) message = photoRejections[status];
  reply.replaceChildren(failureBox(
    message,
    rejected ? null : () => void runPhotoRequest(record, photoMessages.reading, () => readPhoto(photo, type, question, reply, record)),
  ));
  say(photoNote, message);
  showAssistant("error");
}

const aiModeKey = "kumoh-chat-ai-mode:v1";
let aiMode = "fast";
let chatRequestNumber = 0;
let activeChoiceMenu = null;
// indicator를 켜면 초점·마우스가 가리키는 항목 뒤로 선택 표시 한 장이 따라간다(#137). 옮길 때는 지금 자리와 목표를
// 함께 덮도록 늘어났다가(stretch) 목표 자리에 안착한다(settle). 곡선과 시간은 quick-actions.css가 정한다.
function choiceIndicator(menu, items) {
  const indicator = element("span", "choice-menu-indicator");
  indicator.setAttribute("aria-hidden", "true");
  menu.setAttribute("data-indicator", "");
  menu.append(indicator);
  let current = null, timer = null;
  const box = item => typeof item?.offsetTop === "number" ? { top: item.offsetTop, height: item.offsetHeight } : null;
  const place = ({ top, height }, phase) => {
    indicator.setAttribute("data-phase", phase);
    indicator.style.setProperty("--choice-menu-indicator-y", `${top}px`);
    indicator.style.setProperty("--choice-menu-indicator-h", `${height}px`);
  };
  function move(item) {
    const to = box(item), from = box(current);
    if (!to || item === current) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    current = item;
    if (!from || reducedMotion() || typeof setTimeout !== "function") { place(to, "rest"); return; }
    const top = Math.min(from.top, to.top);
    place({ top, height: Math.max(from.top + from.height, to.top + to.height) - top }, "stretch");
    timer = setTimeout(() => { timer = null; if (current === item) place(to, "settle"); }, 90);
  }
  // 늘어난 채 안착을 기다리는 동안 동작 줄이기를 켜면 예약을 버리고 목표 자리에 바로 놓는다.
  settleChoiceIndicator = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    const to = box(current);
    if (to) place(to, "rest");
  };
  for (const item of items) item.addEventListener("pointerenter", () => move(item));
  return { move };
}
// 지금 열린 선택 표시 하나만 기억한다. 설정 변화 처리기는 한 번만 붙인다. 화면 조각만 떼어 도는 테스트처럼
// 설정 읽기 함수(motionPreference)가 없는 곳에서는 붙이지 않는다.
let settleChoiceIndicator = null;
if (typeof motionPreference === "function") {
  motionPreference()?.addEventListener?.("change", event => { if (event.matches) settleChoiceIndicator?.(); });
}
function openChoiceMenu(button, title, choices, onSelect, { indicator = false } = {}) {
  activeChoiceMenu?.close();
  const menu = element("div", "choice-menu");
  menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", title);
  menu.append(element("div", "choice-menu-title", title));
  const items = choices.map(choice => {
    const item = element("button", "choice-menu-item");
    item.type = "button"; item.tabIndex = -1; item.dataset.choiceValue = choice.value;
    item.setAttribute("role", "menuitemradio"); item.setAttribute("aria-checked", String(Boolean(choice.checked)));
    const icon = element("span", "choice-menu-icon");
    if (choice.icon) { const copy = choice.icon.cloneNode(true); copy.removeAttribute("hidden"); icon.append(copy); }
    const name = element("span", "choice-menu-name", choice.name);
    // 언어 메뉴처럼 항목마다 언어가 다르면 읽기 도구가 그 언어로 읽게 표시한다.
    if (choice.lang) name.setAttribute("lang", choice.lang);
    item.append(icon, name, element("span", "choice-menu-desc", choice.description), element("span", "choice-menu-check", choice.checked ? "✓" : ""));
    item.addEventListener("click", () => { onSelect(choice.value); close(true); });
    menu.append(item); return item;
  });
  function close(restore = false) {
    menu.remove(); button.setAttribute("aria-expanded", "false");
    if (activeChoiceMenu?.menu === menu) activeChoiceMenu = null;
    if (restore) button.focus();
  }
  const marker = indicator ? choiceIndicator(menu, items) : null;
  menu.addEventListener("keydown", event => {
    const index = Math.max(0, items.indexOf(document.activeElement));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
      next.focus(); marker?.move(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); items[index].click();
    } else if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation?.(); close(true);
    } else if (event.key === "Tab") setTimeout(() => close(), 0);
  });
  document.body.append(menu); button.setAttribute("aria-expanded", "true");
  const anchor = button.getBoundingClientRect(), box = menu.getBoundingClientRect();
  const width = window.innerWidth || 360, height = window.innerHeight || 640;
  // 버튼 위에 메뉴가 들어갈 자리가 있으면 위로 연다. 없으면 아래를 보고, 둘 다 모자라면 더 넓은 쪽으로 연다.
  // 그래서 입력 상자처럼 아래쪽 버튼은 위로, 머리글처럼 위쪽 버튼은 아래로 열린다.
  const above = anchor.top - 8 - 16, below = height - anchor.bottom - 8 - 16;
  const up = box.height <= above || (box.height > below && above >= below);
  const top = up ? anchor.top - box.height - 8 : anchor.bottom + 8;
  menu.style.setProperty("--choice-menu-x", `${Math.max(16, Math.min(anchor.right - box.width, width - box.width - 16))}px`);
  menu.style.setProperty("--choice-menu-y", `${Math.max(16, Math.min(top, height - box.height - 16))}px`);
  activeChoiceMenu = { menu, button, close };
  const first = items[Math.max(0, choices.findIndex(choice => choice.checked))];
  first?.focus(); marker?.move(first);
  return activeChoiceMenu;
}
document.addEventListener?.("pointerdown", event => {
  if (activeChoiceMenu && !within(activeChoiceMenu.menu, event.target) && !within(activeChoiceMenu.button, event.target)) activeChoiceMenu.close();
}, true);
function setupAiMode() {
  try { aiMode = historyStorage()?.getItem(aiModeKey) === "deep" ? "deep" : "fast"; } catch { aiMode = "fast"; }
  const button = document.querySelector("#ai-mode-button");
  if (!button || typeof button.querySelector !== "function") return;
  const row = document.querySelector(".composer-row"), label = button.querySelector(".mode-pill-label");
  const icons = ["fast", "deep"].map(value => button.querySelector(`.mode-icon[data-icon=${value}]`));
  if (!row || !label || icons.some(icon => !icon)) return;
  let effectTimer;
  function stopEffect() {
    clearTimeout(effectTimer);
    effectTimer = undefined;
    button.classList.remove("is-flowing");
  }
  function render(animate = false) {
    stopEffect();
    const deep = aiMode === "deep";
    button.dataset.mode = aiMode;
    button.setAttribute("aria-label", t("답변 모드: {name}", { name: t(deep ? "깊이 생각" : "빠르게") }));
    if (label) label.textContent = t(deep ? "깊이 생각" : "빠르게");
    icons.forEach((icon, index) => {
      if (!icon) return;
      if (deep !== Boolean(index)) icon.setAttribute("hidden", "");
      else icon.removeAttribute("hidden");
    });
    row?.classList.toggle("is-deep", deep);
    if (!deep || reducedMotion() || !animate) return;
    button.classList.add("is-flowing");
    effectTimer = setTimeout(stopEffect, 280);
  }
  render();
  if (typeof motionPreference === "function") {
    motionPreference()?.addEventListener?.("change", event => {
      if (event.matches) stopEffect();
    });
  }
  // 언어를 바꾸면 효과 없이 이름만 다시 그린다.
  onLangChange(() => render());
  function open() {
    if (activeChoiceMenu?.button === button) { activeChoiceMenu.close(); return; }
    openChoiceMenu(button, t("답변 모드"), [
      { value: "fast", name: t("빠르게"), description: t("바로 답해요 · 보통 1~3초"), icon: icons[0], checked: aiMode === "fast" },
      { value: "deep", name: t("깊이 생각하기"), description: t("생각 과정을 보여 주며 꼼꼼히 답해요 · 10~30초"), icon: icons[1], checked: aiMode === "deep" },
    ], value => {
      const previous = aiMode;
      try {
        const storage = historyStorage(); if (!storage) throw new Error("Storage unavailable");
        storage.setItem(aiModeKey, value); aiMode = value;
      } catch { aiMode = "fast"; }
      render(previous !== aiMode && aiMode === "deep");
    }, { indicator: true });
  }
  button.addEventListener("click", open);
  button.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); open(); }
  });
}
setupAiMode();

// 테마 선택기(#131).
const themeModeKey = "kumoh-chat-theme:v1";
const themeChoices = [
  { value: "system", name: "시스템" },
  { value: "light", name: "라이트" },
  { value: "dark", name: "다크" },
];
let themeMode = "system";
let themeMedia = null;
const themeButtons = [];
function applyTheme() {
  const actual = themeMode === "system" ? (themeMedia?.matches ? "dark" : "light") : themeMode;
  document.documentElement?.setAttribute?.("data-theme-mode", themeMode);
  document.documentElement?.setAttribute?.("data-theme", actual);
  renderThemeButtons();
  // 열린 필기 패드의 잉크를 새 테마 글자색으로 바로 다시 그린다. 다음 획을 기다리면 그사이 대비가 무너진다(#134).
  if (typeof redrawHandwritingPad === "function") redrawHandwritingPad();
}
function renderThemeButtons() {
  const name = t(themeChoices.find(choice => choice.value === themeMode).name);
  for (const { button, label } of themeButtons) {
    label.textContent = name;
    button.setAttribute("aria-label", t("테마: {name}", { name }));
  }
}
function openThemeMenu(button) {
  if (activeChoiceMenu?.button === button) { activeChoiceMenu.close(); return; }
  openChoiceMenu(button, t("테마"), themeChoices.map(choice => ({
    value: choice.value, name: t(choice.name), description: "", checked: choice.value === themeMode,
  })), value => {
    themeMode = value;
    try { historyStorage()?.setItem(themeModeKey, value); } catch { /* 저장에 실패해도 현재 탭의 선택은 유지한다. */ }
    applyTheme();
  });
}
function setupTheme() {
  try {
    const saved = historyStorage()?.getItem(themeModeKey);
    themeMode = themeChoices.some(choice => choice.value === saved) ? saved : "system";
  } catch { themeMode = "system"; }
  try { themeMedia = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null; } catch { themeMedia = null; }
  const changed = () => { if (themeMode === "system") applyTheme(); };
  if (typeof themeMedia?.addEventListener === "function") themeMedia.addEventListener("change", changed);
  else if (typeof themeMedia?.addListener === "function") themeMedia.addListener(changed);
  for (const selector of ["#login-theme-button", "#theme-button"]) {
    const button = document.querySelector(selector);
    if (!button || typeof button.querySelector !== "function" || typeof button.addEventListener !== "function") continue;
    const label = button.querySelector(".lang-pill-label");
    if (!label) continue;
    themeButtons.push({ button, label });
    button.addEventListener("click", () => openThemeMenu(button));
    button.addEventListener("keydown", event => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); openThemeMenu(button); }
    });
  }
  applyTheme();
  onLangChange(renderThemeButtons);
}
// 테마 선택기 끝.

// 언어 선택기(#116). 머리글과 로그인 화면의 두 알약 버튼이 같은 언어 상태를 쓰고, 메뉴는 답변 모드와 같은 openChoiceMenu다.
// 기본 드롭다운(select)은 쓰지 않는다. 고르면 새로고침 없이 지금 보이는 글을 바꾼다.
const langButtons = [];
let staticTouched = false, titlesTouched = false;
const staticSources = new WeakMap();
// 문서에 적힌 고정 문구만 바꾼다. 아래 자리는 스크립트가 직접 그리거나(메뉴·확인 창·제목), 서버 글과 사용자 글이 들어간다.
const staticSkip = [".turn", "#conversation-list", "[data-panel-content]", ".title-fallback", ".main-title-fallback",
  "#ai-mode-button", ".lang-pill", ".choice-menu", ".conversation-menu", ".confirm-scrim", "#campus-caption",
  "#demo-label", "#conversation-toast-open", "#conversation-announce", ".quicklink-track", "#handwriting-status",
  // 빠른 실행 링(#137)은 quick-actions.js가 자기 사전으로 <html lang>을 따라 다시 쓴다.
  ".quick-ring", ".quick-toggle"].join(", ");
function langChoice(value) {
  return langChoices.find(choice => choice.value === value) ?? langChoices[0];
}
function renderLangButtons() {
  const name = langChoice(uiLang).label;
  for (const { button, label } of langButtons) {
    label.textContent = name;
    button.setAttribute("aria-label", t("언어 / Language: {name}", { name }));
  }
}
function openLangMenu(button) {
  if (activeChoiceMenu?.button === button) { activeChoiceMenu.close(); return; }
  openChoiceMenu(button, "언어 / Language", langChoices.map(choice => ({
    value: choice.value, name: choice.name, description: choice.description, lang: langTags[choice.value],
    checked: choice.value === uiLang,
  })), chooseLang);
}
// 저장에 실패하면 한국어로 돌아간다. 답변 모드 선택기가 저장 실패 때 빠르게로 돌아가는 것과 같다.
function chooseLang(value) {
  let lang = knownLang(value) ?? "ko";
  try {
    const storage = historyStorage();
    if (!storage) throw new Error("Storage unavailable");
    storage.setItem(langKey, lang);
  } catch { lang = "ko"; }
  applyLang(lang);
}
function applyLang(lang) {
  uiLang = knownLang(lang) ?? "ko";
  document.documentElement?.setAttribute?.("lang", langTags[uiLang]);
  showTitle();
  resay();
  translateStatic();
  renderTitles();
  localizeReplyAuthors();
  for (const turn of document.querySelectorAll?.(".turn") ?? []) turn.updateActions?.();
  renderLangButtons();
  labelConversationMenu();
  labelConfirm();
  const toastOpen = document.querySelector("#conversation-toast-open");
  if (toastRecord && toastOpen) toastOpen.textContent = toastLine(toastRecord);
  renderConversations();
  for (const listener of langListeners) listener();
}
function localizeReplyAuthors() {
  for (const label of document.querySelectorAll?.(".reply-author") ?? []) label.textContent = t("아이오");
}
// 문서의 글 조각과 aria-label·placeholder·alt를 사전으로 바꾼다. 처음 바꿀 때 한국어 원문을 기억해 두었다가
// 한국어로 돌아오면 그대로 되돌린다. 한국어로 시작한 화면은 한 번도 건드리지 않는다.
function translateStatic() {
  if (uiLang === "ko" && !staticTouched) return;
  if (typeof document.createTreeWalker !== "function") return;
  staticTouched = true;
  const known = key => Object.hasOwn(uiText.en, key);
  for (const root of new Set([document.body, empty])) {
    if (!root) continue;
    const walker = document.createTreeWalker(root, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest(staticSkip)) continue;
      const source = staticSources.get(node) ?? node.nodeValue;
      const key = source.trim();
      if (!key || !known(key)) continue;
      staticSources.set(node, source);
      node.nodeValue = source.replace(key, () => t(key));
    }
    for (const node of root.querySelectorAll("[aria-label], [placeholder], [alt]")) {
      if (node.closest(staticSkip)) continue;
      const saved = staticSources.get(node) ?? {};
      for (const name of ["aria-label", "placeholder", "alt"]) {
        const source = saved[name] ?? node.getAttribute(name);
        if (source === null || !known(source)) continue;
        saved[name] = source;
        node.setAttribute(name, t(source));
      }
      if (Object.keys(saved).length) staticSources.set(node, saved);
    }
  }
}
// 그 언어의 제목 그림을 받기 전이거나 받지 못하면(404·깨짐) 그림 자리를 숨기고 이 글자 제목을 보인다.
function renderTitles() {
  if (uiLang === "ko" && !titlesTouched) return;
  titlesTouched = true;
  const em = text => element("em", null, text);
  const span = (...parts) => { const node = element("span"); node.append(...parts); return node; };
  const [login, main] = {
    ko: [["졸업까지, ", span(em("아이오"), "와 함께")], ["물어봐요, ", em("아이오")]],
    en: [["To graduation, ", span("with ", em("AIO"))], ["Ask ", em("AIO")]],
    zh: [["直到毕业，", span("与 ", em("AIO"), " 同行")], ["问问 ", em("AIO")]],
  }[uiLang];
  document.querySelector(".title-fallback")?.replaceChildren?.(...login);
  document.querySelector(".main-title-fallback")?.replaceChildren?.(...main);
}
function setupLang() {
  for (const selector of ["#login-lang-button", "#lang-button"]) {
    const button = document.querySelector(selector);
    if (!button || typeof button.querySelector !== "function" || typeof button.addEventListener !== "function") continue;
    const label = button.querySelector(".lang-pill-label");
    if (!label) continue;
    langButtons.push({ button, label });
    button.addEventListener("click", () => openLangMenu(button));
    button.addEventListener("keydown", event => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); openLangMenu(button); }
    });
  }
  renderLangButtons();
  setupTheme();
  if (uiLang !== "ko") applyLang(uiLang);
}

async function readChatStream(response, onEvent) {
  if (!response.ok || !response.body || typeof TextDecoder === "undefined") throw new Error("Stream unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", name = "", data = [], done = false;
  function line(text) {
    if (text === "") {
      if (data.length && ["meta", "thinking", "answer", "notice", "done", "error"].includes(name)) {
        const value = JSON.parse(data.join("\n"));
        if (name === "error") throw new Error("Stream failed");
        onEvent(name, value);
        if (name === "done") done = true;
      }
      name = ""; data = [];
    } else if (text.startsWith("event:")) name = text.slice(6).trim();
    else if (text.startsWith("data:")) data.push(text.slice(5).replace(/^ /, ""));
  }
  try {
    while (!done) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let boundary;
      while ((boundary = buffer.search(/[\r\n]/)) >= 0) {
        if (buffer[boundary] === "\r" && boundary === buffer.length - 1 && !chunk.done) break;
        const width = buffer.slice(boundary, boundary + 2) === "\r\n" ? 2 : 1;
        line(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + width);
        if (done) break;
      }
      if (chunk.done) break;
    }
    if (!done) throw new Error("Incomplete stream");
  } finally {
    try { await reader.cancel(); } catch { /* 읽기 실패 뒤에도 잠금을 돌려준다. */ }
    reader.releaseLock();
  }
}
// stop은 학생이 정지 버튼으로 끊는 신호다(#137). 시간 제한 신호와 함께 걸고, 끊긴 요청은 JSON 주소로 다시 묻지 않는다.
// 신호를 묶는 AbortSignal.any가 없는 브라우저는 새 취소 신호 하나를 두고 두 신호 중 먼저 오는 쪽을 따라 끊는다.
// 그래야 정지 버튼을 단 요청도 시간 제한이 그대로 걸린다. 학생이 멈췄는지는 호출한 쪽이 stop.aborted로 따로 본다.
function chatSignal(stop, ms = 100_000) {
  const timeout = AbortSignal.timeout(ms);
  if (!stop) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([stop, timeout]);
  if (typeof AbortController !== "function" || typeof timeout?.addEventListener !== "function") return stop;
  const both = new AbortController();
  const end = () => both.abort();
  if (stop.aborted || timeout.aborted) end();
  stop.addEventListener("abort", end, { once: true });
  timeout.addEventListener("abort", end, { once: true });
  return both.signal;
}
async function requestChatAnswer(body, onEvent, stop = null, versionRequest = false) {
  const options = { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: chatSignal(stop) };
  let meta = null, answer = "", notice, done = null;
  async function request() {
    try {
      const response = await fetch("/api/v1/chat/stream", options);
      await readChatStream(response, (name, data) => {
        if (!meta && name !== "meta") throw new Error("Missing metadata");
        if (name === "meta") meta = data;
        // 글이 아닌 조각은 쌓지 않는다. 보류 답은 서버 글을 그대로 그리므로 "null" 같은 글자가 섞이면 안 된다.
        if (name === "answer" && typeof data.text === "string") answer = data.replace ? data.text : answer + data.text;
        if (name === "notice") notice = data.text;
        if (name === "done") done = data;
        onEvent(name, data);
      });
      // 최종 상태는 done에서 정한다. done.answered가 boolean이면 meta보다 앞서고, 안내 답은 done.guided로만 안다.
      const result = { ...meta, answer, notice, guided: done?.guided === true };
      if (typeof done?.answered === "boolean") result.answered = done.answered;
      if (versionRequest && typeof result.answered !== "boolean") throw new Error("Invalid chat stream");
      return result;
    } catch (error) {
      if (stop?.aborted || (versionRequest && options.signal.aborted)) throw error;
      onEvent("reset", {});
      const signal = versionRequest ? options.signal : chatSignal(stop);
      const response = await fetch("/api/v1/chat", { ...options, signal });
      if (!response.ok) throw new Error("Chat request failed");
      return response.json();
    }
  }
  if (!versionRequest) return request();
  // 수정 요청은 스트림과 JSON 응답이 같은 시간 제한을 쓴다.
  const { signal } = options;
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(new Error("Chat request cancelled"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
  try {
    const result = await Promise.race([cancelled, request()]);
    if (signal.aborted || typeof result?.answered !== "boolean" || typeof result.answer !== "string") {
      throw new Error("Invalid chat response");
    }
    return result;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

function appendStoredMessage(node, message) {
  const held = message.answered === false && message.guided !== true;
  const className = message.role === "question" ? "question" : held ? "reply fallback" : "reply";
  node.append(element("p", className, message.text));
  if (message.role === "answer") node.append(element("small", "reply-author", t("아이오")));
  for (const source of message.sources || []) {
    const link = sourceLink(source.url, source.title, source.title);
    if (link) node.append(link);
  }
}

function appendStoredTurn(turn, question, answer) {
  appendStoredMessage(turn, question);
  if (answer) appendStoredMessage(turn, answer);
}

function setupTurnActions(record, turn, question, answer) {
  const panel = element("div", "turn-actions");
  const picker = element("div", "version-picker");
  picker.setAttribute("role", "group");
  const count = element("span", "version-count");
  count.setAttribute("aria-live", "polite");
  const status = element("p");
  status.setAttribute("role", "status");
  const labels = [];
  let prompt = turn.children[0], editor = null, draft = null, save, field, cancel, state = "", error = "";
  let versions = question.versions || [{ question, answer }], selected = question.selected ?? 0;
  function button(className, label, run, glyph) {
    const control = element("button", className, glyph);
    control.type = "button";
    control.addEventListener("click", run);
    if (label) labels.push(() => {
      if (glyph) control.setAttribute("aria-label", t(label));
      else control.textContent = t(label);
    });
    return control;
  }
  const requestPending = () => busy || record.pending;
  const locked = () => requestPending() || !record.messages.includes(question);
  const edit = button("turn-edit", "수정", () => {
    if (locked()) return;
    state = "";
    draft = question.text;
    showEditor();
    field.focus();
  });
  const regenerate = button("turn-regenerate", null, () => {
    if (!locked() && draft === null) run(question.text);
  });
  const previous = button("version-prev", "이전 버전", () => select(selected - 1, previous), "‹");
  const next = button("version-next", "다음 버전", () => select(selected + 1, next), "›");
  picker.append(previous, count, next);
  function showEditor() {
    if (!editor) {
      editor = element("form", "turn-editor");
      field = element("textarea");
      field.required = true;
      cancel = button("turn-editor-cancel", "취소", closeEditor);
      save = element("button", "turn-editor-submit");
      save.type = "submit";
      editor.append(field, cancel, save);
      editor.addEventListener("submit", event => {
        event.preventDefault();
        if (!locked() && field.value.trim()) run(field.value.trim());
      });
      editor.addEventListener("keydown", event => {
        if (event.key !== "Escape" || event.isComposing || requestPending()) return;
        event.preventDefault();
        event.stopPropagation();
        closeEditor();
      });
    }
    field.value = draft;
    turn.insertBefore(editor, prompt);
    update();
  }
  function closeEditor() {
    if (requestPending()) return;
    draft = null;
    state = "";
    editor.remove();
    update();
    (locked() ? input : edit).focus();
  }
  function update() {
    for (const label of labels) label();
    picker.setAttribute("aria-label", t("답변 버전"));
    const position = `${selected + 1}/${versions.length}`;
    if (count.textContent !== position) count.textContent = position;
    previous.disabled = locked() || draft !== null || selected === 0;
    next.disabled = locked() || draft !== null || selected === versions.length - 1;
    edit.disabled = regenerate.disabled = locked() || draft !== null;
    regenerate.textContent = t(state === "failed" && draft === null ? "다시 시도" : "다시 답하기");
    prompt.hidden = draft !== null && state !== "pending";
    if (editor) {
      field.setAttribute("aria-label", t("질문 수정"));
      field.readOnly = locked();
      cancel.disabled = requestPending();
      save.disabled = locked();
      save.textContent = t(state === "failed" ? "다시 시도" : "저장하고 묻기");
    }
    if (state) turn.setAttribute("data-version-state", state);
    else turn.removeAttribute?.("data-version-state");
    status.className = state === "failed" ? "version-error" : "";
    status.hidden = !state;
    const message = state === "failed" ? t(error) : state ? t("서버에 질문을 보내는 중…") : "";
    if (status.textContent !== message) status.textContent = message;
  }
  function redraw() {
    for (const child of [...turn.children]) {
      if (child !== panel && child !== status) child.remove();
    }
    const content = element("div");
    appendStoredTurn(content, question, answer);
    for (const child of [...content.children]) turn.insertBefore(child, panel);
    prompt = turn.children[0];
    if (versions.length > 1 && picker.parentNode !== panel) panel.insertBefore(picker, regenerate);
    update();
  }
  function choose(index) {
    selected = index;
    const version = versions[selected];
    const chosen = { ...version.question, versions, selected };
    for (const messages of [record.messages, record.committedMessages]) {
      const position = messages?.indexOf(question) ?? -1;
      if (position < 0) continue;
      const hasAnswer = answer && messages[position + 1] === answer;
      messages.splice(position, hasAnswer ? 2 : 1, chosen, ...(version.answer ? [version.answer] : []));
    }
    limitCommittedChatMessages(record, record.committedMessages || record.messages, chosen);
    question = chosen;
    answer = version.answer;
    redraw();
    persistConversations();
  }
  function select(index, origin) {
    if (locked() || draft !== null || index < 0 || index >= versions.length) return;
    state = "";
    choose(index);
    (origin.disabled ? (origin === previous ? next : previous) : origin).focus();
  }
  function run(text) {
    if (!conversations.includes(record) || !record.messages.includes(question)) return;
    if (draft !== null) draft = text;
    state = "pending";
    void ask(text, null, record, (outcome, reply) => {
      state = outcome;
      error = "서버 응답을 받지 못했어요.";
      if (reply) {
        const revised = cleanChatMessage({ role: "question", text, time: reply.time, sources: [] });
        const cleanedReply = cleanChatMessage(reply);
        if (!revised || !cleanedReply) {
          state = "failed";
          error = "저장할 수 없는 번호가 있어 이전 버전을 유지했어요.";
          update();
          return;
        }
        // 기존 저장 기준으로 먼저 걸러야 정상 버전만 다섯 개 남는다.
        versions = versions.filter(version => cleanChatMessage(version.question) &&
          (!version.answer || cleanChatMessage(version.answer)));
        versions.push({ question: revised, answer: cleanedReply });
        draft = null;
        record.time = reply.time;
        choose(limitChatVersions(versions, versions.length - 1));
      }
      update();
    });
  }
  turn.updateActions = update;
  panel.append(edit);
  if (versions.length > 1) panel.append(picker);
  panel.append(regenerate);
  turn.append(panel, status);
  update();
}

async function ask(question, reply, record = activeConversation, revise = null) {
  if (record?.pending) return;
  const account = historyAccount;
  // 대화마다 요청 하나에 취소 신호 하나를 둔다. 이 신호가 있는 동안 그 대화를 보고 있으면 보내기 버튼이 정지 버튼이 된다(#137).
  const controller = record && typeof AbortController === "function" ? new AbortController() : null;
  if (controller) record.chatAbort = controller;
  if (record) record.pending = true;
  else setBusy(true);
  showAssistant("searching");
  updateSend(); renderConversations();
  reply?.replaceChildren();
  const mode = aiMode;
  // 답변 언어는 보낼 때 정한다. 답을 기다리는 동안 언어를 바꾸면 다음 질문부터 적용되고, JSON으로 다시 물을 때도 같은 값을 쓴다.
  const lang = uiLang;
  const requestNumber = ++chatRequestNumber;
  if (record) record.requestNumber = requestNumber;
  const valid = () => !record || (account === historyAccount && conversations.includes(record) &&
    record.requestNumber === requestNumber);
  const visible = () => valid() && (!record || (requestedChatView && activeConversation === record));
  let answerNode = null, thinking = null, thinkingContent = null, thinkingLabel = null;
  const thinkingStarted = Date.now();
  let thinkingFinished = false;
  function startThinking() {
    if (!reply || mode !== "deep" || thinking) return;
    thinkingFinished = false;
    thinking = element("details", "thinking"); thinking.id = `thinking-${requestNumber}`;
    thinking.classList.add("is-waiting");
    const summary = element("summary"); summary.id = `${thinking.id}-summary`;
    thinkingLabel = element("span", null, t("아이오가 생각하는 중"));
    summary.append(thinkingLabel, element("small", null, t("모델이 쓴 원문, 영어일 수 있음")));
    thinkingContent = element("p"); thinkingContent.id = `${thinking.id}-content`;
    thinking.append(summary, thinkingContent); reply.append(thinking);
  }
  function finishThinking() {
    if (!thinking || thinkingFinished) return;
    thinkingFinished = true;
    thinking.classList.remove("is-waiting"); thinking.open = false;
    thinkingLabel.textContent = t("아이오가 {seconds}초 동안 생각함", { seconds: Math.max(0, Math.round((Date.now() - thinkingStarted) / 1000)) });
  }
  startThinking();
  let streamed = "";
  try {
    const result = await requestChatAnswer({ message: question,
      session_id: record ? record.sessionId || null : sessionId, use_academic_data: false, mode, lang }, (name, data) => {
      if (revise || !valid() || controller?.signal.aborted) return;
      if (name === "reset") {
        // 스트림이 끝맺지 못해 JSON으로 다시 묻는 동안 학생이 멈추면, 그때까지 스트림으로 받은 글을 되살린다(#137).
        if (answerNode?.textContent.trim()) streamed = answerNode.textContent;
        finishThinking(); reply.replaceChildren(); answerNode = null; thinking = null; thinkingContent = null; thinkingLabel = null;
      }
      if (name === "thinking" && mode === "deep" && data.text) {
        startThinking();
        thinking.open = !answerNode;
        thinkingContent.textContent += data.text;
      }
      if (name === "answer" && typeof data.text === "string") {
        finishThinking();
        if (!answerNode) { answerNode = element("p"); reply.append(answerNode); }
        answerNode.textContent = data.replace ? data.text : answerNode.textContent + data.text;
        if (visible()) showAssistant("answer");
      }
      if (visible()) scrollToLatest();
    }, controller?.signal ?? null, Boolean(revise));
    if (!valid()) return;
    if (controller?.signal.aborted) throw new Error("Chat request stopped");
    if (record) record.sessionId = result.session_id;
    else sessionId = result.session_id;
    // 안내 답은 근거 없이 받은 글 그대로 일반 말풍선에 그린다. 보류는 서버가 고른 언어로 쓴 보류 문구를 그대로 그리고,
    // 서버 글이 없거나 비었을 때만 화면의 고정 보류 문구를 쓴다.
    const spoken = typeof result.answer === "string" && result.answer.trim() !== "";
    const guided = result.answered !== true && result.guided === true && spoken;
    const text = result.answered || guided || spoken ? result.answer : t("이 질문은 가상 규정에서 근거를 찾지 못했어요.");
    const citations = result.answered && Array.isArray(result.citations) ? result.citations : [];
    const message = { role: "answer", text, time: Date.now(), sources: citations.map(citation => ({
      title: citation.document + " · " + citation.article_path, url: citation.source_url,
    })), ...(result.answered ? {} : { answered: false }), ...(guided ? { guided: true } : {}) };
    if (revise) {
      revise("", message);
      if (visible()) {
        if (result.answered) celebrate();
        else showAssistant("hold");
      }
      return;
    }
    if (!answerNode) { answerNode = element("p"); reply.append(answerNode); }
    answerNode.className = result.answered || guided ? "" : "fallback";
    answerNode.textContent = text;
    if (result.answered && result.notice) reply.append(element("small", "ai-notice", result.notice));
    for (const citation of citations) reply.append(citationCard(citation));
    if (record) {
      commitChatTurn(record, reply, question, message);
      if (!requestedChatView || activeConversation !== record || document.hidden) notifyConversation(record);
      else if (result.answered) celebrate();
      else showAssistant("hold");
      persistConversations();
    } else if (result.answered) celebrate();
    else showAssistant("hold");
  } catch {
    if (!valid()) return;
    if (revise) {
      const stopped = controller?.signal.aborted;
      revise(stopped ? "" : "failed");
      if (visible()) showAssistant(stopped ? "idle" : "error");
      return;
    }
    // 학생이 멈춘 답은 받은 부분까지만 남긴다. 다시 묻지 않고, 오류 문구·다시 시도·새 답변 알림도 내지 않는다.
    if (controller?.signal.aborted) {
      finishThinking();
      const partial = answerNode && answerNode.textContent.trim() ? answerNode.textContent : streamed;
      if (partial && !answerNode) { answerNode = element("p"); answerNode.textContent = partial; reply.append(answerNode); }
      commitChatTurn(record, reply, question, partial ? { role: "answer", text: partial, time: Date.now(), sources: [] } : null);
      persistConversations();
      if (visible()) showAssistant("idle");
      return;
    }
    const retry = element("button", "retry", t("다시 시도"));
    retry.type = "button";
    retry.addEventListener("click", () => {
      if (busy || record?.pending) return;
      input.focus(); void ask(question, reply, record);
    });
    const error = element("div", "error");
    error.append(element("p", null, t("서버 응답을 받지 못했어요.")), retry);
    reply.replaceChildren(error);
    if (record && (!requestedChatView || activeConversation !== record)) {
      record.unread = true;
      record.saved = true;
    }
    else showAssistant("error");
    if (record) persistConversations();
  } finally {
    finishThinking();
    if (!valid()) thinking?.remove();
    if (!record) setBusy(false);
    if (record?.requestNumber === requestNumber) {
      delete record.chatAbort;
      record.pending = false;
    }
    if (valid()) {
      renderConversations(); updateSend();
      if (!revise) scrollToLatest();
    }
  }
}
function commitChatTurn(record, reply, text, answer) {
  const time = Date.now();
  const { turn, question = { role: "question", text, time, sources: [] } } = reply.chatTurn || {};
  const position = record.messages.indexOf(question);
  const committed = record.committedMessages || [];
  const next = position >= 0 && record.messages.slice(position + 1)
    .find(message => message.role === "question" && committed.includes(message));
  const replies = answer ? [answer] : [];
  if (position < 0) record.messages.push(question, ...replies);
  else record.messages.splice(position + 1, 0, ...replies);
  committed.splice(next ? committed.indexOf(next) : committed.length, 0, question, ...replies);
  limitCommittedChatMessages(record, committed, question);
  record.time = time;
  record.saved = true;
  if (turn && !record.photo) setupTurnActions(record, turn, question, answer);
}
// 입력 처리기는 하나다. 필기 패드가 열려 있으면 고친 구간을 따라 열기 전 자리를 옮긴다(#134). 포인터 처리기는 두지 않는다.
input.addEventListener("input", event => {
  updateSend();
  if (typeof noteHandwritingEdit === "function") noteHandwritingEdit(event?.inputType);
});
input.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  // 답을 만드는 동안 보내기 버튼은 정지 버튼이다. Enter는 답을 멈추지도, 같은 대화에 다시 보내지도 않는다(#137).
  // 길게 눌러 되풀이되는 Enter는 보내지 않는다. 정지 버튼에서 Enter를 누른 채로 있으면 멈춘 뒤 초점이 질문 칸으로
  // 옮겨 오는데, 그 뒤 들어오는 반복 키가 적어 둔 초안을 보내면 안 된다.
  if (event.repeat || sendMode === "stop") return;
  if (!send.disabled) composer.requestSubmit();
});

composer.addEventListener("submit", event => {
  event.preventDefault();
  const question = input.value.trim();
  const file = photoFile.files?.[0];
  if (busy || (requestedChatView && activeConversation?.pending) || (!question && !file)) return;
  if (file) {
    // 보낼 수 없는 사진이면 질문도 보내지 않는다. 학생이 첨부를 빼거나 바꾼 뒤 다시 보낸다.
    const rejected = !photoTypes.includes(file.type)
      ? photoRejections[415]
      : file.size > photoMaxBytes ? photoRejections[413] : null;
    if (rejected) {
      say(photoNote, rejected);
      return;
    }
  }

  // 질문을 보내면 쓰던 초안은 끝났다. 같은 대화든 새 대화든 열린 필기 패드와 읽던 요청을 버려,
  // 늦은 인식 글자가 비운 질문 칸(다음 질문의 초안)에 들어가지 않게 한다(#134).
  if (typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  if (!activeConversation || Boolean(activeConversation.photo) !== Boolean(file) || !requestedChatView) {
    activeConversation = { id: `conversation-${Date.now()}-${++conversationSequence}`, time: Date.now(),
      title: Array.from(question).slice(0, 29).join(""), messages: [], turns: [], photo: Boolean(file), unread: false };
    conversations.unshift(activeConversation);
    conversations = conversations.sort((a, b) => b.time - a.time).slice(0, 20);
    if (chatView && requestedChatView) renderActiveConversation();
  }
  const record = activeConversation;
  // 입력 검사를 통과해 전송을 받아들인 이 시점에만 보관을 푼다. 위에서 돌려보낸 전송은 보관을 유지한다.
  if (record.archived === true) { record.archived = false; persistConversations(); }
  const questionMessage = { role: "question", text: question, time: Date.now(), sources: [] };
  record.messages.push(questionMessage);
  if (record.committedMessages) {
    limitCommittedChatMessages(record, record.committedMessages, questionMessage);
  } else record.messages = limitChatMessages(record.messages, questionMessage);
  if (!chatView || !requestedChatView) setChatView(true);
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", t("내 질문: ")));
  if (question) prompt.append(document.createTextNode(question));
  // 파일명은 화면에 적지 않는다. 사진을 붙였다는 사실만 보여 준다.
  if (file) prompt.append(element("span", "attachment", t("사진 1장")));
  const reply = element("div", file ? "reply photo" : "reply");
  if (!file) reply.chatTurn = { turn, question: questionMessage };
  turn.append(prompt, reply, element("small", "reply-author", t("아이오")));
  record.turns.push(turn);
  if (chatView && requestedChatView) {
    empty.remove();
    transcript.append(turn);
  }
  renderConversations();
  input.value = "";
  photoNote.textContent = "";
  scrollToLatest();
  if (!file) {
    void ask(question, reply, record);
    return;
  }
  // 바이트만 잘라 내 들고, 고른 파일은 바로 비운다. 남겨 두면 다음 질문에 같은 사진이 또 실린다.
  const photo = file.slice(0, file.size, file.type);
  const type = file.type;
  photoFile.value = "";
  void runPhotoRequest(record, photoMessages.reading, () => readPhoto(photo, type, question, reply, record));
});

// 클립 버튼은 숨긴 파일 입력의 창을 연다. 요청 중에는 버튼이 잠겨 있지만 한 번 더 막는다.
photoAttach.addEventListener("click", () => {
  if (busy || (requestedChatView && activeConversation?.pending)) return;
  photoFile.click();
});
photoFile.addEventListener("change", () => {
  photoNote.textContent = "";
  updateSend();
});
photoClear.addEventListener("click", () => {
  if (busy || (requestedChatView && activeConversation?.pending)) return;
  photoFile.value = "";
  photoNote.textContent = "";
  updateSend();
});

reset.addEventListener("click", () => {
  if (busy || (requestedChatView && activeConversation?.pending)) return;
  // 입력창을 비우는 새 대화이므로 열린 필기 패드와 읽던 요청도 버린다(#134).
  if (typeof closeHandwritingPad === "function") closeHandwritingPad(false);
  changeFeature(null, { animate: false, focus: false });
  sessionId = null;
  graduationTurn = null;
  transcript.replaceChildren(empty);
  // 고른 사진도 함께 비운다. 남겨 두면 다시 고르지 않아도 같은 사진이 또 전송된다.
  photoFile.value = "";
  photoNote.textContent = "";
  input.value = "";
  showAssistant("idle");
  updateSend();
  input.focus();
});

// 첫 화면의 버튼과 카드. 새 요청을 만들지 않고 이미 있는 기능만 부른다.
// 졸업 체크는 checkGraduation이 요청 중 잠금을 직접 확인하므로 연달아 눌러도 요청은 하나만 나간다.
const landingActions = {
  graduation: () => void checkGraduation(),
  // 숨긴 파일 입력은 초점을 받지 못하므로 초점은 클립 버튼에 둔다. 파일 창은 여기서 한 번만 연다.
  photo: () => { photoAttach.focus(); photoFile.click(); },
  ask: () => input.focus(),
};
for (const control of landingControls) {
  const action = control.dataset?.action;
  if (typeof action !== "string" || !Object.hasOwn(landingActions, action)) continue;
  control.addEventListener("click", () => {
    if (busy) return;
    changeFeature(null, { animate: false, focus: false });
    if (action === "graduation") input.focus();
    landingActions[action]();
  });
}

// 보내기↔정지 모핑(#137). 보내기 버튼 안에 SVG 경로 하나를 두고, 위 화살표와 정지(■) 모양 사이를 오간다.
// 두 모양은 명령 순서(M, L 여섯 번, Z)와 점 개수(7)가 같아 점마다 좌표를 섞으면 된다. iOS Safari는 CSS d 속성
// 애니메이션을 지원하지 않으므로 화면 갱신(requestAnimationFrame)마다 d 값을 다시 쓴다. 진행 중에 방향이 바뀌면
// 지금 섞인 자리에서 반대로 돌아가고, 움직임 줄이기 설정이거나 화면 갱신 함수가 없으면 최종 모양을 바로 그린다.
// 문서의 「보내기」 글자 노드는 그대로 옮겨 언어 바꾸기(translateStatic)가 계속 번역하고, 「답변 멈추기」는 여기서 쓴다.
// 상태는 var로 둔다. updateSend가 이 묶음보다 먼저 불려도 선언 전 접근 오류가 나지 않는다.
var sendGlyph = null;
var sendMode = null;
const sendShapes = {
  send: [[12, 4], [19, 11], [14, 11], [14, 20], [10, 20], [10, 11], [5, 11]],
  stop: [[12, 7], [17, 7], [17, 12], [17, 17], [7, 17], [7, 12], [7, 7]],
};
const sendMorphMs = 180;
function sendPath(progress) {
  const points = sendShapes.send.map(([x, y], index) => {
    const [toX, toY] = sendShapes.stop[index];
    return `${+(x + (toX - x) * progress).toFixed(2)} ${+(y + (toY - y) * progress).toFixed(2)}`;
  });
  return `M${points[0]} ${points.slice(1).map(point => `L${point}`).join(" ")} Z`;
}
function drawSendGlyph() {
  sendGlyph?.path.setAttribute("d", sendPath(sendGlyph.progress));
}
function settleSendGlyph() {
  if (!sendGlyph) return;
  if (sendGlyph.frame !== null) window.cancelAnimationFrame?.(sendGlyph.frame);
  sendGlyph.frame = null;
  sendGlyph.progress = sendGlyph.target;
  drawSendGlyph();
}
function morphSendGlyph(target) {
  const glyph = sendGlyph;
  if (!glyph) return;
  glyph.target = target;
  if (reducedMotion() || typeof window.requestAnimationFrame !== "function") { settleSendGlyph(); return; }
  if (glyph.frame !== null) window.cancelAnimationFrame?.(glyph.frame);
  const from = glyph.progress;
  // 남은 거리에 비례한 시간만 쓴다. 반쯤 간 모양을 되돌리면 절반 시간에 돌아온다.
  const duration = sendMorphMs * Math.abs(target - from);
  let start = null;
  const step = now => {
    if (start === null) start = now;
    const done = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
    glyph.progress = from + (target - from) * (1 - (1 - done) ** 3);
    if (done >= 1) { glyph.progress = target; glyph.frame = null; }
    else glyph.frame = window.requestAnimationFrame(step);
    drawSendGlyph();
  };
  glyph.frame = window.requestAnimationFrame(step);
}
function renderSendMode(stop) {
  const mode = stop ? "stop" : "send";
  if ((sendMode ?? "send") === mode) return;
  sendMode = mode;
  send.setAttribute?.("data-send-mode", mode);
  if (!sendGlyph) return;
  sendGlyph.label.hidden = stop;
  sendGlyph.stopLabel.hidden = !stop;
  morphSendGlyph(stop ? 1 : 0);
}
function setupSendGlyph() {
  if (!send || typeof document.createElementNS !== "function" || typeof send.replaceChildren !== "function" || !send.childNodes) return;
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  for (const [name, value] of [["class", "send-glyph"], ["viewBox", "0 0 24 24"], ["width", "22"], ["height", "22"],
    ["aria-hidden", "true"], ["focusable", "false"]]) svg.setAttribute(name, value);
  const path = document.createElementNS(svgNs, "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  const label = element("span", "sr-only send-label");
  label.append(...Array.from(send.childNodes));
  const stopLabel = element("span", "sr-only send-stop-label", t("답변 멈추기"));
  stopLabel.hidden = true;
  send.replaceChildren(svg, label, stopLabel);
  const stop = sendMode === "stop";
  sendGlyph = { path, label, stopLabel, progress: stop ? 1 : 0, target: stop ? 1 : 0, frame: null };
  label.hidden = stop;
  stopLabel.hidden = !stop;
  drawSendGlyph();
  onLangChange(() => { stopLabel.textContent = t("답변 멈추기"); });
}
// 정지 버튼은 보고 있는 대화의 요청만 끊는다. 보내기(submit)로 이어지지 않게 클릭의 기본 동작을 막는다.
// 끊긴 뒤 보내기 버튼은 잠길 수 있으므로 초점은 질문 칸으로 옮긴다.
function stopActiveAnswer() {
  const controller = requestedChatView ? activeConversation?.chatAbort : null;
  if (!controller) return false;
  controller.abort();
  input.focus?.();
  return true;
}
// 보내기 버튼에 초점을 두고 Enter·Space를 길게 누르면, 첫 입력이 질문을 보내고 버튼이 곧바로 정지 버튼이 된다.
// 이어 들어오는 반복 키가 방금 시작한 답을 멈추지 않게, 반복 키의 기본 동작(click)을 막는다.
send?.addEventListener?.("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.repeat) event.preventDefault?.();
});
send?.addEventListener?.("click", event => {
  if (sendMode !== "stop") return;
  event.preventDefault?.();
  stopActiveAnswer();
});
motionPreference()?.addEventListener?.("change", event => { if (event.matches) settleSendGlyph(); });
setupSendGlyph();
// 보내기↔정지 모핑 끝.

// 손글씨 입력(#134). 펜 버튼이 form 밖의 필기 패드를 연다. 넓은 화면은 입력 줄 바로 위, 좁은 화면은 아래 시트다(chat.css).
// 질문 칸(textarea)에는 처리기·덮개·touch-action을 붙이지 않는다. iPad 기본 손글씨 입력(Scribble)이 그 칸에서 그대로 동작해야 한다.
// 이 패드를 연 동안 펜 입력을 한 번 보면 진행 중인 손가락 획을 지우고 이후 손가락은 무시한다(손바닥 거부).
// 넣기는 잉크 범위에 여백을 두고 잘라 흰 바탕 PNG(긴 변 1024px 이하)로 서버에 보낸다. 그림은 저장하지 않는다.
// 받은 글자는 패드를 열기 전 커서 자리에 넣기만 하고 보내지 않는다. 실패하면 획을 그대로 두어 다시 넣을 수 있다.
const handwritingPath = "/api/v1/handwriting";
const handwritingMaxBytes = 2_000_000;
const handwritingMaxSide = 1024;
const handwritingMargin = 16;
const handwritingTimeoutMs = 30_000;
// 넓은 화면에서 입력 줄 위에 패드를 둘 때 필요한 최소 높이. 필기 칸의 최소 높이(chat.css의 160px)와 같다.
const handwritingMinRoom = 160;
// 좁은 화면에서 위·아래 모두 최소 높이에 못 미칠 때, 화면 아래 시트로 입력 줄을 덮는 대신 더 넓은 쪽에 둘 수 있는 최소 높이.
// 제목과 조작 버튼 한 줄(44px)이 보이고, 나머지는 패드 안에서 스크롤한다.
const handwritingUsableRoom = 96;
const handwritingMessages = {
  reading: "글씨를 읽는 중…",
  unreadable: "글씨를 읽지 못했어요. 또박또박 다시 쓰거나 고쳐 쓴 뒤 다시 넣어 주세요.",
  tooLarge: "글씨 그림이 너무 커요. 일부를 지우고 다시 넣어 주세요.",
  unavailable: "지금은 손글씨를 읽을 수 없어요. 잠시 뒤 다시 넣어 주세요.",
  timeout: "읽는 시간이 너무 오래 걸렸어요. 다시 넣어 주세요.",
  offline: "서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 넣어 주세요.",
  failed: "서버가 글씨를 처리하지 못했어요. 다시 넣어 주세요.",
  inserted: "읽은 글자를 입력창에 넣었어요. 확인한 뒤 보내 주세요.",
};
const handwritingStatusMessages = { 413: "tooLarge", 422: "unreadable", 503: "unavailable", 504: "timeout" };
// 펜은 압력(0~1)으로 굵기를 바꾼다. 압력을 주지 않는 손가락·마우스는 같은 굵기다.
function handwritingWidth(stroke, point) {
  return stroke.type === "pen" ? 1.2 + 4 * point.p : 3;
}
// 화면이 실제로 그리는 굵기. 긋는 동안(pointermove) 선분 굵기를 점의 w에 한 번만 적어 두고, 그리기·자르기·범위 계산이 모두 이 값을 읽는다.
// 예전에는 세 곳이 압력에서 굵기를 따로 다시 계산해(큰 쪽, 평균, 새 점 하나) 서로 어긋났다.
// 칸 경계에서 잘라 만든 점에 새 압력을 붙여도 그 조각의 굵기는 자르기 전 선분 그대로다.
// w가 없는 점(직접 만든 획)은 예전 규칙(점은 제 굵기, 선분은 두 점 평균, 길이 0인 선분은 큰 쪽)으로 계산한다.
function handwritingDrawnWidth(stroke, point, before = null) {
  if (Number.isFinite(point.w)) return point.w;
  if (!before) return handwritingWidth(stroke, point);
  const a = handwritingWidth(stroke, before), b = handwritingWidth(stroke, point);
  return before.x === point.x && before.y === point.y ? Math.max(a, b) : (a + b) / 2;
}
// 점마다 그 점을 찍을 때 보이던 칸(point.clip, 없으면 stroke.clip)을 둔다. 좌표는 캔버스 CSS 픽셀이다.
// 칸은 왼쪽 0부터 오른쪽 끝 width까지, 위 y(없으면 0)부터 아래 끝 height까지다. 패드 스크롤 상자가 캔버스 위·아래를
// 가리면 보이는 칸은 캔버스 전체가 아니라 가운데 띠가 된다(가로는 캔버스 폭이 100%라 가려지지 않는다).
const handwritingClipOf = (stroke, point) => point.clip ?? stroke.clip ?? null;
const handwritingTop = rect => rect?.y ?? 0;
// 넓이가 없는 칸(겹치지 않는 두 띠의 교집합 등). 이런 칸에는 아무것도 그리지 않는다.
// 높이가 음수인 사각형을 그대로 clip()에 넘기면 캔버스가 위아래를 뒤집어 그 틈에 잉크를 그린다.
const handwritingEmpty = rect => Boolean(rect) && (rect.width <= 0 || rect.height <= handwritingTop(rect));
// 두 칸이 겹치는 부분.
function handwritingClipMeet(a, b) {
  if (a === b || !b) return a;
  if (!a) return b;
  return { y: Math.max(handwritingTop(a), handwritingTop(b)), width: Math.min(a.width, b.width), height: Math.min(a.height, b.height) };
}
// 획 하나를 그린다. from을 주면 그 점부터 이어 그린다(움직이는 동안 새 조각만 그리기).
// 선분마다 그을 때 보이던 칸을 캔버스 clip()으로 걸고 그린다. 화면과 보내는 그림이 같은 칸으로 잘리므로,
// 그 뒤 칸이 넓어져도(긋는 도중이어도) 그을 때 보이지 않던 픽셀(둥근 끝, 굵기 절반이 경계 밖으로 나간 부분 포함)은 나타나지 않는다.
// 첫 점과 gap 점(다시 시작한 자리)은 그 점의 굵기로 점을 찍는다. 펜을 세게 눌러 시작하면 첫 점이 뒤 선보다 굵기 때문이다.
function drawHandwritingStroke(context, stroke, from = 0) {
  const points = stroke.points;
  let current, saved = false;
  const use = clip => {
    if (clip === current) return;
    if (saved) context.restore();
    saved = false; current = clip;
    if (!clip) return;
    context.save(); saved = true;
    context.beginPath();
    context.rect(0, handwritingTop(clip), Math.max(0, clip.width), Math.max(0, clip.height - handwritingTop(clip)));
    context.clip();
  };
  for (let index = from; index < points.length; index++) {
    const point = points[index];
    if (index === 0 || point.gap) {
      use(handwritingClipOf(stroke, point));
      context.beginPath();
      context.arc(point.x, point.y, handwritingDrawnWidth(stroke, point) / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    const before = points[index - 1];
    // 선분은 끝 점을 찍을 때(그 선분을 그을 때)의 칸으로 자른다. 칸을 넓힌 뒤 그은 선분은 앞 점이 옛 칸 경계에 붙어 있어도 새 칸에서 온전히 보인다.
    use(handwritingClipOf(stroke, point));
    // 좌표는 그대로이고 압력만 바뀐 신호는 길이 0인 선이다. 캔버스는 길이 0인 선을 그리지 않으므로 점으로 찍는다.
    if (before.x === point.x && before.y === point.y) {
      context.beginPath();
      context.arc(point.x, point.y, handwritingDrawnWidth(stroke, point, before) / 2, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.lineWidth = handwritingDrawnWidth(stroke, point, before);
    context.beginPath();
    context.moveTo(before.x, before.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  if (saved) context.restore();
}
// 잉크 범위(굵기 절반 포함)에 여백을 더한 상자. 좌표는 캔버스의 CSS 픽셀이다.
// area(보이는 필기 칸)를 주면 그 안의 잉크만 센다. 획이 칸 밖으로 나갔다 돌아와도 화면에서 잘린 부분은 보내지 않는다.
// 칸 밖으로 나간 선분은 잘라 보이는 부분만 센다(Liang–Barsky 선분 자르기). 바깥 점이 범위를 늘리지 않는다.
// 잉크는 중심선에서 굵기 절반(half)만큼 퍼지므로, 칸을 그만큼 넓힌 상자로 자른다. 중심선이 칸 바로 밖이어도 칸 안에 보이는 잉크는 남는다.
function clipHandwritingSegment(from, to, area, half = 0) {
  if (handwritingEmpty(area)) return null;
  const dx = to.x - from.x, dy = to.y - from.y;
  let enter = 0, leave = 1;
  const y0 = handwritingTop(area);
  for (const [p, q] of [[-dx, from.x + half], [dx, area.width + half - from.x], [-dy, from.y - y0 + half], [dy, area.height + half - from.y]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const ratio = q / p;
    if (p < 0) { if (ratio > leave) return null; enter = Math.max(enter, ratio); }
    else { if (ratio < enter) return null; leave = Math.min(leave, ratio); }
  }
  return [{ x: from.x + enter * dx, y: from.y + enter * dy }, { x: from.x + leave * dx, y: from.y + leave * dy }];
}
// 중심 좌표가 칸 안(경계 포함)인지. 칸이 없으면 안으로 본다.
const handwritingInside = (point, rect) => !rect || (point.x >= 0 && point.y >= handwritingTop(rect) && point.x <= rect.width && point.y <= rect.height);
// 점(원)과 칸 사이 거리. 칸 안이면 0이다.
function handwritingRectDistance(point, rect) {
  const dx = Math.max(-point.x, 0, point.x - rect.width), dy = Math.max(handwritingTop(rect) - point.y, 0, point.y - rect.height);
  return Math.hypot(dx, dy);
}
// 반지름 half로 그린 점·선분이 칸 안에 픽셀을 하나라도 남기는지. 굵기를 상자로 넓혀 따지면 모서리 근처의
// 보이지 않는 잉크도 있다고 보므로, 칸까지의 실제 거리가 반지름보다 짧을 때만 보인다고 본다.
function handwritingInkVisible(from, to, half, rect) {
  if (!rect) return true;
  if (handwritingEmpty(rect)) return false;
  if (clipHandwritingSegment(from, to, rect, 0)) return true;
  if (handwritingRectDistance(from, rect) < half || handwritingRectDistance(to, rect) < half) return true;
  const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
  if (!length) return false;
  const y0 = handwritingTop(rect);
  for (const corner of [{ x: 0, y: y0 }, { x: rect.width, y: y0 }, { x: 0, y: rect.height }, { x: rect.width, y: rect.height }]) {
    const t = Math.min(1, Math.max(0, ((corner.x - from.x) * dx + (corner.y - from.y) * dy) / length));
    if (Math.hypot(from.x + t * dx - corner.x, from.y + t * dy - corner.y) < half) return true;
  }
  return false;
}
function handwritingBounds(strokes, area = null) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  // 점·선분마다 그을 때 보이던 칸 안으로 범위를 가둔다. 그릴 때 같은 칸으로 clip()하므로 범위도 같은 칸을 넘지 않는다.
  let clip = null;
  // 점의 잉크 상자(굵기 절반)가 칸과 닿으면 칸 안으로 눌러 넣어 센다. 경계에 정확히 닿은 점(경계에서 잘라 저장한 점)은
  // 폭이 0이 되어도 범위를 경계까지 늘려야 하므로 빼지 않는다. 칸과 전혀 겹치지 않는 점만 뺀다.
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const add = (point, half) => {
    let x0 = point.x - half, y0 = point.y - half, x1 = point.x + half, y1 = point.y + half;
    if (clip) {
      if (handwritingEmpty(clip)) return;
      const clipTop = handwritingTop(clip);
      if (x0 > clip.width || y0 > clip.height || x1 < 0 || y1 < clipTop) return;
      x0 = clamp(x0, 0, clip.width); x1 = clamp(x1, 0, clip.width); y0 = clamp(y0, clipTop, clip.height); y1 = clamp(y1, clipTop, clip.height);
    }
    left = Math.min(left, x0); top = Math.min(top, y0);
    right = Math.max(right, x1); bottom = Math.max(bottom, y1);
  };
  for (const stroke of strokes) {
    const points = stroke.points;
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      // 범위를 가두는 칸은 그 점·선분을 그을 때의 칸과 지금 보이는 칸이 겹치는 곳이다.
      // 반지름은 drawHandwritingStroke와 같은 함수(handwritingDrawnWidth)로 읽는다.
      // 첫 점과 gap 점은 그 점의 굵기로 찍은 점이고, 선분은 끝 점의 칸으로 자른다(drawHandwritingStroke와 같다).
      const before = index === 0 || point.gap ? point : points[index - 1];
      clip = handwritingClipMeet(handwritingClipOf(stroke, point), area);
      const half = handwritingDrawnWidth(stroke, point, before === point ? null : before) / 2;
      if (!handwritingInkVisible(before, point, half, clip)) continue;
      const piece = clip ? clipHandwritingSegment(before, point, clip, half) : [before, point];
      for (const end of piece ?? [before, point]) add(end, half);
    }
  }
  if (area) {
    left = Math.max(left, 0); top = Math.max(top, handwritingTop(area));
    right = Math.min(right, area.width); bottom = Math.min(bottom, area.height);
  }
  if (!Number.isFinite(left) || right <= left || bottom <= top) return null;
  return { x: left - handwritingMargin, y: top - handwritingMargin,
    width: right - left + 2 * handwritingMargin, height: bottom - top + 2 * handwritingMargin };
}
// 흰 바탕에 검은 잉크로 다시 그려 PNG로 만든다. 화면 테마와 상관없이 같은 그림이 나간다.
// 배율은 기기 화소 비율을 따르되 긴 변이 1024px를 넘지 않게 줄인다. 잉크는 보이는 필기 칸(area) 안만 그린다.
function handwritingImage(strokes, pixelRatio, area, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  const box = handwritingBounds(strokes, area);
  if (!box) return Promise.resolve(null);
  const scale = Math.min(pixelRatio, handwritingMaxSide / Math.max(box.width, box.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(handwritingMaxSide, Math.max(1, Math.round(box.width * scale)));
  canvas.height = Math.min(handwritingMaxSide, Math.max(1, Math.round(box.height * scale)));
  const context = canvas.getContext?.("2d");
  if (!context || typeof canvas.toBlob !== "function") return Promise.resolve(null);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  if (area) {
    context.beginPath();
    context.rect(0, handwritingTop(area), Math.max(0, area.width), Math.max(0, area.height - handwritingTop(area)));
    context.clip();
  }
  context.fillStyle = "#000000"; context.strokeStyle = "#000000";
  context.lineCap = "round"; context.lineJoin = "round";
  for (const stroke of strokes) drawHandwritingStroke(context, stroke);
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      canvas.toBlob(blob => {
        cleanup();
        resolve(blob);
      }, "image/png");
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
function setupHandwriting() {
  const find = id => document.querySelector(`#handwriting-${id}`);
  const button = find("button"), pad = find("pad"), canvas = find("canvas"), status = find("status");
  const undo = find("undo"), clear = find("clear"), cancel = find("cancel"), insert = find("insert");
  if (![button, pad, canvas, status, undo, clear, cancel, insert].every(node => typeof node?.addEventListener === "function")) return;
  let opened = false, strokes = [], penSeen = false, reading = null, session = 0, selection = null, context = null, box = null, origin = null, ink = null, owner = null;
  let area = null, undoRanges = [], redoRanges = [], side = "above";
  // 질문 칸에 입력이 들어오기 직전(beforeinput)의 선택 범위와 글. 이번 편집이 바꿀 범위다(noteEdit 참고).
  let pendingEdit = null;
  const active = new Map();
  function controls() {
    const blank = strokes.length === 0, waiting = Boolean(reading);
    undo.disabled = blank || waiting;
    clear.disabled = blank || waiting;
    insert.disabled = blank || waiting;
    // 대화 상자 전체에 aria-busy를 걸지 않는다. 걸면 읽기 도구가 안의 상태 줄 안내를 미룰 수 있다.
  }
  function show(message, error = false) {
    say(status, message || "");
    status.classList?.toggle("is-error", Boolean(message) && error);
    // 상태 줄이 생기거나 사라지면 패드 높이가 바뀌므로 자리를 다시 잰다.
    if (opened) place();
  }
  // 화면 잉크는 캔버스 글자색(--ink)이다. 테마가 바뀌어 색이 달라지면 이미 쓴 획도 새 색으로 다시 그린다.
  const inkColor = () => window.getComputedStyle?.(canvas)?.color || "#0A2540";
  function paint() {
    if (!context) return;
    ink = inkColor();
    context.strokeStyle = ink; context.fillStyle = ink;
    context.lineCap = "round"; context.lineJoin = "round";
  }
  // 지금 보이는 필기 칸(CSS 픽셀). 크기가 같으면 같은 객체를 돌려줘, 같은 칸에서 찍은 점끼리 clip()을 한 번만 건다.
  const visibleArea = () => area;
  function redraw() {
    if (!context) return;
    // 보이는 칸이 캔버스보다 작을 수 있어(패드 스크롤) 캔버스 전체를 지운다.
    context.clearRect(0, 0, box?.width || canvas.width, box?.height || canvas.height);
    paint();
    for (const stroke of strokes) drawHandwritingStroke(context, stroke);
  }
  // 점은 캔버스 왼쪽 위 기준 CSS 픽셀로 저장하고 바꾸지 않는다. 칸 크기가 바뀌어도 배율을 곱하지 않아,
  // 600px 칸의 x=110 점은 400px로 줄여도 x=110에 그대로 있고, 지금 칸 밖으로 나간 부분만 잘려 보이지 않는다(보내지도 않는다).
  // 칸을 다시 넓히면 그을 때 보이던 부분까지만 다시 보인다(점마다 저장한 칸으로 clip()).
  // 긋는 도중 칸이 넓어져도 이미 저장한 점의 칸은 넓히지 않는다. 그 뒤에 찍는 점부터 새 칸을 쓴다.
  // 칸 크기가 바뀌어도 그리던 획은 끝내지 않는다. 그 뒤 브라우저가 포인터를 취소하면(pointercancel) 그 획을 찾아 버릴 수 있어야 한다.
  // 캔버스 화소는 보이는 크기 × 기기 화소 비율이다.
  // 보이는 칸 = 캔버스 ∩ 패드의 스크롤 상자 안쪽 ∩ 화면(세로). 패드 높이가 모자라 안쪽이 스크롤되면 캔버스 위·아래가 가려지는데,
  // 그 부분에 쓴 잉크는 학생이 볼 수 없으므로 기록하지도 보내지도 않는다. 값이 같으면 같은 객체를 그대로 둔다.
  // 캔버스가 화면 밖이거나 모두 가려지면 크기 0인 칸이 되어 어떤 잉크도 보이지 않는다.
  function measureArea() {
    if (!(box?.width > 0 && box?.height > 0)) { area = null; return false; }
    const shell = pad.getBoundingClientRect?.();
    const innerTop = shell ? shell.top + (Number(pad.clientTop) || 0) : -Infinity;
    const innerBottom = shell ? (Number.isFinite(pad.clientHeight) && pad.clientHeight > 0 ? innerTop + pad.clientHeight : shell.bottom) : Infinity;
    const screenBottom = window.innerHeight > 0 ? window.innerHeight : Infinity;
    const y = Math.max(0, innerTop - box.top, -box.top);
    const height = Math.max(y, Math.min(box.height, innerBottom - box.top, screenBottom - box.top));
    if (area && handwritingTop(area) === y && area.width === box.width && area.height === height) return false;
    area = y > 0 ? { y, width: box.width, height } : { width: box.width, height };
    return true;
  }
  function prepare() {
    box = canvas.getBoundingClientRect?.() ?? null;
    measureArea();
    origin = box ? { left: box.left, top: box.top } : null;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round((box?.width || 0) * ratio));
    canvas.height = Math.max(1, Math.round((box?.height || 0) * ratio));
    context = canvas.getContext?.("2d") ?? null;
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }
  // 넓은 화면에서 입력 줄 바로 위에 놓는다(자세한 규칙은 아래). 좁은 화면은 CSS가 아래 시트로 덮어쓴다.
  // allowBelow는 학생이 패드를 연 뒤 스크롤·창 크기·입력 줄 크기를 바꿔 자리를 다시 잴 때만 참이다.
  function place(allowBelow = side === "below") {
    const row = document.querySelector(".composer-row")?.getBoundingClientRect?.();
    const height = window.innerHeight || 0;
    if (!row || !(row.width > 0) || !height) return;
    pad.style?.setProperty("--handwriting-x", `${Math.max(8, row.left)}px`);
    pad.style?.setProperty("--handwriting-width", `${row.width}px`);
    // 수용 조건대로 넓은 화면에서는 패드를 입력 줄 위(8px 띄움)에 연다. 위쪽이 필기 칸 최소 높이(160px)보다 좁으면
    // 열 때 문서를 위로 굴려 자리를 만든다(makeRoom). 실제 화면에서는 입력 줄 위에 머리글(76px 이상)이 있어 대개 자리가 난다.
    // 위에 놓을 때는 아래 끝(bottom)을 입력 줄 위 8px에 묶되 화면 안(위아래 8px)에 가두고,
    // 최대 높이는 입력 줄 위쪽 남은 높이와 화면 안 남은 높이 중 작은 쪽이다. 상태 줄이 생겨 커져도 입력 줄을 덮지 않는다.
    // 연 뒤 학생이 스크롤해 입력 줄이 화면 위쪽에 붙어 위쪽이 최소 높이보다 좁아지고 아래쪽이 더 넓으면, 그때만 줄 아래(top 고정)로 옮긴다.
    // 스크롤 중에 문서를 대신 굴리면 학생의 스크롤과 다투므로, 패드를 옮겨 필기 칸과 버튼이 0px로 접히지 않게 한다.
    // 줄 아래에 둘 때는 입력 줄 바로 아래의 첨부 조작(「첨부 제거」 버튼)까지 비운다. 입력 줄 아래 끝만 재면 시트가 그 버튼을 덮었다.
    const controlsBottom = attachControlsBottom(row);
    const above = row.top - 16, below = height - controlsBottom - 16;
    const putBelow = () => {
      side = "below";
      const top = Math.min(height - 8, Math.max(8, controlsBottom + 8));
      pad.style?.setProperty("--handwriting-bottom", "auto");
      pad.style?.setProperty("--handwriting-top", `${top}px`);
      pad.style?.setProperty("--handwriting-max-height", `${Math.max(0, height - top - 8)}px`);
    };
    // 좁은 화면(680px 이하) 시트는 폭 전체를 쓰고, 입력 줄을 덮지 않게 다음 순서로 놓는다(열 때 문서를 굴려 자리를 만든 뒤 잰다, makeRoom).
    // 1) 입력 줄 위쪽이 최소 높이(160px) 이상이면 줄 바로 위. 2) 아니고 아래쪽이 최소 높이 이상이면 줄 바로 아래.
    // 3) 둘 다 모자라면 예전처럼 화면 아래 시트(아래 안전 영역만큼 띄움). 위·아래에 둘 때는 입력 줄이 안전 영역을 비우므로 아래 여백 14px다.
    // 예전에는 좁은 화면에서 늘 줄 위에 두어, 입력 줄이 화면 위 20px에 있으면 시트 최대 높이가 4px로 접혔다.
    // 위·아래 모두 160px에 못 미쳐도 더 넓은 쪽이 쓸 만하면(96px 이상: 제목·버튼 한 줄이 보이고 나머지는 패드 안에서 스크롤) 그쪽에 둔다.
    // 화면 아래 시트는 질문 칸과 「첨부 제거」 버튼을 덮으므로, 위·아래 어디에도 쓸 만한 자리가 없을 때만 쓴다.
    // 예전에는 둘 다 160px 미만이면 곧장 화면 아래 시트로 가, 질문 칸을 늘리고 사진을 붙인 390×500에서 입력 줄을 덮었다.
    const narrow = (window.innerWidth || 0) <= 680;
    if (narrow) {
      const roomy = side => side >= handwritingMinRoom || (Math.max(above, below) >= handwritingUsableRoom && side === Math.max(above, below));
      if (!roomy(above) && roomy(below)) {
        pad.style?.setProperty("--handwriting-sheet-padding", "14px");
        putBelow();
        return;
      }
      if (!roomy(above)) {
        side = "sheet";
        pad.style?.removeProperty("--handwriting-sheet-padding");
        pad.style?.setProperty("--handwriting-top", "auto");
        pad.style?.setProperty("--handwriting-bottom", "0px");
        pad.style?.setProperty("--handwriting-max-height", `${Math.max(0, height - 16)}px`);
        return;
      }
      pad.style?.setProperty("--handwriting-sheet-padding", "14px");
    } else if (allowBelow && above < handwritingMinRoom && below > above) {
      putBelow();
      return;
    }
    side = "above";
    const bottom = Math.min(height - 8, Math.max(8, height - row.top + 8));
    pad.style?.setProperty("--handwriting-top", "auto");
    pad.style?.setProperty("--handwriting-bottom", `${bottom}px`);
    pad.style?.setProperty("--handwriting-max-height", `${Math.max(0, Math.min(above, height - bottom - 8))}px`);
  }
  // 넓은 화면에서 입력 줄 위쪽이 최소 높이보다 좁고 문서가 아래로 굴러가 있으면, 모자란 만큼 위로 굴려 입력 줄 위에 자리를 만든다.
  // 여는 순간에만 한 번 한다(스크롤할 때마다 하면 학생의 스크롤과 다툰다). 좁은 화면에서도 한다(아래 makeRoom 참고).
  // 입력 줄의 자리·크기와 캔버스 크기를 한 줄로 적어 둔 값. 크기 감시 알림이 실제 변화인지 가를 때 쓴다.
  let padLayout = "";
  // 입력 줄 아래 끝과, 보이는 「첨부 제거」 버튼 아래 끝 중 아래쪽. 첨부를 붙이면 이 버튼이 입력 줄 바로 아래에 나타난다.
  function attachControlsBottom(row) {
    const clear = !photoClear?.hidden ? photoClear?.getBoundingClientRect?.() : null;
    return clear?.height > 0 ? Math.max(row.bottom, clear.bottom) : row.bottom;
  }
  function layoutKey() {
    const row = document.querySelector(".composer-row")?.getBoundingClientRect?.();
    const own = canvas.getBoundingClientRect?.();
    // 첨부 제거 버튼이 나타나거나 사라져도(입력 줄 자리는 그대로일 수 있다) 줄 아래 자리가 바뀌므로 함께 적는다.
    return [row?.left, row?.top, row?.width, row?.height, row ? attachControlsBottom(row) : "", own?.width, own?.height, window.innerWidth, window.innerHeight, window.devicePixelRatio].join();
  }
  function layoutChanged() {
    const key = layoutKey();
    if (key === padLayout) return false;
    padLayout = key;
    return true;
  }
  // 연 뒤 자리를 다시 재는 길은 이 함수 하나다. 문서·패드 안쪽 스크롤, 크기 감시 알림(첫 알림 포함), 창 크기 변화,
  // 질문 칸 입력·첨부 변화가 모두 여기로 온다. 입력 줄 자리·크기, 캔버스 크기, 창 크기가 마지막으로 잰 값과 같으면
  // 아무것도 하지 않는다. 신호마다 따로 비교를 붙이다 빠뜨리면, 바뀐 것 없이 패드가 줄 아래로 옮겨 가는 결함이 되풀이됐다.
  function relayout() {
    if (!opened) return;
    if (layoutChanged()) { place(true); prepare(); return; }
    // 자리는 그대로여도 패드 안쪽 스크롤로 캔버스의 보이는 띠가 바뀔 수 있다. 패드는 옮기지 않고 보이는 칸만 다시 잰다.
    const rect = canvas.getBoundingClientRect?.();
    if (rect) { box = rect; origin = { left: rect.left, top: rect.top }; if (measureArea()) redraw(); }
  }
  // 좁은 화면도 같다. 입력 줄이 화면 위쪽에 붙어 있으면 먼저 굴려 시트를 줄 위에 둘 자리를 만들고, 그래도 모자랄 때만 줄 아래·화면 아래로 놓는다.
  function makeRoom() {
    const row = document.querySelector(".composer-row")?.getBoundingClientRect?.();
    const scrolled = Number(window.scrollY) || 0;
    if (!row || scrolled <= 0) return;
    const deficit = handwritingMinRoom - (row.top - 16);
    if (deficit > 0) window.scrollBy?.(0, -Math.min(deficit, scrolled));
  }
  function openPad() {
    if (opened) { canvas.focus(); return; }
    opened = true; session++;
    strokes = []; active.clear(); penSeen = false; reading = null; box = null; area = null;
    selection = caret();
    undoRanges = []; redoRanges = []; side = "above";
    // 패드는 연 순간의 계정·대화에 묶인다. 그 뒤 대화가 바뀌면(사진을 붙여 새 대화로 보낸 경우 등) 넣기 전에 버린다.
    owner = { account: historyAccount, conversation: activeConversation };
    pad.hidden = false;
    button.setAttribute("aria-expanded", "true");
    show("");
    makeRoom(); place(); prepare(); controls();
    padLayout = layoutKey();
    canvas.focus();
  }
  // 닫으면 읽던 요청을 끊고, 늦게 온 응답은 회차(session)가 달라 버린다.
  function closePad(restore = true) {
    if (!opened) return;
    opened = false; session++;
    reading?.abort(); reading = null;
    for (const id of active.keys()) if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture?.(id);
    active.clear(); strokes = []; penSeen = false;
    context?.clearRect(0, 0, visibleArea()?.width || canvas.width, visibleArea()?.height || canvas.height);
    pad.hidden = true;
    button.setAttribute("aria-expanded", "false");
    show(""); controls();
    // 좁은 화면에서 빠른 실행 링(quick-actions.js)을 켜면 펜 버튼이 링 안으로 들어가 줄에서 숨는다(#137).
    // 그때는 패드를 연 링의 + 버튼으로 초점을 돌린다. 그 밖에는 늘 펜 버튼이다.
    if (restore) {
      const shown = typeof button.getClientRects !== "function" || button.getClientRects().length > 0;
      (shown ? button : document.querySelector(".quick-toggle") ?? button).focus();
    }
  }
  // 커서 자리. 패드를 열기 전에 적어 두어, 패드로 초점이 옮겨 가도 그 자리에 넣는다.
  function caret() {
    const length = input.value.length;
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    return { start, end, value: input.value };
  }
  // 패드를 연 사이 질문 칸의 글이 바뀌었으면 열기 전 자리를 새 글 위에서 다시 찾는다. 지금 커서는 쓰지 않는다.
  // 후보 자리마다 "열기 전 범위 바로 앞 글자(32자까지)가 후보 앞과 얼마나 이어지는가 + 바로 뒤 글자가 후보 뒤와 얼마나 이어지는가"를 센다.
  // 고른 글자가 있으면 같은 글자가 나오는 곳만, 커서만 있었으면 모든 자리가 후보다. 가장 많이 이어지는 곳을 고르고, 같으면 원래 자리에 가까운 곳이다.
  // 그래서 양끝을 고치거나 같은 말을 앞에 새로 붙여도 원래 범위 쪽을 찾는다. 이어지는 글자가 하나도 없을 때만 아래 공통 부분 방식으로 옮긴다.
  function savedRange() {
    const before = selection?.value ?? input.value, after = input.value;
    const start = Math.min(selection?.start ?? after.length, before.length);
    const end = Math.min(Math.max(selection?.end ?? start, start), before.length);
    if (before === after) return { start, end };
    const picked = before.slice(start, end);
    const left = before.slice(Math.max(0, start - 32), start), right = before.slice(end, end + 32);
    const sameEnd = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; };
    const sameStart = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n; };
    let best = -1, bestScore = 0;
    for (let at = 0; at + picked.length <= after.length; at++) {
      if (picked && !after.startsWith(picked, at)) continue;
      const score = sameEnd(left, after.slice(Math.max(0, at - 32), at)) + sameStart(right, after.slice(at + picked.length, at + picked.length + 32));
      // 앞뒤 글자로도 가를 수 없는 동점(같은 글이 통째로 반복될 때)은 늘어난 글이 범위 앞에 붙었다고 보고,
      // 원래 자리에서 길이 차만큼 민 곳에 가까운 후보를 고른다.
      const guess = start + after.length - before.length;
      if (score > bestScore || (score === bestScore && best >= 0 && Math.abs(at - guess) < Math.abs(best - guess))) { best = at; bestScore = score; }
    }
    // 고른 글자는 찾았는데 앞뒤가 하나도 안 이어지면, 같은 글자 가운데 원래 자리에 가까운 곳을 쓴다.
    if (best < 0 && picked) {
      for (let at = after.indexOf(picked); at >= 0; at = after.indexOf(picked, at + 1)) {
        if (best < 0 || Math.abs(at - start) < Math.abs(best - start)) best = at;
      }
    }
    if (best >= 0) return { start: best, end: best + picked.length };
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
    let suffix = 0;
    while (suffix < before.length - prefix && suffix < after.length - prefix &&
      before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
    const move = position => position <= prefix ? position
      : position >= before.length - suffix ? position + after.length - before.length
        : after.length - suffix;
    return { start: move(start), end: move(end) };
  }
  // 패드가 열린 동안 질문 칸에서 글이 바뀔 때마다(키보드·Scribble 모두 input 이벤트) 적어 둔 자리를 옮긴다.
  // 글자 비교만으로는 같은 글을 앞에 붙였는지 뒤에 붙였는지 가를 수 없어, 고친 직후의 커서를 기준으로 삼는다.
  // 커서 뒤 글자는 이번 편집에서 그대로이므로 공통 끝 부분을 커서 뒤까지만 인정하고, 공통 앞 부분은 그 나머지 안에서만 센다.
  // 실행 취소·다시 실행은 브라우저가 알려 주는 입력 종류(inputType의 historyUndo·historyRedo)로만 알아본다.
  // 같은 글이 다시 나왔다는 것만으로 되돌리면, 앞에 A를 붙이고 끝의 A를 지운 보통 편집도 실행 취소로 잘못 본다.
  // 보통 편집 때마다 직전 범위를 실행 취소 목록에 쌓고(아래 noteEdit 끝), 실행 취소는 거기서 꺼내 다시 실행 목록으로 옮긴다.
  // 브라우저는 이어 친 삭제처럼 여러 편집을 한 번에 되돌리기도 하므로, 맨 위 하나가 아니라 지금 글과 같은 기록을
  // 위에서부터 찾아 그 범위로 돌아간다. 건너뛴 중간 기록은 브라우저도 다시 실행으로 들르지 않으므로 버린다.
  // 같은 글이 없으면 아래 보통 방식으로 옮긴다.
  function noteEdit(inputType) {
    // 입력 직전에 받아 둔 범위는 이번 편집에만 쓴다(어느 길로 끝나든 비운다).
    const announced = pendingEdit;
    pendingEdit = null;
    if (!opened || !selection) return;
    const before = selection.value, after = input.value;
    // 글이 그대로여도 브라우저가 교체 범위를 알려 줬으면 편집이다. 「B」를 골라 같은 「B」를 붙여넣으면 글은 같지만
    // 고른 글자는 새 글자로 바뀌었으므로 범위를 접어야 한다(예전에는 여기서 끝나 새로 붙인 B를 지웠다).
    const replacedSame = before === after && announced && announced.value === before && announced.end > announced.start;
    if (before === after && !replacedSame) return;
    const history = inputType === "historyUndo" ? [undoRanges, redoRanges] : inputType === "historyRedo" ? [redoRanges, undoRanges] : null;
    if (history) {
      const [from, to] = history;
      // 직전 범위는 기록에서 찾든 못 찾든 반대쪽 목록에 먼저 쌓는다. 패드를 열기 전 글로 실행 취소한 뒤 다시 실행해도
      // 돌아올 범위가 남는다(그 이전 글은 패드가 본 적이 없어 기록에 없다).
      to.push({ ...selection });
      const index = from.map(entry => entry.value).lastIndexOf(after);
      if (index >= 0) {
        const saved = from[index];
        from.length = index;
        selection = { ...saved };
        return;
      }
    }
    // 바뀐 구간: 옛 글 [prefix, editEnd) → 새 글 [prefix, prefix + added).
    // 브라우저가 입력 직전(beforeinput)에 알려 준 질문 칸의 선택 범위가 곧 바뀔 범위다. 이 값이 있으면 그대로 쓴다.
    // 글자 비교만으로는 「B를 골라 BXY를 붙여넣기」와 「B 뒤에 XY 쓰기」처럼 결과 글이 같은 편집을 가를 수 없어,
    // 새로 붙인 B를 옛 B로 보고 지웠다. 선택 없이 지우는 편집(Backspace 등)은 브라우저가 지울 범위를 미리 알려 주지 않으므로 글자 비교로 찾는다.
    const target = announced && announced.value === before ? announced : null;
    const known = target && (target.end > target.start || /^insert/.test(inputType || ""))
      ? { prefix: target.start, editEnd: target.end, added: after.length - before.length + (target.end - target.start) } : null;
    let prefix, editEnd, added;
    if (known && known.added >= 0 && known.prefix + known.added <= after.length
      && after.slice(0, known.prefix) === before.slice(0, known.prefix)
      && after.slice(known.prefix + known.added) === before.slice(known.editEnd)) {
      ({ prefix, editEnd, added } = known);
    } else {
      const caretAt = Number.isInteger(input.selectionEnd) ? Math.min(input.selectionEnd, after.length) : after.length;
      let suffix = 0;
      while (suffix < before.length && suffix < after.length - caretAt &&
        before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
      prefix = 0;
      while (prefix < before.length - suffix && prefix < after.length - suffix && before[prefix] === after[prefix]) prefix++;
      editEnd = before.length - suffix; added = after.length - suffix - prefix;
    }
    const inserted = prefix === editEnd;
    // 경계에 끼워 넣은 글은 고른 범위 밖이다. 범위 시작에서 넣으면 시작을 넣은 글 뒤로, 범위 끝에서 넣으면 끝을 넣은 글 앞에 둔다.
    // 커서만 있었으면 넣은 글 뒤에 둔다(이어 쓴 글 다음에 손글씨가 온다).
    const move = (position, edge) => {
      if (position < prefix) return position;
      if (position > editEnd) return position + after.length - before.length;
      if (inserted) return edge === "end" ? prefix : prefix + added;
      return position === prefix ? prefix : prefix + added;
    };
    const collapsed = selection.start === selection.end;
    const previous = selection;
    // 편집이 고른 범위 안쪽을 건드렸으면 범위를 넓히지 않고 바뀐 구간 끝 한 점으로 접어, 새로 쓴 글을 지우지 않고 그 뒤에 넣는다.
    // - 고른 글자 일부라도 지운 편집(바뀐 옛 구간 [prefix, editEnd)와 고른 범위가 겹침): 「ABCD」에서 B를 고른 뒤 BC를 XY로 바꾸면
    //   OCR을 넣어 「AXYOCRD」다(예전에는 XY까지 지워 「AOCRD」).
    // - 고른 범위 안쪽에 끼워 넣은 글(경계가 아닌 자리): 「ABCD」에서 BC를 고른 뒤 B와 C 사이에 X를 쓰면 「ABX가상CD」다
    //   (예전에는 범위가 BXC로 늘어 X까지 지워 「A가상D」). 경계에 끼워 넣은 글은 예전처럼 범위 밖으로 둔다.
    const overlaps = !collapsed && (inserted
      ? prefix > selection.start && prefix < selection.end
      : prefix < selection.end && editEnd > selection.start);
    if (overlaps) selection = { start: prefix + added, end: prefix + added, value: after };
    else {
      const start = move(selection.start, "start");
      selection = { start, end: collapsed ? start : Math.max(start, move(selection.end, "end")), value: after };
    }
    if (history) return;
    // 편집마다 직전 글과 범위를 모두 쌓는다. 브라우저가 실행 취소를 어떻게 묶는지(이어 친 삭제, 커서 이동, Delete·Backspace)는
    // 추측하지 않는다. 브라우저가 몇 개를 한 번에 되돌려도 돌아간 글은 반드시 이 기록 가운데 하나라, 위에서 같은 글을 찾으면 된다.
    // 상한(1,000개)을 넘으면 맨 앞(패드를 열 때의 범위)은 남기고 가장 오래된 중간 기록부터 버린다.
    undoRanges.push({ ...previous });
    if (undoRanges.length > 1000) undoRanges.splice(1, 1);
    redoRanges = [];
  }
  function placeText(text) {
    const spot = savedRange();
    const length = input.value.length;
    const start = Math.min(spot.start, length);
    const end = Math.min(Math.max(spot.end, start), length);
    if (typeof input.setRangeText === "function") input.setRangeText(text, start, end, "end");
    else {
      input.value = input.value.slice(0, start) + text + input.value.slice(end);
      input.setSelectionRange?.(start + text.length, start + text.length);
    }
    // 입력 이벤트로 보내기 버튼 상태를 다시 맞춘다. 보내지는 않는다.
    if (typeof input.dispatchEvent === "function" && typeof Event === "function") input.dispatchEvent(new Event("input", { bubbles: true }));
    else updateSend();
  }
  async function read() {
    if (!opened || reading || !strokes.length) return;
    // 넣기를 누른 순간까지의 획만 보낸다. 다른 손가락으로 넣기를 누른 채 펜이 아직 닿아 있어도
    // 그리던 획을 여기서 끝내, 화면의 획과 보내는 그림이 어긋나지 않게 한다. 읽는 동안에는 새 획도 받지 않는다.
    for (const id of active.keys()) if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture?.(id);
    active.clear();
    // 보내는 그림은 지금 캔버스 전체(크기)로 자른다. 지금 스크롤로 가려진 띠는 자르지 않는다. 넣기 버튼까지 패드를 스크롤하면
    // 캔버스 위쪽이 가려지는데, 그곳 잉크도 쓸 때는 보였던 것이다(쓸 때 보이지 않던 잉크는 점마다 저장한 칸이 이미 잘라 둔다).
    // 캔버스를 줄여 칸 밖으로 나간 잉크는 지금처럼 빼고 보낸다.
    const area = box?.width > 0 && box?.height > 0 ? { width: box.width, height: box.height } : null;
    if (!handwritingBounds(strokes, area)) {
      // 모든 잉크가 보이는 칸 밖에 있으면 보낼 글씨가 없다.
      show(handwritingMessages.unreadable, true);
      return;
    }
    // 패드를 닫으면 회차가 달라져 늦은 응답을 버린다. 패드를 연 계정이나 대화에서 벗어났는데 패드가 남아 있으면
    // 그때 닫고 버린다. 그래서 인식 글자는 패드를 연 그 대화의 질문 칸에만 들어간다.
    const ticket = session;
    const stale = () => {
      if (ticket !== session) return true;
      if (owner?.account === historyAccount && owner?.conversation === activeConversation) return false;
      closePad(false);
      return true;
    };
    if (stale()) return;
    const controller = new AbortController();
    reading = controller;
    let timedOut = false, message = null, text = "";
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, handwritingTimeoutMs);
    show(handwritingMessages.reading); controls();
    // 넣기 버튼이 잠기면 브라우저가 초점을 문서 밖으로 놓친다. 그 전에 취소로 옮겨 두어 Esc·취소가 계속 듣게 한다.
    cancel.focus();
    try {
      const image = await handwritingImage(strokes, window.devicePixelRatio || 1, area, controller.signal);
      if (stale()) return;
      if (!image) message = handwritingMessages.failed;
      else if (image.size > handwritingMaxBytes) message = handwritingMessages.tooLarge;
      else {
        const form = new FormData();
        form.append("image", image, "handwriting.png");
        form.append("lang", uiLang);
        const response = await fetch(handwritingPath, { method: "POST", headers: { Accept: "application/json" }, body: form, signal: controller.signal });
        if (stale()) return;
        if (response.ok) {
          // 본문 받기와 JSON 해석을 나눈다. 받는 도중의 실패(시간 초과로 끊음·연결 끊김)는 바깥 catch로 넘겨
          // 시간 초과·연결 문구를 띄운다. 예전처럼 response.json()의 실패를 모두 삼키면, 상태 200을 먼저 받고 본문을
          // 기다리다 시간 초과된 경우에도 「서버가 글씨를 처리하지 못했어요」가 떴다. 받은 본문이 JSON이 아닐 때만 서버 응답 문제다.
          const body = await response.text();
          if (stale()) return;
          let payload = null;
          try { payload = JSON.parse(body); } catch { payload = null; }
          text = typeof payload?.text === "string" ? payload.text.trim() : "";
          if (payload === null) message = handwritingMessages.failed;
          else if (!text) message = handwritingMessages.unreadable;
        } else message = handwritingMessages[handwritingStatusMessages[response.status] ?? "failed"];
      }
    } catch {
      if (stale()) return;
      message = timedOut ? handwritingMessages.timeout : handwritingMessages.offline;
    } finally {
      clearTimeout(timer);
      if (reading === controller) reading = null;
    }
    if (stale()) return;
    if (message) {
      // 획은 그대로 둔다. 고쳐 쓰거나 바로 다시 넣을 수 있다.
      show(message, true); controls();
      insert.focus();
      return;
    }
    placeText(text);
    closePad(false);
    // 패드 안 상태 줄은 패드와 함께 사라지므로, 넣었다는 안내는 늘 문서에 있는 읽기 전용 알림 줄에 남긴다.
    say(document.querySelector("#conversation-announce"), handwritingMessages.inserted);
    input.focus();
  }
  function point(event) {
    const pressure = typeof event.pressure === "number" && event.pressure > 0 ? Math.min(1, event.pressure) : .5;
    // 화면 좌표를 캔버스 왼쪽 위 기준 CSS 픽셀로 바꾼다.
    return { x: event.clientX - (origin?.left || 0), y: event.clientY - (origin?.top || 0), p: pressure };
  }
  function dropStroke(stroke) {
    const index = strokes.indexOf(stroke);
    if (index >= 0) strokes.splice(index, 1);
  }
  canvas.addEventListener("pointerdown", event => {
    if (!opened || event.button > 0) return;
    const type = event.pointerType || "mouse";
    // 읽는 동안에는 새 획을 받지 않지만, 그 사이 닿은 펜도 이번 패드에서 펜을 봤다는 기록으로 남긴다.
    // 그래야 읽기가 실패한 뒤에도 손가락(손바닥) 입력을 계속 무시한다.
    if (type === "pen" && reading) penSeen = true;
    if (reading) return;
    if (type === "pen" && !penSeen) {
      penSeen = true;
      for (const [id, stroke] of active) {
        if (stroke.type !== "touch") continue;
        active.delete(id); dropStroke(stroke);
        if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture?.(id);
      }
      redraw();
    }
    if (type === "touch" && penSeen) return;
    event.preventDefault?.();
    // 오류 문구는 여기서 지우지 않는다. 지우면 상태 줄이 사라져 패드 높이가 줄고 캔버스가 화면에서 움직이는데,
    // 그 뒤에 잰 위치로 이미 누른 점을 바꾸면 첫 점이 엉뚱한 자리(위로 20px 밀린 y=−15 등)에 찍힌다.
    // 문구는 펜을 뗀 뒤(pointerup) 지운다. 그러면 긋는 동안에는 캔버스가 움직이지 않는다.
    // 좁은 화면 시트는 안에서 스크롤될 수 있어, 획을 시작할 때마다 캔버스의 화면 위치를 다시 잰다.
    const rect = canvas.getBoundingClientRect?.();
    if (rect) { origin = { left: rect.left, top: rect.top }; box = rect; if (measureArea()) redraw(); }
    if (context && inkColor() !== ink) redraw();
    canvas.setPointerCapture?.(event.pointerId);
    const first = point(event);
    // last는 잘라 내기 전의 마지막 포인터 자리다. 다음 선분을 칸 경계에서 자를 때 쓴다.
    // 점마다 clip에 그 점을 찍을 때 보이던 칸을 적는다. 화면에 그릴 때와 보낼 그림을 만들 때 이 칸으로 자른다.
    first.clip = visibleArea();
    // lastArea·lastInside는 앞 포인터 자리를 잴 때의 칸과, 그 자리가 그 칸 안이었는지다(pointermove 참고).
    // lastClient는 마지막 신호의 화면 좌표다. 펜을 뗀 자리가 화면에서 그대로인지 가를 때 쓴다(extend 참고).
    const stroke = { type, points: [first], last: first, broken: false, lastArea: first.clip, lastInside: handwritingInside(first, first.clip),
      lastClient: { x: event.clientX, y: event.clientY } };
    first.w = handwritingWidth(stroke, first);
    strokes.push(stroke); active.set(event.pointerId, stroke);
    if (context) { paint(); drawHandwritingStroke(context, stroke); }
    controls();
  });
  canvas.addEventListener("pointermove", event => {
    const stroke = active.get(event.pointerId);
    if (!stroke) return;
    event.preventDefault?.();
    const coalesced = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    extend(stroke, coalesced?.length ? coalesced : [event]);
  });
  // 포인터 신호(이동·떼기)의 좌표를 획에 잇는다. release는 펜을 뗀 신호다. 펜은 뗄 때 압력이 0으로 오므로
  // 그 신호에는 앞 신호의 압력을 그대로 써 끝 굵기가 바뀌지 않게 한다.
  function extend(stroke, samples, release = false) {
    // 획을 긋는 동안 휠·스크롤로 패드가 움직일 수 있어, 신호마다 캔버스의 화면 위치를 다시 잰다.
    const rect = canvas.getBoundingClientRect?.();
    if (rect) { origin = { left: rect.left, top: rect.top }; box = rect; if (measureArea()) redraw(); }
    const from = stroke.points.length;
    // 선분마다 쓰는 순간의 보이는 칸 경계(굵기 절반만큼 넓힌 상자)에서 잘라 그 안의 조각만 저장한다.
    // 칸 밖으로 나간 부분은 기록하지 않으므로, 나중에 칸이 넓어져도 처음 잘린 잉크가 되살아나거나 서버로 가지 않는다.
    // 칸 밖에 나갔다 다시 들어오면 들어온 자리를 gap 점으로 넣어 앞 조각과 잇지 않는다.
    const area = visibleArea();
    for (const each of samples) {
      // 신호의 화면 좌표가 마지막 신호와 같으면 펜은 화면에서 움직이지 않은 것이다(압력만 바뀐 신호).
      // 그 사이 패드가 스크롤돼 캔버스만 움직였어도 새 캔버스 좌표로 선을 긋지 않고, 마지막 획 좌표에서 굵기만 갱신한다.
      // 떼기 신호라면 더할 것이 없다. 캔버스 좌표로 비교하면 움직이지 않은 펜에 가짜 선이 붙는다(이동·떼기 모두 같은 규칙).
      const still = stroke.lastClient && each.clientX === stroke.lastClient.x && each.clientY === stroke.lastClient.y;
      if (still && release) continue;
      if (still) {
        // 압력만 바뀐 신호는 선분 처리(자르기·칸 비교)를 타지 않는다. 새 위치를 만들지 않고, 이미 기록한 마지막 잉크의 굵기만 갱신한다.
        // 선분 처리를 타면 칸 밖이던 옛 포인터 자리(600 칸의 x=700)를 넓힌 칸 기준으로 다시 해석해, 압력 변화만으로 새 점이 생겼다.
        // 마지막 포인터 자리가 칸 밖이라 그 자리에 잉크가 없으면(broken이거나 끝 점이 경계에서 잘린 자리) 갱신할 것도 없다.
        // 갱신한 점은 마지막 잉크를 기록할 때의 칸으로 자른다.
        const p = typeof each.pressure === "number" && each.pressure > 0 ? Math.min(1, each.pressure) : stroke.last.p;
        stroke.last = { ...stroke.last, p };
        const tail = stroke.points[stroke.points.length - 1];
        if (!stroke.broken && tail && tail.x === stroke.last.x && tail.y === stroke.last.y) {
          const w = Math.max(handwritingDrawnWidth(stroke, tail), handwritingWidth(stroke, stroke.last));
          stroke.points.push({ x: tail.x, y: tail.y, p, w, clip: handwritingClipOf(stroke, tail) });
        }
        continue;
      }
      stroke.lastClient = { x: each.clientX, y: each.clientY };
      const next = point(each);
      if (release) next.p = stroke.last.p;
      // 자르기 전 선분(앞 포인터 자리 → 새 자리)의 굵기를 한 번 정해, 잘라 낸 조각의 모든 점에 w로 적는다.
      // 자른 점에 새 압력만 붙여 굵기를 다시 계산하면, 세게 누르다 약하게 경계 밖으로 이어 간 선이 가늘어져 칸 안 잉크가 사라진다.
      const w = handwritingDrawnWidth(stroke, next, stroke.last);
      // 이 선분을 자를 칸. 보통은 지금 칸이다. 앞 포인터 자리가 그때 칸 밖이었고 그 사이 칸이 바뀌었으면(넓힘·줄임·패드 스크롤),
      // 이 선분은 옛 칸과 지금 칸이 겹치는 곳에서만 그린다. 그 자리에서 출발한 선이 새로 드러난 영역(600→750의 600~750)에
      // 나타나지 않고, 겹치는 곳으로 돌아온 부분과 끝 점은 남는다. 앞 자리가 칸 안이었으면(599.9 등) 지금 칸 전체를 쓴다.
      // 칸이 바뀌었는지는 값으로 비교한다(600→400→600은 바뀌지 않음).
      const same = (a, b) => (a?.width ?? null) === (b?.width ?? null) && (a?.height ?? null) === (b?.height ?? null) && handwritingTop(a) === handwritingTop(b);
      const bridge = !stroke.lastInside && !same(stroke.lastArea, area) ? handwritingClipMeet(stroke.lastArea, area) : area;
      const piece = bridge ? clipHandwritingSegment(stroke.last, next, bridge, w / 2) : [stroke.last, next];
      stroke.last = next; stroke.lastArea = area; stroke.lastInside = handwritingInside(next, area);
      // 칸이 바뀐 직후 선분(bridge가 지금 칸과 다를 때)은 겹치는 칸으로만 그리므로, 끝 점이 지금 칸에서 보여도 그 점의 잉크가
      // 겹치는 칸 밖이면 잘린다. 그래서 이런 선분 끝에는 좌표를 따지지 않고 늘 지금 칸으로 끝 점을 새로 찍어 다시 시작한다.
      // "선이 끝 점에 닿았나·앞 점과 좌표가 같나"로 가르면, 그리는 칸과 따지는 칸이 달라 새 칸의 첫 점이 되풀이해 빠졌다.
      // 이미 같은 자리에 선 끝이 있어도 같은 잉크 위에 한 번 더 찍을 뿐이라 모양이 바뀌지 않는다.
      const restart = () => {
        if (bridge === area) return false;
        const own = handwritingWidth(stroke, next);
        if (!handwritingInkVisible(next, next, own / 2, area)) return false;
        stroke.points.push({ x: next.x, y: next.y, p: next.p, w: own, clip: area, gap: true });
        stroke.broken = false;
        return true;
      };
      if (!piece) { if (!restart()) stroke.broken = true; continue; }
      const [enter, leave] = piece;
      const tail = stroke.points[stroke.points.length - 1];
      const add = (at, clip, gap = false) => stroke.points.push({ x: at.x, y: at.y, p: next.p, w, clip, ...(gap ? { gap } : {}) });
      // 선분은 끝 점(leave)의 칸으로 그린다. 긋는 도중 칸이 넓어져도 이미 저장한 점과 선분은 옛 칸 그대로라
      // 떼기 전에 넓혀도 잘린 잉크가 되살아나지 않고, 넓힌 뒤 새로 그은 선분은 경계 근처에서도 새 칸에서 온전히 보인다.
      if (stroke.broken || enter.x !== tail.x || enter.y !== tail.y) add(enter, bridge, true);
      stroke.broken = false;
      add(leave, bridge);
      restart();
    }
    if (context && stroke.points.length > from) { paint(); drawHandwritingStroke(context, stroke, from); }
  }
  // 펜을 뗀 뒤에야 이전 오류 문구를 지운다(pointerdown 참고). 모든 획이 끝났을 때만 지워, 다른 손가락이 긋는 중에 캔버스가 움직이지 않는다.
  // 떼기(pointerup)에도 좌표가 있다. 마지막 이동 신호 뒤 떼는 자리까지 움직였으면 그 선분을 더해 획 끝이 잘리지 않게 한다.
  // 포인터 잡기를 잃은 신호(lostpointercapture)는 떼기 뒤에도 오므로 좌표를 더하지 않는다.
  for (const name of ["pointerup", "lostpointercapture"]) canvas.addEventListener(name, event => {
    const stroke = active.get(event.pointerId);
    if (stroke && name === "pointerup" && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) extend(stroke, [event], true);
    const ended = active.delete(event.pointerId);
    if (ended && !active.size && !reading && status.classList?.contains("is-error")) show("");
  });
  // 브라우저가 포인터를 취소하면(손바닥·스크롤 몸짓으로 판정한 경우 등) 그 획은 쓰다 만 것이라 버린다.
  canvas.addEventListener("pointercancel", event => {
    const stroke = active.get(event.pointerId);
    active.delete(event.pointerId);
    if (!stroke) return;
    dropStroke(stroke); redraw(); controls();
  });
  undo.addEventListener("click", () => {
    if (reading || !strokes.length) return;
    const last = strokes.pop();
    for (const [id, stroke] of active) if (stroke === last) active.delete(id);
    show(""); redraw(); controls();
    if (!strokes.length) canvas.focus();
  });
  clear.addEventListener("click", () => {
    if (reading || !strokes.length) return;
    strokes = []; active.clear();
    show(""); redraw(); controls();
    canvas.focus();
  });
  cancel.addEventListener("click", () => closePad(true));
  insert.addEventListener("click", () => { void read(); });
  // Tab은 가로채지 않는다. 펜 버튼을 누르면 초점이 캔버스로 옮겨 가므로 펜 버튼 → 캔버스 → 되돌리기 → 지우기 → 취소 → 넣기가 되고,
  // 넣기 다음은 문서 순서대로 테크모로 나간다. 펜 버튼에서 누른 Tab은 원래대로 질문 칸·답변 모드·보내기로 간다.
  // Tab을 이어 붙이면 입력 줄을 건너뛰거나 입력 줄과 패드 사이를 맴돌게 되어 둘 다 막혔다.
  pad.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault?.(); event.stopPropagation?.();
    closePad(true);
  });
  // 초점이 패드 밖(질문 칸 등)에 있어도 열린 동안 Esc는 패드를 닫고 읽던 요청을 끊는다.
  // 선택 메뉴처럼 Esc를 먼저 처리하고 전파를 멈춘 곳은 건드리지 않는다.
  document.addEventListener?.("keydown", event => {
    if (!opened || event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault?.();
    closePad(true);
  });
  button.addEventListener("click", openPad);
  // 넓은 화면의 패드는 화면에 고정돼 있어, 문서나 안쪽 칸이 스크롤되면 입력 줄 바로 위로 다시 옮긴다.
  // 캡처 단계로 들어 안쪽 칸의 스크롤도 받는다. 좁은 화면 시트는 CSS가 화면 아래에 두므로 좌표 변수가 쓰이지 않는다.
  // 패드 안쪽이 스크롤돼도 이 신호가 오지만, 입력 줄 자리가 그대로라 relayout이 아무것도 하지 않는다.
  document.addEventListener?.("scroll", () => relayout(), { capture: true, passive: true });
  // 질문 칸에 입력이 들어오기 직전의 선택 범위를 적어 둔다. 질문 칸 자체에는 처리기를 달지 않고(Scribble 보존 조건)
  // 문서의 캡처 단계에서 받는다. 막거나 바꾸지 않고 읽기만 한다.
  document.addEventListener?.("beforeinput", event => {
    if (!opened || event?.target !== input) return;
    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
    pendingEdit = { start, end: Math.max(start, end), value: input.value };
  }, { capture: true });
  // 질문 칸을 늘리거나 판 폭이 바뀌는 등 입력 줄·캔버스 크기만 바뀌면 scroll·resize 신호가 없다.
  // 두 크기를 지켜보다가 자리를 다시 재고 캔버스 그리기 버퍼(보이는 크기 × 기기 화소 비율)도 새로 맞춘다.
  // 버퍼를 그대로 두면 포인터 위치와 그려지는 획, 보내는 그림의 자르기 범위가 옛 폭에 머문다.
  // 입력 줄 크기는 그대로인 채 자리만 바뀌는 경우(질문 폼 안 다른 줄이 생기거나 사라질 때)도 있어 질문 폼 전체 크기도 지켜본다.
  const composerRow = document.querySelector(".composer-row");
  // 질문 폼은 맨 위에서 찾아 둔 composer를 그대로 쓴다. 다시 찾지 않는다.
  // 크기 감시(ResizeObserver)는 지켜보기 시작할 때와 패드를 보일 때 크기가 그대로여도 첫 알림을 보낸다.
  // 그 알림을 "연 뒤 자리가 바뀜"으로 처리하면 스크롤·크기 변화 없이 패드가 줄 아래로 옮겨 가므로,
  // 입력 줄의 자리·크기나 캔버스 크기가 마지막으로 잰 값과 달라졌을 때만 다시 잰다.
  if (typeof ResizeObserver === "function") {
    for (const node of [composerRow, composer, canvas]) {
      if (node) new ResizeObserver(() => relayout()).observe(node);
    }
  }
  refreshHandwritingPad.run = () => relayout();
  // 자리만 다시 잰다. 캔버스 크기는 그대로라 그리기 버퍼는 건드리지 않는다(질문 칸에 글을 쓸 때마다 불린다).
  placeHandwritingPad.run = () => relayout();
  closeHandwritingPad.run = closePad;
  redrawHandwritingPad.run = () => { if (opened) redraw(); };
  noteHandwritingEdit.run = noteEdit;
}
// 질문 칸의 input 처리기가 불러, 패드가 열린 동안 고친 구간을 따라 넣을 자리를 옮긴다.
function noteHandwritingEdit(inputType) {
  noteHandwritingEdit.run?.(inputType);
}
// 테마가 바뀌면 applyTheme이 불러 열린 패드의 잉크를 새 글자색으로 다시 그린다.
function redrawHandwritingPad() {
  redrawHandwritingPad.run?.();
}
// 창 크기 신호는 테크모 resize 처리기 하나가 받아 이 함수를 부른다. 처리기를 따로 늘리지 않는다.
// 두 함수는 초기화 순서와 상관없이 부를 수 있게 함수 속성에 실제 동작을 단다.
function refreshHandwritingPad() {
  refreshHandwritingPad.run?.();
}
function placeHandwritingPad() {
  placeHandwritingPad.run?.();
}
// 서랍을 열거나 첫 화면·채팅 화면을 오가면 입력 줄 자리가 바뀌므로 패드를 닫는다(초점은 옮기지 않는다).
function closeHandwritingPad(restore = false) {
  closeHandwritingPad.run?.(restore);
}
setupHandwriting();

// 좌표는 버튼 테두리의 왼쪽 위를 기준으로 한다. 저장할 때만 화면 크기로 나눈다.
function techmoClampPosition(position, viewport, size) {
  return {
    x: Math.max(8, Math.min(position.x, viewport.width - size.width - 8)),
    y: Math.max(8, Math.min(position.y, viewport.height - size.height - 8)),
  };
}
function techmoPositionRatio(position, viewport) {
  return { x: position.x / viewport.width, y: position.y / viewport.height };
}
function techmoRestorePosition(ratio, viewport, size) {
  if (!ratio || ![ratio.x, ratio.y].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  return techmoClampPosition({ x: ratio.x * viewport.width, y: ratio.y * viewport.height }, viewport, size);
}
const techmoPositionKey = "kumoh-techmo-position:v1";
let techmoRatio = null;
let techmoPointer = null;
let techmoFrame = null;
let techmoSuppressClick = false;
const techmoViewport = () => ({ width: window.innerWidth, height: window.innerHeight });
const techmoHeadRatio = 44 / 192;
function setTechmoBubbleVisibility(target, active) {
  if (!target?.dataset) return;
  if (techmoBubbleTimers.has(target)) {
    clearTimeout(techmoBubbleTimers.get(target));
    techmoBubbleTimers.delete(target);
  }
  const narrow = window.innerWidth <= 680;
  target.dataset.bubbleVisible = String(!narrow || active);
  if (narrow && active && typeof setTimeout === "function") {
    techmoBubbleTimers.set(target, setTimeout(() => {
      target.dataset.bubbleVisible = "false";
      techmoBubbleTimers.delete(target);
    }, 4000));
  }
}
function refreshTechmoBubbleVisibility() {
  const narrow = window.innerWidth <= 680;
  if (techmoNarrow === narrow) return;
  techmoNarrow = narrow;
  // 아직 상태를 그리지 않았으면 문서의 글을 본다. 그 글은 번역됐을 수 있어 번역한 대기 문구와도 견준다.
  const idle = assistantStates.idle[1], current = assistantSource ?? assistantLine.textContent;
  setTechmoBubbleVisibility(assistant, current !== idle && current !== t(idle));
  setTechmoBubbleVisibility(loginPet, true);
}
const techmoSize = () => {
  const rect = pet.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
};
function techmoBubble() {
  if (!pet.getBoundingClientRect || assistant.dataset?.dragging === "true") return;
  const viewport = techmoViewport();
  const rect = pet.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const headX = rect.left + rect.width / 2;
  const headY = rect.top + rect.height * techmoHeadRatio;
  if (techmoPosition) assistant.dataset.facing = headX < viewport.width / 2 ? "right" : "left";
  const bubble = assistantLine?.parentElement;
  const reserved = !techmoPosition && viewport.width >= 961;
  const reserve = viewport.width >= 1464 ? 192 : 152;
  // 기본 자리에서는 본문과 화면 가장자리 양쪽에 8px씩 남긴다.
  const defaultWidth = reserved ? reserve - 16 : 240;
  const width = Math.min(defaultWidth, viewport.width - 16);
  assistant.style?.setProperty("--techmo-bubble-width", `${width}px`);
  const height = bubble?.getBoundingClientRect?.().height || 64;
  const below = headY - 8 - 10 - height < 8;
  const minX = reserved ? viewport.width - reserve + 8 : 8;
  const x = Math.max(minX, Math.min(headX - width / 2, viewport.width - width - 8));
  const y = below ? rect.top + rect.height + 8 + 10 : headY - 8 - 10 - height;
  assistant.dataset.bubbleBelow = String(below);
  assistant.style?.setProperty("--techmo-bubble-x", `${x}px`);
  assistant.style?.setProperty("--techmo-bubble-y", `${Math.max(8, Math.min(y, viewport.height - height - 8))}px`);
  assistant.style?.setProperty("--techmo-bubble-tail-x", `${headX - x}px`);
}
function techmoDrawPosition() {
  techmoFrame = null;
  if (!techmoPosition) return;
  assistant.style?.setProperty("--techmo-x", `${techmoPosition.x}px`);
  assistant.style?.setProperty("--techmo-y", `${techmoPosition.y}px`);
}
function techmoPlace(position) {
  const size = techmoSize();
  techmoPosition = techmoClampPosition(position, techmoViewport(), size);
  if (assistant.dataset.placed !== "true") {
    assistant.style?.setProperty("--techmo-pet-size", `${size.width}px`);
    assistant.style?.setProperty("--techmo-pet-height", `${size.height}px`);
    assistant.dataset.placed = "true";
  }
}
function techmoDefaultPosition() {
  techmoPosition = null;
  techmoRatio = null;
  delete assistant.dataset.placed;
  delete assistant.dataset.facing;
  delete assistant.dataset.bubbleRight;
  delete assistant.dataset.bubbleBelow;
  for (const name of ["x", "y", "pet-size", "pet-height", "bubble-x", "bubble-y", "bubble-width", "bubble-tail-x"]) assistant.style?.removeProperty(`--techmo-${name}`);
}
function techmoSavePosition() {
  try {
    const storage = historyStorage();
    if (!storage) throw new Error("Position storage unavailable");
    techmoRatio = techmoPositionRatio(techmoPosition, techmoViewport());
    storage.setItem(techmoPositionKey, JSON.stringify(techmoRatio));
  } catch { techmoDefaultPosition(); }
}
function techmoEndPointer(cancelled) {
  const pointer = techmoPointer;
  if (!pointer) return;
  techmoPointer = null;
  if (techmoFrame !== null) window.cancelAnimationFrame?.(techmoFrame);
  techmoFrame = null;
  assistant.dataset.dragging = "false";
  document.body?.removeAttribute?.("data-techmo-dragging");
  if (pointer.dragged) {
    techmoSuppressClick = true;
    if (cancelled) {
      if (pointer.original) techmoPlace(pointer.original);
      else techmoDefaultPosition();
    } else techmoSavePosition();
    techmoDrawPosition();
    techmoBubble();
    if (!cancelled) celebrateTechmoDrop();
  }
  updateTechmoMotion();
  if (pet.hasPointerCapture?.(pointer.id)) pet.releasePointerCapture?.(pointer.id);
}
pet.addEventListener("pointerdown", event => {
  if (techmoPointer || event.isPrimary === false || (event.button !== undefined && event.button !== 0) || !pet.getBoundingClientRect) return;
  techmoSuppressClick = false;
  const rect = pet.getBoundingClientRect();
  techmoPointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
    start: { x: rect.left, y: rect.top }, original: techmoPosition && { ...techmoPosition }, dragged: false };
  pet.setPointerCapture?.(event.pointerId);
});
function techmoMovePointer(event) {
  const pointer = techmoPointer;
  if (!pointer || pointer.id !== event.pointerId) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!pointer.dragged && Math.hypot(dx, dy) <= 6) return;
  if (!pointer.dragged) {
    pointer.dragged = true;
    assistant.dataset.dragging = "true";
    document.body?.setAttribute("data-techmo-dragging", "true");
    updateTechmoMotion();
  }
  techmoPlace({ x: pointer.start.x + dx, y: pointer.start.y + dy });
  event.preventDefault?.();
  if (techmoFrame === null) {
    if (window.requestAnimationFrame) techmoFrame = window.requestAnimationFrame(techmoDrawPosition);
    else techmoDrawPosition();
  }
}
pet.addEventListener("pointermove", techmoMovePointer);
pet.addEventListener("pointerup", event => {
  if (techmoPointer?.id !== event.pointerId) return;
  techmoMovePointer(event);
  techmoEndPointer(false);
});
for (const name of ["pointercancel", "lostpointercapture"]) pet.addEventListener(name, event => {
  if (techmoPointer?.id === event.pointerId) techmoEndPointer(true);
});
pet.addEventListener("click", event => {
  if (techmoSuppressClick) {
    techmoSuppressClick = false;
    event.preventDefault?.();
    return;
  }
  startNewConversation();
});
pet.addEventListener("keydown", event => {
  techmoSuppressClick = false;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (event.key === "Home") {
    event.preventDefault();
    try { historyStorage()?.removeItem(techmoPositionKey); } catch { /* 기본 자리는 저장소 없이도 돌아간다. */ }
    techmoDefaultPosition();
    techmoBubble();
    return;
  }
  if (!Object.hasOwn(arrows, event.key) || !pet.getBoundingClientRect) return;
  event.preventDefault();
  const rect = pet.getBoundingClientRect();
  const step = event.shiftKey ? 64 : 16;
  const [dx, dy] = arrows[event.key];
  techmoPlace({ x: rect.left + dx * step, y: rect.top + dy * step });
  techmoSavePosition();
  techmoDrawPosition();
  techmoBubble();
});
function restoreTechmoPosition() {
  if (!techmoRatio || !pet.getBoundingClientRect) return;
  const size = techmoSize();
  if (size.width <= 0 || size.height <= 0) return;
  const position = techmoRestorePosition(techmoRatio, techmoViewport(), size);
  if (position) { techmoPlace(position); techmoDrawPosition(); techmoBubble(); }
}
window.addEventListener?.("resize", () => {
  refreshTechmoBubbleVisibility();
  restoreTechmoPosition();
  techmoBubble();
  // ResizeObserver가 없는 브라우저에서도 퀵링크 캐러셀 버튼 상태를 다시 잰다.
  if (typeof measureQuickLinks === "function") measureQuickLinks();
  // 열린 필기 패드는 입력 줄 자리와 캔버스 화소를 다시 잰다(#134).
  if (typeof refreshHandwritingPad === "function") refreshHandwritingPad();
});
try {
  const saved = historyStorage()?.getItem(techmoPositionKey);
  if (saved) {
    const ratio = JSON.parse(saved);
    const position = techmoRestorePosition(ratio, techmoViewport(), { width: 0, height: 0 });
    if (position) techmoRatio = ratio;
  }
} catch { techmoDefaultPosition(); }

// 로고, 첫 화면의 테크모, 펫 버튼은 숨긴 채 시작하고, 안에 든 그림이 실제로 받아졌을 때만 보인다.
// 펫은 스프라이트 시트를 배경으로 그리는데 배경 그림은 로드 신호를 주지 않아, 같은 주소의 그림을 버튼 안에 두고 그 신호를 본다.
// complete와 naturalWidth를 함께 보므로 이 스크립트가 로드·실패 신호보다 늦게 실행돼도 결과가 같다.
// 파일이 없거나(404) 깨졌으면 자리를 숨긴 채 두고, 다른 그림으로 바꾸지 않는다.
// 두 제목 그림은 한국어와 영어 두 벌이다(#122). 영어 주소는 그림의 data-lettering-en 속성에 있고,
// 서버가 준비된 그림에만 내용 지문을 붙여 둔다. lettering이 영어 그림으로 바꾸는 일을 맡는다.
for (const slot of document.querySelectorAll?.("[data-brand-slot]") ?? []) {
  const image = slot.querySelector("img");
  if (!image) continue;
  const isLettering = /(^|\s)(title|main)-lettering(\s|$)/.test(typeof slot.className === "string" ? slot.className : "");
  const lettering = isLettering ? letteringSwitcher(image) : null;
  const settle = () => {
    lettering?.follow();
    slot.hidden = !(image.complete && image.naturalWidth > 0) || (lettering ? !lettering.ready() : false);
    configureTechmoSprite(slot, image);
    if (slot === pet && !slot.hidden) {
      restoreTechmoPosition();
      techmoBubble();
    }
  };
  if (lettering) lettering.onSwap = settle;
  image.addEventListener("load", settle);
  image.addEventListener("error", settle);
  if (lettering) onLangChange(settle);
  settle();
}

// 제목 그림 한 장을 지금 언어에 맞춘다. 한국어는 처음 주소를 그대로 쓴다.
// 다른 언어는 별도 Image로 먼저 받고, 요청 번호와 현재 언어가 맞을 때만 src·alt를 바꾼다. 크기는 그림 비율을 따른다.
// 받는 중이거나 404·깨짐이면 ready()가 거짓이라 자리를 숨기고, 바로 뒤의 번역한 글자 제목이 보인다.
// 언어를 빠르게 바꾸면 요청 번호가 앞서 나가므로 늦게 도착한 이전 언어 그림은 버린다.
function letteringSwitcher(image) {
  // 그림이 있는 언어는 영어뿐이다. 중국어는 글꼴 지문을 고정하기 전이라 속성이 있어도 늘 글자 제목이다.
  const letteringLangs = ["en"];
  const read = name => typeof image.getAttribute === "function" ? image.getAttribute(name) : null;
  const original = { src: read("src"), alt: read("alt") };
  let shown = "ko", wanted = "ko", request = 0;
  const switcher = {
    onSwap: null,
    ready: () => shown === uiLang,
    follow() {
      const lang = uiLang;
      if (lang === wanted) return;
      wanted = lang;
      const ticket = ++request;
      if (lang === "ko") { restore(); return; }
      const address = letteringLangs.includes(lang) ? read(`data-lettering-${lang}`) : null;
      if (!address || typeof Image !== "function") return;
      const probe = new Image();
      const finish = ok => {
        if (ticket !== request || uiLang !== lang || !ok || !(probe.naturalWidth > 0)) return;
        image.setAttribute("src", address);
        if (original.alt !== null) image.setAttribute("alt", t(original.alt));
        shown = lang;
        switcher.onSwap?.();
      };
      probe.addEventListener?.("load", () => finish(true));
      probe.addEventListener?.("error", () => finish(false));
      probe.setAttribute("src", address);
    },
  };
  function restore() {
    if (shown === "ko") return;
    shown = "ko";
    for (const name of ["src", "alt"]) {
      if (original[name] === null) image.removeAttribute?.(name);
      else image.setAttribute(name, original[name]);
    }
  }
  return switcher;
}

// 퀵링크 카드 한 장. 읽기 이름은 「이름 설명 (외부 서비스) (새 창)」 순서이고 두 아이콘은 읽지 않는다.
const svgNamespace = "http://www.w3.org/2000/svg";
function quickLinkSvg(className, viewBox, paths) {
  if (typeof document.createElementNS !== "function") return null;
  const svg = document.createElementNS(svgNamespace, "svg");
  for (const [name, value] of [["class", className], ["viewBox", viewBox], ["fill", "none"], ["stroke", "currentColor"],
    ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"], ["focusable", "false"]]) {
    svg.setAttribute(name, value);
  }
  for (const d of paths) {
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
function quickLinkCard(link) {
  const item = element("li", "quicklink-item");
  const anchor = element("a", "quicklink-card");
  anchor.setAttribute("href", link.href);
  anchor.setAttribute("target", "_blank");
  anchor.setAttribute("rel", "noopener noreferrer");
  const text = element("span", "quicklink-text");
  text.append(element("span", "quicklink-name", t(link.name)), element("span", "quicklink-desc", t(link.description)));
  if (link.external) text.append(element("span", "quicklink-badge", t("외부 서비스")));
  anchor.append(...[
    quickLinkSvg("quicklink-icon", "0 0 24 24", quickLinkIcons[link.icon] ?? []),
    text,
    element("span", "sr-only", ` ${t("(새 창)")}`),
    quickLinkSvg("external-link-icon", "0 0 16 16", ["M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v4h-9v-9h4"]),
  ].filter(Boolean));
  item.append(anchor);
  return item;
}
// 버튼 상태를 잰다. 숨은 화면처럼 폭이 0이면 판정을 미루고, 끝 판정에는 1px 오차를 허용한다.
// 카드가 다 보이면 두 버튼을 숨기고, 끝에 닿은 쪽 버튼은 aria-disabled="true"로 둔다. 양 끝 흐림도 같은 값을 따른다.
function measureQuickLink({ root, track, prev, next }) {
  const width = Number(track.clientWidth) || 0;
  if (width <= 0) return;
  const overflow = (Number(track.scrollWidth) || 0) - width;
  const fits = overflow <= 1;
  const left = Math.max(0, Number(track.scrollLeft) || 0);
  const atStart = fits || left <= 1;
  const atEnd = fits || left >= overflow - 1;
  prev.hidden = fits;
  next.hidden = fits;
  prev.setAttribute("aria-disabled", String(atStart));
  next.setAttribute("aria-disabled", String(atEnd));
  root.setAttribute("data-at-start", String(atStart));
  root.setAttribute("data-at-end", String(atEnd));
}
function measureQuickLinks() {
  for (const carousel of quickLinkCarousels) measureQuickLink(carousel);
}
// 보이는 폭만큼 넘기고, 멈출 자리는 CSS의 scroll-snap이 카드 앞 끝에 맞춘다.
// CSS scroll-behavior는 쓰지 않는다. 움직임 줄이기 설정이면 즉시 옮긴다.
function moveQuickLinks(carousel, direction) {
  const { track } = carousel;
  const button = direction < 0 ? carousel.prev : carousel.next;
  if (button.getAttribute?.("aria-disabled") === "true" || typeof track.scrollBy !== "function") return;
  track.scrollBy({ left: direction * (Number(track.clientWidth) || 0), behavior: reducedMotion() ? "auto" : "smooth" });
  measureQuickLink(carousel);
}
function setupQuickLinks() {
  for (const root of document.querySelectorAll?.("[data-quicklink-carousel]") ?? []) {
    const find = selector => typeof root.querySelector === "function" ? root.querySelector(selector) : null;
    const track = find(".quicklink-track"), prev = find(".quicklink-prev"), next = find(".quicklink-next");
    if (!track || !prev || !next) continue;
    const carousel = { root, track, prev, next };
    quickLinkCarousels.push(carousel);
    const render = () => track.replaceChildren(...quickLinks.map(quickLinkCard));
    render();
    onLangChange(() => { render(); measureQuickLink(carousel); });
    prev.addEventListener("click", () => moveQuickLinks(carousel, -1));
    next.addEventListener("click", () => moveQuickLinks(carousel, 1));
    track.addEventListener?.("scroll", () => measureQuickLink(carousel), { passive: true });
    if (typeof ResizeObserver === "function") new ResizeObserver(() => measureQuickLink(carousel)).observe(track);
    measureQuickLink(carousel);
  }
  // 창 크기 신호는 테크모 위치를 고치는 resize 처리기 하나가 함께 받아 measureQuickLinks를 부른다.
}
setupQuickLinks();

updateSend();
refreshTechmoBubbleVisibility();
if (window.location?.hash === "#chat") {
  window.history?.replaceState(null, "", window.location.pathname + window.location.search);
}
switchHistoryAccount("browse");
setupLang();
void restoreStudent();

const calendarScope = { year: 2027, semester: 1 };
let translateCalendar;
onLangChange(() => translateCalendar?.());

function panelTodayInKorea() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function isPanelDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function panelSources(sources) {
  const box = element("div", "sources");
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source || typeof source.title !== "string") continue;
    const line = element("p", "hint");
    const checked = isPanelDate(source.checked_on);
    line.append((checked && sourceLink(source.url, source.title, t("출처"))) || element("span", null, source.title));
    if (checked) line.append(document.createTextNode(t(" · 확인일 ")), calendarTime(source.checked_on));
    box.append(line);
  }
  box.append(element("p", "hint", t("공식 페이지에서 다시 확인해 주세요.")));
  return box;
}

const calendarDayMs = 86_400_000;
const calendarMonthNames = "1월 2월 3월 4월 5월 6월 7월 8월 9월 10월 11월 12월";
const calendarKinds = [
  ["enroll", /수강\s*신청/],
  ["exam", /시험/],
  ["holiday", /휴일/],
  ["register", /등록/],
];

function calendarDate(value) {
  return new Date(`${value}T00:00:00Z`);
}
function calendarDateLabel(date, key, withYear = false) {
  const parts = {
    year: date.getUTCFullYear(), month: t(calendarMonthNames).split(" ")[date.getUTCMonth()], day: date.getUTCDate(),
  };
  if (withYear) return t("{year}년 {month}", { ...parts, month: t(key, parts) });
  return t(key, parts);
}
function calendarTime(value) {
  const node = element("time", null, calendarDateLabel(calendarDate(value), "{month} {day}일", true));
  node.dateTime = value;
  return node;
}
function shiftCalendarMonth(date, amount) {
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + amount + 1, 0);
  target.setUTCDate(Math.min(date.getUTCDate(), target.getUTCDate()));
  return target;
}
function calendarEventRow(event) {
  const row = element("section", "evidence");
  const dates = element("p");
  dates.append(calendarTime(event.starts_on));
  if (event.starts_on !== event.ends_on) dates.append(document.createTextNode(" ~ "), calendarTime(event.ends_on));
  row.append(element("h5", null, event.audience), dates, panelSources(event.sources));
  return row;
}

function renderCalendar(content, result, current) {
  if (!Array.isArray(result?.events) || result.events.some(event => !event || typeof event.audience !== "string" ||
    !isPanelDate(event.starts_on) || !isPanelDate(event.ends_on) || event.ends_on < event.starts_on)) throw new Error("format");
  const today = panelTodayInKorea();
  const events = result.events.map(event => ({
    ...event, start: +calendarDate(event.starts_on), end: +calendarDate(event.ends_on),
    kind: calendarKinds.find(([, keyword]) => keyword.test(event.audience))?.[0] ?? "neutral",
  })).sort((a, b) => a.start - b.start);
  const remaining = events.filter(event => event.ends_on >= today);
  const now = calendarDate(today);
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  const nextMonth = shiftCalendarMonth(monthStart, 1);
  const lastEnd = events.reduce((latest, event) => Math.max(latest, event.end), -Infinity);
  let focused = events.some(event => event.start < nextMonth && event.end >= monthStart) ? +now :
    remaining[0]?.start ?? (events.length ? lastEnd : +now);
  let selected = focused;
  let listView = false;
  let days = new Map();

  const root = element("div", "acal");
  const scopeTitle = element("h5");
  const header = element("div", "acal-header");
  const title = element("h5", "acal-title");
  title.setAttribute("aria-live", "polite");
  const body = element("div", "acal-body");
  const dayList = element("div", "acal-day-list");
  dayList.setAttribute("aria-live", "polite");
  const control = (text, action) => {
    const button = element("button", null, text);
    button.type = "button";
    button.addEventListener("click", action);
    return button;
  };
  const previous = control("‹", () => navigate(-1));
  previous.dataset.acalNav = "prev";
  const next = control("›", () => navigate(1));
  next.dataset.acalNav = "next";
  const toggle = control("", () => { listView = !listView; draw(); });
  toggle.dataset.acalViewToggle = "";
  header.append(previous, title, next, toggle);
  root.append(scopeTitle, header, body, dayList);
  content.replaceChildren(root);

  function eventsOnDay(day) {
    return events.filter(event => event.start <= day && event.end >= day);
  }

  function drawDayList() {
    const matches = eventsOnDay(selected);
    const heading = element("h5", null, calendarDateLabel(new Date(selected), "{month} {day}일 일정"));
    const rows = matches.length ? matches.map(calendarEventRow) : [element("p", "hint", t("고른 날에 일정이 없어요."))];
    dayList.replaceChildren(heading, ...rows);
  }

  function select(day) {
    days.get(selected)?.cell.setAttribute("aria-selected", "false");
    selected = day;
    days.get(day).cell.setAttribute("aria-selected", "true");
    moveFocus(day);
    drawDayList();
  }

  function moveFocus(day) {
    const target = new Date(day);
    if (target.getUTCFullYear() < 0 || target.getUTCFullYear() > 9999) return;
    days.get(focused).button.tabIndex = -1;
    focused = day;
    if (!days.has(day)) draw();
    const button = days.get(day).button;
    button.tabIndex = 0;
    button.focus();
  }

  function navigate(amount) {
    const target = shiftCalendarMonth(new Date(focused), amount);
    if (target.getUTCFullYear() < 0 || target.getUTCFullYear() > 9999) return;
    focused = selected = +target;
    draw();
  }

  function onDayKey(event, day) {
    const date = new Date(day);
    const weekday = date.getUTCDay();
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    if (Object.hasOwn(offsets, event.key)) {
      event.preventDefault();
      moveFocus(day + offsets[event.key] * calendarDayMs);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      moveFocus(+shiftCalendarMonth(date, event.key === "PageUp" ? -1 : 1));
    }
  }

  function drawWeek(weekStart, first, last) {
    const week = element("div", "acal-week");
    week.setAttribute("role", "row");
    const weekEnd = weekStart + 6 * calendarDayMs;
    const laneEnds = [-Infinity, -Infinity];
    const bars = [];
    const hidden = Array(7).fill(0);
    for (const event of events) {
      const start = Math.max(event.start, weekStart, first);
      const end = Math.min(event.end, weekEnd, last);
      if (start > end) continue;
      const col = (start - weekStart) / calendarDayMs;
      const span = (end - start) / calendarDayMs + 1;
      const lane = laneEnds.findIndex(laneEnd => laneEnd < start);
      if (lane === -1) {
        for (let index = col; index < col + span; index++) hidden[index]++;
        continue;
      }
      laneEnds[lane] = end;
      const bar = element("span", "acal-bar", event.audience);
      bar.setAttribute("aria-hidden", "true");
      Object.assign(bar.dataset, { col: String(col + 1), span: String(span), lane: String(lane), kind: event.kind });
      bars.push(bar);
    }
    for (let col = 0; col < 7; col++) {
      const day = weekStart + col * calendarDayMs;
      const date = new Date(day);
      const cell = element("div", "acal-cell");
      cell.dataset.col = String(col + 1);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-selected", String(day === selected && day >= first && day <= last));
      week.append(cell);
      if (day < first || day > last) {
        cell.dataset.outside = "";
        cell.textContent = String(date.getUTCDate());
        continue;
      }
      const button = control(undefined, () => select(day));
      button.className = "acal-day";
      button.tabIndex = day === focused ? 0 : -1;
      button.append(element("span", "acal-day-number", String(date.getUTCDate())));
      const matches = eventsOnDay(day);
      const count = matches.length;
      button.setAttribute("aria-label", t(count === 1 ? "{date} · 일정 1건" : "{date} · 일정 {count}건", {
        date: calendarDateLabel(date, "{month} {day}일", true),
        count,
      }));
      if (day === +now) button.setAttribute("aria-current", "date");
      if (hidden[col]) {
        button.dataset.more = String(hidden[col]);
        const more = t("+{count}개", { count: hidden[col] });
        const badge = element("span", "acal-more", more);
        badge.setAttribute("aria-hidden", "true");
        button.append(badge);
      }
      const dots = element("span", "acal-dots");
      dots.setAttribute("aria-hidden", "true");
      for (const event of matches.slice(0, 3)) {
        const dot = element("span", "acal-dot");
        dot.dataset.kind = event.kind;
        dots.append(dot);
      }
      button.append(dots);
      button.addEventListener("keydown", event => onDayKey(event, day));
      cell.append(button);
      days.set(day, { cell, button });
    }
    week.append(...bars);
    return week;
  }

  function draw() {
    const scope = t("{year}학년도 {semester}학기", calendarScope);
    scopeTitle.textContent = scope;
    root.dataset.view = listView ? "list" : "month";
    dayList.hidden = listView;
    previous.hidden = next.hidden = title.hidden = listView;
    previous.setAttribute("aria-label", t("이전 달"));
    next.setAttribute("aria-label", t("다음 달"));
    toggle.textContent = t(listView ? "월 보기" : "목록 보기");
    toggle.setAttribute("aria-pressed", String(listView));
    if (listView) {
      dayList.replaceChildren();
      body.replaceChildren(...(remaining.length ? remaining.map(calendarEventRow) :
        [element("p", "hint", t("{scope}에 남은 일정이 없어요.", { scope }))]));
      return;
    }
    const first = new Date(focused);
    first.setUTCDate(1);
    const last = +shiftCalendarMonth(first, 1) - calendarDayMs;
    const monthLabel = calendarDateLabel(first, "{year}년 {month}");
    if (title.textContent !== monthLabel) title.textContent = monthLabel;

    const weekdays = element("div", "acal-weekdays");
    weekdays.setAttribute("aria-hidden", "true");
    const names = t("일요일 월요일 화요일 수요일 목요일 금요일 토요일").split(" ");
    for (const [index, name] of t("일 월 화 수 목 금 토").split(" ").entries()) {
      const label = element("span", null, name);
      label.title = names[index];
      weekdays.append(label);
    }
    const grid = element("div", "acal-grid");
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", monthLabel);
    days = new Map();
    for (let week = +first - first.getUTCDay() * calendarDayMs; week <= last; week += 7 * calendarDayMs) {
      grid.append(drawWeek(week, +first, last));
    }
    drawDayList();
    body.replaceChildren(weekdays, grid);
  }

  translateCalendar = () => {
    if (!current()) return;
    const restoreDay = !listView && document.activeElement === days.get(focused)?.button;
    draw();
    if (restoreDay) days.get(focused).button.focus();
  };
  draw();
  return remaining.length;
}
function renderCampus(content, result) {
  if (!Array.isArray(result?.places) || result.places.some(place => !place ||
    ["id", "name", "purpose", "location"].some(key => typeof place[key] !== "string"))) throw new Error("format");
  const places = result.places;
  const list = selected => {
    content.replaceChildren();
    if (!places.length) content.append(element("p", "hint", "보여 드릴 장소가 없어요."));
    for (const place of places) {
      const button = element("button", "panel-action", `${place.name} · ${place.purpose}`);
      button.type = "button";
      button.addEventListener("click", () => detail(place.id));
      content.append(button);
      if (selected === place.id) button.focus();
    }
  };
  const detail = id => {
    const place = places.find(item => item.id === id);
    const title = element("h5", null, place.name);
    title.tabIndex = -1;
    content.replaceChildren(title, element("p", null, place.purpose), element("p", null, `위치 · ${place.location}`));
    for (const [key, label] of [["map_number", "지도 번호"], ["hours", "운영 시간"], ["audience", "이용 대상"], ["cost", "비용"], ["directions", "찾아가는 길"], ["valid_period", "적용 기간"]]) {
      if (typeof place[key] === "string" && place[key].trim()) content.append(element("p", null, `${label} · ${place[key]}`));
    }
    const back = element("button", "panel-action", "목록으로");
    back.type = "button";
    back.addEventListener("click", () => list(id));
    content.append(panelSources(place.sources), back);
    title.focus();
  };
  list();
  return places.length;
}
async function loadFeaturePanel(panel, change) {
  const content = panel.querySelector("[data-panel-content]");
  if (!content) return;
  const current = () => panelChange === change && openedCard?.dataset.feature === panel.dataset.panel;
  const retry = () => { if (current()) void loadFeaturePanel(panel, change); };
  if (busy) {
    content.replaceChildren(failureBox("다른 요청을 마친 뒤 다시 시도해 주세요.", retry));
    return;
  }
  content.replaceChildren(element("p", "hint", t("안내를 찾는 중이에요…")));
  await whileBusy("안내를 찾는 중…", async () => {
    const calendar = panel.dataset.panel === "calendar";
    const path = calendar ? `/api/v1/academic-calendar/${calendarScope.year}/${calendarScope.semester}` : "/api/v1/campus-guide";
    const response = await requestJson(path, { method: "GET", signal: AbortSignal.timeout(30_000) }, "서버가 안내를 불러오지 못했어요.");
    if (!current()) return;
    if (response.failure) {
      content.replaceChildren(failureBox(response.failure, retry));
      showAssistant("error");
      return;
    }
    try {
      const count = calendar ? renderCalendar(content, response.result, current) : renderCampus(content, response.result);
      if (count) celebrate();
      else showAssistant("hold");
    } catch {
      content.replaceChildren(failureBox("서버 안내의 형식이 맞지 않아요.", retry));
      showAssistant("error");
    }
  });
}

// 그래픽 준비가 실패해도 다른 화면 기능은 계속 초기화한다.
async function initializeCampusBackdrop() {
  const canvas = document.querySelector("#campus-canvas");
  if (!canvas || typeof canvas.getContext !== "function" || reducedMotion() ||
      typeof window.requestAnimationFrame !== "function" || typeof createImageBitmap !== "function") return;
  let gl;
  let program = null;
  let buffer = null;
  let frame = null;
  let stopped = false;
  const bitmaps = [];
  const textures = [];
  const caption = document.querySelector("#campus-caption");
  const label = document.querySelector("#campus-name");
  const progressBar = document.querySelector("#campus-progress");
  let progressSteps = [];
  const toggle = document.querySelector("#campus-motion-toggle");
  const motionKey = "kumoh-campus-motion:v1";
  let paused = false;
  try { paused = window.localStorage?.getItem(motionKey) === "paused"; } catch {}
  const renderToggle = () => {
    toggle?.setAttribute("aria-pressed", String(paused));
    toggle?.setAttribute("aria-label", t("배경 움직임 일시정지"));
  };
  renderToggle();
  onLangChange(renderToggle);
  const fail = () => {
    stopped = true;
    if (frame !== null) window.cancelAnimationFrame?.(frame);
    frame = null;
    canvas.hidden = true;
    if (caption) caption.hidden = true;
    for (const bitmap of bitmaps) bitmap.close?.();
    if (gl) {
      for (const texture of textures) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer?.(buffer);
      if (program) gl.deleteProgram?.(program);
    }
  };
  try {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
    if (!gl || !gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision) return;
    const vertex = "attribute vec2 p; varying vec2 v; void main(){v=(p+1.0)*0.5;gl_Position=vec4(p,0.0,1.0);}";
    const fragment = `precision highp float;
      varying vec2 v; uniform sampler2D a,b; uniform float mixv,t,aspect,imgAspect,panA,panB,zoomA,zoomB,still;
      uniform vec3 drops[16];
vec2 cover(vec2 uv, float pan, float zoom){ uv=0.5+(uv-0.5)/zoom; float win=min(1.0,aspect/imgAspect)*0.94;
  float x=mix(0.5*win,1.0-0.5*win,pan)+(uv.x-0.5)*win; return vec2(x,0.5+(uv.y-0.5)*0.94); }
void main(){ vec2 uv=v; vec2 off=vec2(0.0); float light=0.0;
  for(int i=0;i<16;i++){ float age=t-drops[i].z; if(age<0.0||age>1.8) continue;
    vec2 d=uv-drops[i].xy; d.x*=aspect; float r=length(d)+1e-4; float front=age*0.085;
    float env=exp(-age*2.2)*smoothstep(0.075,0.0,abs(r-front))*smoothstep(0.0,0.012,r);
    float w=cos((r-front)*70.0)*env; off+=(d/r)*w*0.00375; light+=w; }
  off+=still*0.0004*vec2(sin(uv.y*18.0+t*0.9),cos(uv.x*14.0-t*0.7));
  uv+=off; uv.y=1.0-uv.y;
  vec3 c=mix(texture2D(a,cover(uv,panA,zoomA)).rgb,texture2D(b,cover(uv,panB,zoomB)).rgb,mixv);
  c+=vec3(0.70,0.92,1.0)*max(light,0.0)*0.05; c-=vec3(0.08,0.06,0.03)*max(-light,0.0)*0.09;
  gl_FragColor=vec4(c,1.0); }`;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error("shader"); }
      return shader;
    };
    program = gl.createProgram();
    const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("program");
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program,"p");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const photos = [
      ["campus-aerial.jpg","양호동 캠퍼스"], ["campus-hill.jpg","디지털관과 금오산 자락"],
      ["campus-gate.jpg","정문의 밤"], ["campus-field.jpg","대운동장의 저녁"],
    ];
    const photoStates = photos.map(() => "pending");
    const skippedPending = new Set();
    let shownPhoto = null;
    const readyIndices = () => photos.map((_, index) => index).filter(index => photoStates[index] === "ready");
    const refreshProgress = () => {
      progressSteps = readyIndices().map(index => {
        const step = document.createElement("span");
        step.setAttribute("data-campus-step", String(index));
        step.setAttribute("data-current", String(index === shownPhoto));
        return { index, step };
      });
      progressBar?.replaceChildren(...progressSteps.map(({ step }) => step));
    };
    // 준비 중인 파일을 처음 만나면 그 주기만 기다리고, 다음 주기에는 받은 사진끼리 이어 간다.
    const nextPhoto = current => {
      for (let offset = 1; offset < photos.length; offset++) {
        const index = (current + offset) % photos.length;
        if (photoStates[index] === "failed") continue;
        if (photoStates[index] === "ready") return index;
        if (skippedPending.has(index)) continue;
        skippedPending.add(index);
        return null;
      }
      return null;
    };
    const uniforms = Object.fromEntries(["a","b","mixv","t","aspect","imgAspect","panA","panB","zoomA","zoomB","still","drops[0]"].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.uniform1i(uniforms.a,0); gl.uniform1i(uniforms.b,1);
    // 사진마다 1920×280인지 확인한 뒤에만 이 공통 비율로 그린다.
    gl.uniform1f(uniforms.imgAspect,1920/280); gl.uniform1f(uniforms.still,1);
    const drops = new Float32Array(48);
    for (let i=0;i<16;i++) drops[i*3+2]=-1000;
    const HOLD = 24;
    const FADE = 6;
    const period = HOLD + FADE;
    const life = HOLD + 2 * FADE;
    const clamp = value => Math.max(0, Math.min(1, value));
    const pan = (number, local) => {
      const progress = clamp(local / life);
      return number % 2 === 0 ? 0.28 + progress * 0.44 : 0.72 - progress * 0.44;
    };
    const zoom = (number, local) => 1 + 0.05 * (number % 2 === 0 ? clamp(local / life) : 1 - clamp(local / life));
    let cycleNumber = 0;
    let photoNumber = 0;
    let appearedAt = -FADE;
    let currentPhoto = null;
    let fadingPhoto = null;
    let fadeDecided = false;
    let singleStartedAt = null;
    let singlePhase = 0;
    let singleZoomPhase = 0;
    let dropIndex = 0;
    let elapsed = 0;
    let previous = null;
    let automatic = 0;
    let lastPointer = -Infinity;
    let lastX = 0;
    let lastY = 0;
    const drop = (x, y) => {
      const index = (dropIndex++ % 16) * 3;
      drops[index] = x;
      drops[index + 1] = y;
      drops[index + 2] = elapsed;
    };
    const pointer = event => {
      if (stopped || paused || reducedMotion() || document.hidden) return;
      const tooSoon = elapsed * 1000 - lastPointer < 70;
      const tooClose = Math.hypot(event.clientX - lastX, event.clientY - lastY) < 26;
      if (event.type === "pointermove" && (tooSoon || tooClose)) return;
      lastPointer = elapsed * 1000;
      lastX = event.clientX;
      lastY = event.clientY;
      drop(event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight);
    };
    // 먼저 받는 단계에서 들어야 입력란이나 패널이 전파를 멈춰도 포인터 자리에 물결을 남긴다.
    window.addEventListener("pointermove", pointer, { passive: true, capture: true });
    window.addEventListener("pointerdown", pointer, { passive: true, capture: true });
    const draw = timestamp => {
      try {
      frame=null;
      if (document.hidden) { previous=null; return; }
      if (reducedMotion()) { fail(); return; }
      if (!paused && previous !== null) elapsed+=(timestamp-previous)/1000;
      previous=paused ? null : timestamp;
      while (automatic<3 && elapsed >= [0.3,0.9,1.5][automatic]) { drop([0.25,0.67,0.44][automatic],[0.65,0.42,0.25][automatic]); automatic++; }
      const ratio=Math.min(window.devicePixelRatio||1,1.5);
      const width=Math.max(1,Math.round(window.innerWidth*ratio)), height=Math.max(1,Math.round(window.innerHeight*ratio));
      if (canvas.width!==width || canvas.height!==height) { canvas.width=width; canvas.height=height; gl.viewport(0,0,width,height); }
      if (currentPhoto === null) currentPhoto = readyIndices()[0];
      const cycle = Math.floor(elapsed / period);
      while (cycleNumber < cycle) {
        const next = fadeDecided ? fadingPhoto : nextPhoto(currentPhoto);
        if (next !== null) {
          currentPhoto = next;
          photoNumber++;
          appearedAt = cycleNumber * period + HOLD;
          singleStartedAt = null;
        }
        cycleNumber++;
        fadingPhoto = null;
        fadeDecided = false;
      }
      const phase = elapsed - cycle * period;
      if (phase >= HOLD && !fadeDecided) {
        fadingPhoto = nextPhoto(currentPhoto);
        fadeDecided = true;
      }
      const progress = fadingPhoto !== null ? clamp((phase - HOLD) / FADE) : 0;
      const mix = progress * progress * (3 - 2 * progress);
      gl.uniform1f(uniforms.mixv, mix);
      gl.uniform1f(uniforms.t,elapsed);
      gl.uniform1f(uniforms.aspect,width/height);
      let currentPan = pan(photoNumber, elapsed - appearedAt);
      let currentZoom = zoom(photoNumber, elapsed - appearedAt);
      // 늦게 도착한 사진이 있어도 현재 사진의 왕복 흐름은 전환이 끝날 때까지 이어 간다.
      if (singleStartedAt !== null || readyIndices().length === 1) {
        if (singleStartedAt === null) {
          singleStartedAt = elapsed;
          singleZoomPhase = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (currentZoom - 1) / 0.05)));
          singlePhase = Math.acos(Math.max(-1, Math.min(1, (0.5 - currentPan) / 0.22)));
        }
        const local = (elapsed - singleStartedAt) / life;
        currentPan = 0.5 - 0.22 * Math.cos(singlePhase + local * Math.PI);
        currentZoom = 1 + 0.025 * (1 - Math.cos(singleZoomPhase + local * Math.PI));
      }
      gl.uniform1f(uniforms.panA, currentPan);
      gl.uniform1f(uniforms.zoomA, currentZoom);
      gl.uniform1f(uniforms.zoomB, zoom(photoNumber + 1, phase - HOLD));
      gl.uniform1f(uniforms.panB, pan(photoNumber + 1, phase - HOLD));
      gl.uniform3fv(uniforms["drops[0]"],drops);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,textures[currentPhoto]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,textures[fadingPhoto ?? currentPhoto]);
      gl.drawArrays(gl.TRIANGLES,0,6);
      const shownIndex = mix > 0.5 ? fadingPhoto : currentPhoto;
      shownPhoto = shownIndex;
      if (label) label.textContent = photos[shownIndex][1];
      for (const { index, step } of progressSteps) step.setAttribute("data-current", String(index === shownIndex));
      if (caption) caption.hidden = false;
      canvas.hidden=false;
      if (!paused) frame=window.requestAnimationFrame(draw);
      } catch { fail(); }
    };
    toggle?.addEventListener("click", () => {
      paused = !paused;
      try { window.localStorage?.setItem(motionKey, paused ? "paused" : "playing"); } catch {}
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      previous = null;
      renderToggle();
      if (!paused && !stopped && !document.hidden && readyIndices().length && !reducedMotion()) frame = window.requestAnimationFrame(draw);
    });
    window.addEventListener("resize", () => {
      if (paused && !stopped && !document.hidden && readyIndices().length) draw(0);
    });
    motionPreference()?.addEventListener?.("change", event => {
      if (event.matches) fail();
    });
    const showBackdrop = () => {
      if (stopped || document.hidden || frame !== null || !readyIndices().length || reducedMotion()) return;
      if (!paused) frame = window.requestAnimationFrame(draw);
      else if (canvas.hidden) draw(0);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null;
        previous = null;
      } else {
        showBackdrop();
      }
    });
    canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();fail();});
    const loadTexture = async index => {
      let bitmap;
      let texture;
      try {
        const response = await fetch(`/chat-assets/${photos[index][0]}`);
        if (!response.ok) throw new Error("photo");
        bitmap = await createImageBitmap(await response.blob());
        if (bitmap.width !== 1920 || bitmap.height !== 280) throw new Error("photo dimensions");
        if (stopped) { bitmap.close?.(); return; }
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, bitmap);
        textures[index] = texture;
        bitmaps.push(bitmap);
        photoStates[index] = "ready";
        skippedPending.delete(index);
        refreshProgress();
        showBackdrop();
      } catch {
        bitmap?.close?.();
        if (texture) gl.deleteTexture(texture);
        photoStates[index] = "failed";
      }
      if (!stopped && photoStates.every(state => state === "failed")) fail();
    };
    void Promise.allSettled(photos.map((_, index) => loadTexture(index)));
  } catch { fail(); }
}
void initializeCampusBackdrop();
