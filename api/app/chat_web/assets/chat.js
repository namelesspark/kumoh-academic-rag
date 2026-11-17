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
    "금오공대 학사 안내 · 시연": "Kumoh Tech Academic Guide · Demo",
    "국립금오공과대학교 학사 안내": "Kumoh National Institute of Technology · Academic Guide",
    "근거 조문과 함께 답하는 금오공대 학사 안내": "Academic answers from Kumoh Tech, backed by the regulation articles",
    "졸업까지, 테크모와 함께": "To graduation, with Techmo",
    "물어봐요, 테크모": "Ask Techmo",
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
    "질문 입력 · 사진만 보내도 돼요": "Type a question · or just send a photo",
    "보내기": "Send",
    "첨부 제거": "Remove attachment",
    "글자가 보이는 사진 한 장(JPEG·PNG, 5MB 이하). 서버는 사진을 저장하지 않아요. 얼굴이나 개인정보가 찍힌 사진은 올리지 마세요. 학번, 이름 같은 개인정보는 입력하지 마세요.":
      "One photo with readable text (JPEG or PNG, up to 5 MB). The server does not store photos. Do not upload photos showing faces or personal information. Do not type personal details such as your student number or name.",
    "대화 내용": "Conversation",
    "졸업까지 남은 조건, 테크모가 같이 확인해요": "Techmo checks what is left until graduation with you",
    "규정 질문에는 근거 조문을 붙여 답해요.": "Regulation questions are answered with the supporting articles.",
    "기능 바로가기": "Shortcuts",
    "졸업 체크": "Graduation check",
    "비교과 추천": "Extracurricular picks",
    "사진으로 묻기": "Ask with a photo",
    "규정 질문": "Regulation questions",
    "학사 일정": "Academic calendar",
    "캠퍼스 안내": "Campus guide",
    "가상 학생의 이수 내역으로 남은 졸업 조건을 계산해요.": "Calculates the remaining graduation requirements from a fictional student's records.",
    "졸업 체크 결과 아래에 부족한 점수를 채울 프로그램이 함께 나와요.": "Programs that can fill missing points appear below the graduation check.",
    "포스터나 안내문 사진을 고르면 글자를 읽어 답을 찾아요.": "Pick a photo of a poster or notice and Techmo reads the text to find answers.",
    "궁금한 점을 적으면 근거 조문과 함께 답해요.": "Write your question and get an answer with the supporting articles.",
    "확인한 수강신청 일정을 날짜순으로 보여 줘요.": "Shows confirmed course registration dates in order.",
    "장소를 고르면 용도와 위치를 볼 수 있어요.": "Pick a place to see what it is for and where it is.",
    "가상 학생의 이수 내역으로 남은 졸업 조건을 계산해요. 항목마다 충족·부족·확인 필요를 표로 보여 주고, 적용한 근거를 함께 적어요.":
      "Calculates the remaining graduation requirements from a fictional student's records. Each item is shown as met, short, or needs checking, with the basis applied.",
    "졸업 체크 결과 아래에 부족한 점수를 채울 프로그램이 함께 나와요. 접수 상태와 정원은 공식 페이지에서 다시 확인해 주세요.":
      "Programs that can fill missing points appear below the graduation check. Please recheck application status and capacity on the official page.",
    "글자가 보이는 사진 한 장을 고르면 글자를 읽어 답을 찾아요. JPEG·PNG, 5MB 이하만 받아요. 얼굴이나 개인정보가 찍힌 사진은 올리지 마세요. 사진을 고른 뒤 「보내기」를 눌러 주세요.":
      "Pick one photo with readable text and Techmo reads it to find answers. Only JPEG or PNG up to 5 MB. Do not upload photos showing faces or personal information. After choosing a photo, press “Send”.",
    "궁금한 점을 적으면 근거 조문과 함께 답해요. 근거를 찾지 못하면 지어내지 않고, 찾지 못했다고 알려요.":
      "Write your question and get an answer with the supporting articles. If no basis is found, Techmo says so instead of making things up.",
    "종료일이 지나지 않은 수강신청 일정을 날짜순으로 보여 줘요.": "Shows upcoming course registration dates in order.",
    "졸업 체크 시작": "Start graduation check",
    "졸업 체크와 추천 보기": "See graduation check and picks",
    "사진 선택": "Choose photo",
    "질문 입력하기": "Type a question",
    "테크모 · 새 대화 시작": "Techmo · start a new chat",
    "알림 닫기": "Close notification",
    "언어 / Language: {name}": "Language: {name}",
    "궁금한 점을 물어보세요": "Ask me anything",
    "쉿, 찾아보는 중이에요…": "Shh, looking it up…",
    "찾았어요! 함께 확인해 봐요": "Found it! Let's check together",
    "근거와 함께 안내해 드릴게요": "Here is the answer with its basis",
    "확인할 근거가 더 필요해요": "I need more evidence to confirm",
    "잠시 문제가 생겼어요. 다시 시도해 주세요": "Something went wrong. Please try again",
    "보관함 ({count})": "Archive ({count})",
    "읽지 않은 답변 있음": "Unread replies",
    "답변 기다리는 중": "Waiting for a reply",
    "읽지 않은 답변": "Unread reply",
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
    "‘{title}’ 대화에 답변이 왔어요": "New reply in ‘{title}’",
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
    "생각하는 중": "Thinking",
    "모델이 쓴 원문, 영어일 수 있음": "The model's own words, may be in English",
    "{seconds}초 동안 생각함": "Thought for {seconds}s",
    "이 질문은 가상 규정에서 근거를 찾지 못했어요.": "No basis for this question was found in the fictional regulations.",
    "다시 시도": "Try again",
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
  },
  zh: {
    "금오공대 학사 안내 · 시연": "金乌工大学业指南 · 演示",
    "국립금오공과대학교 학사 안내": "国立金乌工科大学 · 学业指南",
    "근거 조문과 함께 답하는 금오공대 학사 안내": "附上依据条款作答的金乌工大学业指南",
    "졸업까지, 테크모와 함께": "直到毕业，与 Techmo 同行",
    "물어봐요, 테크모": "问问 Techmo",
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
    "질문 입력 · 사진만 보내도 돼요": "输入问题 · 只发照片也可以",
    "보내기": "发送",
    "첨부 제거": "移除附件",
    "글자가 보이는 사진 한 장(JPEG·PNG, 5MB 이하). 서버는 사진을 저장하지 않아요. 얼굴이나 개인정보가 찍힌 사진은 올리지 마세요. 학번, 이름 같은 개인정보는 입력하지 마세요.":
      "一张文字清晰的照片（JPEG·PNG，5MB 以内）。服务器不会保存照片。请勿上传含有人脸或个人信息的照片。请勿输入学号、姓名等个人信息。",
    "대화 내용": "对话内容",
    "졸업까지 남은 조건, 테크모가 같이 확인해요": "距离毕业还差什么，Techmo 陪你一起确认",
    "규정 질문에는 근거 조문을 붙여 답해요.": "规定问题会附上依据条款作答。",
    "기능 바로가기": "功能快捷入口",
    "졸업 체크": "毕业检查",
    "비교과 추천": "非学科活动推荐",
    "사진으로 묻기": "用照片提问",
    "규정 질문": "规定咨询",
    "학사 일정": "学年日程",
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
    "테크모 · 새 대화 시작": "Techmo · 开始新对话",
    "알림 닫기": "关闭通知",
    "언어 / Language: {name}": "语言 / Language：{name}",
    "궁금한 점을 물어보세요": "有什么问题尽管问吧",
    "쉿, 찾아보는 중이에요…": "嘘，正在查找…",
    "찾았어요! 함께 확인해 봐요": "找到了！一起看看吧",
    "근거와 함께 안내해 드릴게요": "为你附上依据进行说明",
    "확인할 근거가 더 필요해요": "还需要更多依据来确认",
    "잠시 문제가 생겼어요. 다시 시도해 주세요": "出了点问题，请重试",
    "보관함 ({count})": "归档（{count}）",
    "읽지 않은 답변 있음": "有未读回答",
    "답변 기다리는 중": "等待回答中",
    "읽지 않은 답변": "未读回答",
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
    "‘{title}’ 대화에 답변이 왔어요": "“{title}”有新的回答",
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
    "생각하는 중": "思考中",
    "모델이 쓴 원문, 영어일 수 있음": "模型原文，可能是英文",
    "{seconds}초 동안 생각함": "思考了 {seconds} 秒",
    "이 질문은 가상 규정에서 근거를 찾지 못했어요.": "在虚拟规定中未找到此问题的依据。",
    "다시 시도": "重试",
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
// 알림 줄처럼 나중에 다시 그릴 문구는 [원문, 값] 짝으로 넘길 수 있다.
function tr(message) {
  return Array.isArray(message) ? t(message[0], message[1]) : t(message);
}
function onLangChange(listener) {
  langListeners.push(listener);
}
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

// 저장 객체는 허용한 텍스트 필드만 복사한다. DOM과 서버 세션은 저장하지 않는다.
function trimConversations(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(record => record && !record.photo && typeof record.id === "string" && Array.isArray(record.messages))
    .map(record => ({
      id: record.id, time: Number(record.time) || 0, unread: record.unread === true,
      // 보관은 true일 때만 인정한다. 없거나 깨진 값은 보관하지 않은 대화로 본다. 20개 한도는 보관 여부와 무관하다.
      archived: record.archived === true,
      title: conversationTitle(record),
      messages: record.messages.filter(message => message && !message.photo &&
        ["question", "answer"].includes(message.role) && typeof message.text === "string" &&
        !/\b\d{8,10}\b/.test(message.text))
        .slice(-40).map(message => ({ role: message.role, text: message.text,
          time: Number(message.time) || 0,
          // 보류와 안내 답은 boolean으로만 남긴다. 필드가 없는 옛 기록은 보류로 바꾸지 않는다.
          ...(message.role === "answer" && message.answered === false ? { answered: false } : {}),
          ...(message.role === "answer" && message.answered === false && message.guided === true ? { guided: true } : {}),
          sources: (Array.isArray(message.sources) ? message.sources : [])
            .filter(source => source && typeof source.title === "string" && isSafeSourceUrl(source.url))
            .map(source => ({ title: source.title, url: source.url })) })),
    })).filter(record => record.messages.length).sort((a, b) => b.time - a.time).slice(0, 20);
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
  dismissConversationToast();
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
  scrollToLatest();
}
function openConversation(record) {
  if (!conversations.includes(record)) return;
  if (toastRecord === record) dismissConversationToast();
  activeConversation = record;
  record.unread = false;
  if (!record.turns) {
    record.turns = [];
    for (const message of record.messages) {
      if (message.role === "question" || !record.turns.length) record.turns.push(element("div", "turn"));
      const node = record.turns[record.turns.length - 1];
      const held = message.role === "answer" && message.answered === false && message.guided !== true;
      node.append(element("p", message.role === "question" ? "question" : held ? "reply fallback" : "reply", message.text));
      for (const source of message.sources || []) {
        const link = sourceLink(source.url, source.title, source.title);
        if (link) node.append(link);
      }
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
    dot.append(element("span", "sr-only", t("읽지 않은 답변 있음")));
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
    pending.append(element("span", "sr-only", t("답변 기다리는 중")));
    open.append(pending);
  }
  if (record.unread) {
    const dot = element("span", "conversation-unread");
    dot.append(element("span", "sr-only", t("읽지 않은 답변")));
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
  conversations = conversations.filter(value => value !== record);
  if (toastRecord === record) dismissConversationToast();
  if (activeConversation === record) { activeConversation = null; renderActiveConversation(); }
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
  return t("‘{title}’ 대화에 답변이 왔어요", { title: Array.from(conversationTitle(record)).slice(0, 20).join("") });
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
  if (loginScreen) loginScreen.hidden = main;
  if (mainScreen) mainScreen.hidden = !main;
  document.body?.setAttribute("data-screen", main ? "main" : "login");
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
function updateSend() {
  const attached = Boolean(photoFile.files?.length);
  const pending = busy || (requestedChatView && Boolean(activeConversation?.pending));
  send.disabled = pending || (!input.value.trim() && !attached);
  photoClear.hidden = !attached;
  photoClear.disabled = pending;
  photoFile.disabled = pending;
  photoAttach.disabled = pending;
  reset.disabled = pending;
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
    if (account !== historyAccount || !conversations.includes(record)) return;
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
  if (program.mileage_status === "announced") return "마일리지 지급 공지 · 정확한 점수 확인 필요";
  return "마일리지 미공개";
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
  card.append(element("p", "mileage", mileageText(program)));

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
function biskitRecommendations(recommendation) {
  try {
    if (recommendation === null || typeof recommendation !== "object" || Array.isArray(recommendation)) return null;
    const shortfall = recommendation.shortfall_points;
    if (!Number.isInteger(shortfall) || shortfall < 1 || !Array.isArray(recommendation.programs)) return null;

    const section = element("section", "biskit");
    section.append(element("h3", null, `BISKIT 추천 · ${shortfall}점 부족`));

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
    const recommendations = biskitRecommendations(result.biskit_recommendations);
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
    return [card, t("행사를 찾았어요. {title}", { title: result.event.title })];
  }
  if (kind === "hold") {
    // 서버가 아는 사유 이름을 보냈으면 그 문구를, 아니면 일반 보류 문구를 쓴다. 보류에는 출처를 그리지 않는다.
    const reason = result.hold_reason;
    const known = typeof reason === "string" && Object.hasOwn(photoNeedsCheck, reason);
    return [needsCheckCard([known ? photoNeedsCheck[reason] : photoMessages.held]), t("답변을 보류했어요. 링크는 보여 주지 않아요.")];
  }
  if (!Object.hasOwn(textAnswerKinds, kind)) throw new TypeError("Malformed photo answer");
  const answer = typeof result.answer === "string" ? shownText(result.answer) : null;
  if (!answer) throw new TypeError("Malformed photo answer");

  const section = element("section", "text-answer");
  section.append(element("h3", null, t(textAnswerKinds[kind])), element("p", null, answer));
  const sources = sourceList(result.sources);
  if (sources) section.append(sources);
  return [section, t("{kind}에서 답을 찾았어요.", { kind: t(textAnswerKinds[kind]) })];
}

// 사진 없이 글자만 보낸다. 실패하면 같은 글자로만 다시 시도한다.
async function answerFromText(question, recognized, answer, record = null) {
  const account = historyAccount;
  say(statusLine, photoMessages.asking);
  photoNote.textContent = "";
  answer.replaceChildren();

  const { result, failure, status } = await requestJson("/api/v1/photo-question", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ question, recognized_text: recognized, session_id: record ? record.sessionId || null : sessionId }),
    signal: AbortSignal.timeout(90_000),
  }, photoMessages.textFailed);

  if (record && (account !== historyAccount || !conversations.includes(record))) return false;
  let message = failure;
  if (!failure) {
    try {
      const [node, summary] = textAnswer(result);
      answer.append(node);
      photoNote.textContent = summary;
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
      summary: t("행사를 찾았어요. {title}", { title: result.event.title }),
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
    summary: t(problem === photoMessages.tooLong ? photoMessages.tooLong : "사진에서 확인한 내용이 없어요. 링크는 보여 주지 않아요."),
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
      photoNote.textContent = shown.summary;
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
function openChoiceMenu(button, title, choices, onSelect) {
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
  menu.addEventListener("keydown", event => {
    const index = Math.max(0, items.indexOf(document.activeElement));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
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
  items[Math.max(0, choices.findIndex(choice => choice.checked))]?.focus();
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
  let effectVersion = 0;
  function render(animate = false) {
    const version = ++effectVersion, deep = aiMode === "deep";
    button.dataset.mode = aiMode;
    button.setAttribute("aria-label", t("답변 모드: {name}", { name: t(deep ? "깊이 생각" : "빠르게") }));
    if (label) label.textContent = t(deep ? "깊이 생각" : "빠르게");
    icons.forEach((icon, index) => {
      if (!icon) return;
      if (deep !== Boolean(index)) icon.setAttribute("hidden", "");
      else icon.removeAttribute("hidden");
    });
    row?.classList.toggle("is-deep", deep);
    button.classList.remove("is-bursting", "is-flowing"); row?.classList.remove("is-deep-enter");
    button.querySelectorAll(".mode-spark").forEach(spark => spark.remove());
    if (!deep || reducedMotion()) return;
    button.classList.add("is-flowing");
    if (!animate) return;
    button.classList.add("is-bursting"); row?.classList.add("is-deep-enter");
    const sparks = Array.from({ length: 7 }, () => element("span", "mode-spark", "✦"));
    sparks.forEach(spark => { spark.setAttribute("aria-hidden", "true"); button.append(spark); });
    setTimeout(() => { sparks.forEach(spark => spark.remove()); if (version === effectVersion) button.classList.remove("is-bursting"); }, 700);
    setTimeout(() => { if (version === effectVersion) row?.classList.remove("is-deep-enter"); }, 900);
  }
  render();
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
    });
  }
  button.addEventListener("click", open);
  button.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); open(); }
  });
}
setupAiMode();

// 언어 선택기(#116). 머리글과 로그인 화면의 두 알약 버튼이 같은 언어 상태를 쓰고, 메뉴는 답변 모드와 같은 openChoiceMenu다.
// 기본 드롭다운(select)은 쓰지 않는다. 고르면 새로고침 없이 지금 보이는 글을 바꾼다.
const langButtons = [];
let staticTouched = false, titlesTouched = false;
const staticSources = new WeakMap();
// 문서에 적힌 고정 문구만 바꾼다. 아래 자리는 스크립트가 직접 그리거나(메뉴·확인 창·제목), 서버 글과 사용자 글이 들어간다.
const staticSkip = [".turn", "#conversation-list", "[data-panel-content]", ".title-fallback", ".main-title-fallback",
  "#ai-mode-button", ".lang-pill", ".choice-menu", ".conversation-menu", ".confirm-scrim", "#campus-caption",
  "#demo-label", "#conversation-toast-open", "#conversation-announce"].join(", ");
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
  renderLangButtons();
  labelConversationMenu();
  labelConfirm();
  const toastOpen = document.querySelector("#conversation-toast-open");
  if (toastRecord && toastOpen) toastOpen.textContent = toastLine(toastRecord);
  renderConversations();
  for (const listener of langListeners) listener();
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
// 제목 그림에는 한국어 글씨가 들어 있다. 영어·중국어에서는 그림 자리를 숨기고 이 글자 제목을 보인다.
function renderTitles() {
  if (uiLang === "ko" && !titlesTouched) return;
  titlesTouched = true;
  const em = text => element("em", null, text);
  const span = (...parts) => { const node = element("span"); node.append(...parts); return node; };
  const [login, main] = {
    ko: [["졸업까지,", span(em("테크모"), "와 함께")], ["물어봐요, ", em("테크모")]],
    en: [["To graduation,", span("with ", em("Techmo"))], ["Ask ", em("Techmo")]],
    zh: [["直到毕业，", span("与 ", em("Techmo"), " 同行")], ["问问 ", em("Techmo")]],
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
async function requestChatAnswer(body, onEvent) {
  const options = { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(100_000) };
  let meta = null, answer = "", notice, done = null;
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
    return result;
  } catch {
    onEvent("reset", {});
    const response = await fetch("/api/v1/chat", { ...options, signal: AbortSignal.timeout(100_000) });
    if (!response.ok) throw new Error("Chat request failed");
    return response.json();
  }
}

async function ask(question, reply, record = activeConversation) {
  if (record?.pending) return;
  const account = historyAccount;
  if (record) record.pending = true;
  else setBusy(true);
  showAssistant("searching");
  updateSend(); renderConversations();
  reply.replaceChildren();
  const mode = aiMode;
  // 답변 언어는 보낼 때 정한다. 답을 기다리는 동안 언어를 바꾸면 다음 질문부터 적용되고, JSON으로 다시 물을 때도 같은 값을 쓴다.
  const lang = uiLang;
  const requestNumber = ++chatRequestNumber;
  const valid = () => !record || (account === historyAccount && conversations.includes(record));
  const visible = () => valid() && (!record || (requestedChatView && activeConversation === record));
  let answerNode = null, thinking = null, thinkingContent = null, thinkingLabel = null;
  const thinkingStarted = Date.now();
  let thinkingFinished = false;
  function startThinking() {
    if (mode !== "deep" || thinking) return;
    thinkingFinished = false;
    thinking = element("details", "thinking"); thinking.id = `thinking-${requestNumber}`;
    thinking.classList.add("is-waiting");
    const summary = element("summary"); summary.id = `${thinking.id}-summary`;
    thinkingLabel = element("span", null, t("생각하는 중"));
    summary.append(thinkingLabel, element("small", null, t("모델이 쓴 원문, 영어일 수 있음")));
    thinkingContent = element("p"); thinkingContent.id = `${thinking.id}-content`;
    thinking.append(summary, thinkingContent); reply.append(thinking);
  }
  function finishThinking() {
    if (!thinking || thinkingFinished) return;
    thinkingFinished = true;
    thinking.classList.remove("is-waiting"); thinking.open = false;
    thinkingLabel.textContent = t("{seconds}초 동안 생각함", { seconds: Math.max(0, Math.round((Date.now() - thinkingStarted) / 1000)) });
  }
  startThinking();
  try {
    const result = await requestChatAnswer({ message: question,
      session_id: record ? record.sessionId || null : sessionId, use_academic_data: false, mode, lang }, (name, data) => {
      if (!valid()) return;
      if (name === "reset") {
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
    });
    if (record && (account !== historyAccount || !conversations.includes(record))) return;
    if (record) record.sessionId = result.session_id;
    else sessionId = result.session_id;
    // 안내 답은 근거 없이 받은 글 그대로 일반 말풍선에 그린다. 보류는 서버가 고른 언어로 쓴 보류 문구를 그대로 그리고,
    // 서버 글이 없거나 비었을 때만 화면의 고정 보류 문구를 쓴다.
    const spoken = typeof result.answer === "string" && result.answer.trim() !== "";
    const guided = result.answered !== true && result.guided === true && spoken;
    const text = result.answered || guided || spoken ? result.answer : t("이 질문은 가상 규정에서 근거를 찾지 못했어요.");
    if (!answerNode) { answerNode = element("p"); reply.append(answerNode); }
    answerNode.className = result.answered || guided ? "" : "fallback";
    answerNode.textContent = text;
    if (result.answered && result.notice) reply.append(element("small", "ai-notice", result.notice));
    const citations = result.answered && Array.isArray(result.citations) ? result.citations : [];
    for (const citation of citations) reply.append(citationCard(citation));
    if (record) {
      record.messages.push({ role: "answer", text, time: Date.now(), sources: citations.map(citation => ({
        title: citation.document + " · " + citation.article_path, url: citation.source_url,
      })), ...(result.answered ? {} : { answered: false }), ...(guided ? { guided: true } : {}) });
      record.messages = record.messages.slice(-40);
      record.time = Date.now(); record.saved = true;
      record.committedMessages = [
        ...(record.committedMessages || []),
        { role: "question", text: question, time: record.time, sources: [] },
        record.messages[record.messages.length - 1],
      ].slice(-40);
      if (!requestedChatView || activeConversation !== record || document.hidden) notifyConversation(record);
      else if (result.answered) celebrate();
      else showAssistant("hold");
      persistConversations();
    } else if (result.answered) celebrate();
    else showAssistant("hold");
  } catch {
    if (record && (account !== historyAccount || !conversations.includes(record))) return;
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
      persistConversations();
    }
    else showAssistant("error");
  } finally {
    finishThinking();
    if (!valid()) thinking?.remove();
    if (record) record.pending = false;
    else setBusy(false);
    renderConversations(); updateSend(); scrollToLatest();
  }
}
input.addEventListener("input", updateSend);
input.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
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
  record.messages.push({ role: "question", text: question, time: Date.now(), sources: [] });
  record.messages = record.messages.slice(-40);
  if (!chatView || !requestedChatView) setChatView(true);
  const turn = element("div", "turn");
  const prompt = element("p", "question");
  prompt.append(element("span", "sr-only", t("내 질문: ")));
  if (question) prompt.append(document.createTextNode(question));
  // 파일명은 화면에 적지 않는다. 사진을 붙였다는 사실만 보여 준다.
  if (file) prompt.append(element("span", "attachment", t("사진 1장")));
  const reply = element("div", file ? "reply photo" : "reply");
  turn.append(prompt, reply);
  record.turns.push(turn);
  if (record.turns.length > 20) record.turns.shift().remove();
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
// 두 제목 그림에는 한국어 글씨가 들어 있다. 한국어가 아닌 화면에서는 그림이 늦게 받아져도 자리를 숨긴 채 두어
// 바로 뒤의 번역한 글자 제목이 보이게 한다. 언어를 바꾸면 같은 판정을 다시 한다.
for (const slot of document.querySelectorAll?.("[data-brand-slot]") ?? []) {
  const image = slot.querySelector("img");
  if (!image) continue;
  const lettering = /(^|\s)(title|main)-lettering(\s|$)/.test(typeof slot.className === "string" ? slot.className : "");
  const settle = () => {
    slot.hidden = !(image.complete && image.naturalWidth > 0) || (lettering && uiLang !== "ko");
    configureTechmoSprite(slot, image);
    if (slot === pet && !slot.hidden) {
      restoreTechmoPosition();
      techmoBubble();
    }
  };
  image.addEventListener("load", settle);
  image.addEventListener("error", settle);
  if (lettering) onLangChange(settle);
  settle();
}

updateSend();
refreshTechmoBubbleVisibility();
if (window.location?.hash === "#chat") {
  window.history?.replaceState(null, "", window.location.pathname + window.location.search);
}
switchHistoryAccount("browse");
setupLang();
void restoreStudent();

const calendarScope = { year: 2027, semester: 1 };
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
    line.append((checked && sourceLink(source.url, source.title, "출처")) || element("span", null, source.title));
    if (checked) line.append(document.createTextNode(" · 확인일 "), dateNode(source.checked_on, true));
    box.append(line);
  }
  box.append(element("p", "hint", "공식 페이지에서 다시 확인해 주세요."));
  return box;
}
function renderCalendar(content, result) {
  if (!Array.isArray(result?.events) || result.events.some(event => !event || typeof event.audience !== "string" ||
    !isPanelDate(event.starts_on) || !isPanelDate(event.ends_on) || event.ends_on < event.starts_on)) throw new Error("format");
  const scope = `${calendarScope.year}학년도 ${calendarScope.semester}학기 수강신청`;
  content.replaceChildren(element("h5", null, scope));
  const today = panelTodayInKorea();
  const events = result.events.filter(event => event.ends_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (!events.length) content.append(element("p", "hint", `${scope}에 남은 일정이 없어요.`));
  for (const event of events) {
    const row = element("section", "evidence");
    const dates = element("p");
    dates.append(dateNode(event.starts_on, true));
    if (event.starts_on !== event.ends_on) dates.append(document.createTextNode(" ~ "), dateNode(event.ends_on, true));
    row.append(element("h5", null, event.audience), dates, panelSources(event.sources));
    content.append(row);
  }
  return events.length;
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
      const count = calendar ? renderCalendar(content, response.result) : renderCampus(content, response.result);
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
      varying vec2 v; uniform sampler2D a,b; uniform float mixv,t,aspect,imgAspect,panA,panB,still;
      uniform vec3 drops[16];
vec2 cover(vec2 uv, float pan){ float win=min(1.0,aspect/imgAspect)*0.94;
  float x=mix(0.5*win,1.0-0.5*win,pan)+(uv.x-0.5)*win; return vec2(x,0.5+(uv.y-0.5)*0.94); }
void main(){ vec2 uv=v; vec2 off=vec2(0.0); float light=0.0;
  for(int i=0;i<16;i++){ float age=t-drops[i].z; if(age<0.0||age>1.8) continue;
    vec2 d=uv-drops[i].xy; d.x*=aspect; float r=length(d)+1e-4; float front=age*0.085;
    float env=exp(-age*2.2)*smoothstep(0.075,0.0,abs(r-front))*smoothstep(0.0,0.012,r);
    float w=cos((r-front)*70.0)*env; off+=(d/r)*w*0.0075; light+=w; }
  off+=still*0.0008*vec2(sin(uv.y*18.0+t*0.9),cos(uv.x*14.0-t*0.7));
  uv+=off; uv.y=1.0-uv.y;
  vec3 c=mix(texture2D(a,cover(uv,panA)).rgb,texture2D(b,cover(uv,panB)).rgb,mixv);
  c+=vec3(0.70,0.92,1.0)*max(light,0.0)*0.10; c-=vec3(0.08,0.06,0.03)*max(-light,0.0)*0.18;
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
    const readyIndices = () => photos.map((_, index) => index).filter(index => photoStates[index] === "ready");
    const refreshProgress = () => {
      progressSteps = readyIndices().map(index => {
        const step = document.createElement("span");
        step.setAttribute("data-campus-step", String(index));
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
    const uniforms = Object.fromEntries(["a","b","mixv","t","aspect","imgAspect","panA","panB","still","drops[0]"].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.uniform1i(uniforms.a,0); gl.uniform1i(uniforms.b,1);
    // 사진마다 1920×280인지 확인한 뒤에만 이 공통 비율로 그린다.
    gl.uniform1f(uniforms.imgAspect,1920/280); gl.uniform1f(uniforms.still,1);
    const drops = new Float32Array(48);
    for (let i=0;i<16;i++) drops[i*3+2]=-1000;
    const HOLD = 9;
    const FADE = 3.2;
    const period = HOLD + FADE;
    const life = HOLD + 2 * FADE;
    const clamp = value => Math.max(0, Math.min(1, value));
    const pan = (number, local) => {
      const progress = clamp(local / life);
      return number % 2 === 0 ? 0.28 + progress * 0.44 : 0.72 - progress * 0.44;
    };
    let cycleNumber = 0;
    let photoNumber = 0;
    let appearedAt = -FADE;
    let currentPhoto = null;
    let fadingPhoto = null;
    let fadeDecided = false;
    let singleStartedAt = null;
    let singlePhase = 0;
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
      if (stopped || reducedMotion() || document.hidden) return;
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
      if (previous !== null) elapsed+=(timestamp-previous)/1000;
      previous=timestamp;
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
      // 늦게 도착한 사진이 있어도 현재 사진의 왕복 흐름은 전환이 끝날 때까지 이어 간다.
      if (singleStartedAt !== null || readyIndices().length === 1) {
        if (singleStartedAt === null) {
          singleStartedAt = elapsed;
          singlePhase = Math.acos(Math.max(-1, Math.min(1, (0.5 - currentPan) / 0.22)));
        }
        const local = (elapsed - singleStartedAt) / life;
        currentPan = 0.5 - 0.22 * Math.cos(singlePhase + local * Math.PI);
      }
      gl.uniform1f(uniforms.panA, currentPan);
      gl.uniform1f(uniforms.panB, pan(photoNumber + 1, phase - HOLD));
      gl.uniform3fv(uniforms["drops[0]"],drops);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,textures[currentPhoto]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,textures[fadingPhoto ?? currentPhoto]);
      gl.drawArrays(gl.TRIANGLES,0,6);
      const shownIndex = mix > 0.5 ? fadingPhoto : currentPhoto;
      if (label) label.textContent = photos[shownIndex][1];
      for (const { index, step } of progressSteps) step.setAttribute("data-current", String(index === shownIndex));
      if (caption) caption.hidden = false;
      canvas.hidden=false;
      frame=window.requestAnimationFrame(draw);
      } catch { fail(); }
    };
    document.addEventListener("visibilitychange",()=>{
      if (document.hidden) { if(frame!==null) window.cancelAnimationFrame(frame); frame=null; previous=null; }
      else if(!stopped && frame===null && readyIndices().length && !reducedMotion()) frame=window.requestAnimationFrame(draw);
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
        if (!document.hidden && frame === null) frame = window.requestAnimationFrame(draw);
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
