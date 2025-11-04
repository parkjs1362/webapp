# Google OAuth 2.0 설정 가이드

## 🔧 목차
- [에러 원인](#에러-원인)
- [Step 1: Google Cloud Console 설정](#step-1-google-cloud-console-설정)
- [Step 2: 코드에 CLIENT_ID 입력](#step-2-코드에-clientid-입력)
- [Step 3: 저장 및 새로고침](#step-3-저장-및-새로고침)
- [문제 해결](#문제-해결)

---

## 에러 원인

**400. 오류가 발생했습니다**는 Google OAuth 설정이 완료되지 않았기 때문입니다.

`CLIENT_ID`가 설정되어 있지 않으면 Google 서버가 요청을 거부합니다.

---

## Step 1: Google Cloud Console 설정

### 1.1 Google Cloud Console 열기
```
https://console.cloud.google.com/
```

### 1.2 새 프로젝트 생성
1. 상단 좌측 프로젝트 드롭다운 클릭
2. **"새 프로젝트"** 클릭
3. 프로젝트 이름: `StudyTracker`
4. **"만들기"** 클릭
5. 생성될 때까지 대기 (1-2분)

### 1.3 Google Drive API 활성화
1. 좌측 메뉴 → **"APIs & Services"** → **"Library"**
2. 검색창에 `Google Drive API` 입력
3. 결과에서 **"Google Drive API"** 선택
4. **"활성화"** 클릭
5. 완료 메시지 확인

### 1.4 OAuth 2.0 Web Client 생성
1. 좌측 메뉴 → **"APIs & Services"** → **"Credentials"**
2. **"+ CREATE CREDENTIALS"** 클릭
3. **"OAuth client ID"** 선택
4. 팝업창: `Application type` → **"Web application"** 선택
5. 이름: `StudyTracker` 입력

### 1.5 Authorized JavaScript origins 추가
다음을 **Authorized JavaScript origins** 섹션에 추가:
```
file://
http://localhost:8000
http://127.0.0.1:8000
```

1. **"+ Add URI"** 버튼 클릭
2. 각각 입력하고 추가

### 1.6 Authorized redirect URIs 추가
다음을 **Authorized redirect URIs** 섹션에 추가:
```
https://accounts.google.com/signin/oauth/callback
file://
```

### 1.7 CLIENT_ID 복사
1. **"Create"** 또는 **"Save"** 클릭
2. 팝업에서 `Client ID` 값 복사
   - 형태: `abc123xyz...efgh.apps.googleusercontent.com`
3. 안전한 곳에 임시 저장

---

## Step 2: 코드에 CLIENT_ID 입력

### 2.1 파일 열기
```
C:\Users\CNXK\Downloads\webapp\judicial-scrivener-study-tracker.html
```

**또는**

```
C:\Users\CNXK\Dropbox\code\webapp\judicial-scrivener-study-tracker.html
```

### 2.2 CLIENT_ID 위치 찾기
**Ctrl + G** (또는 Ctrl + F) 를 눌러 Line 6755로 이동:

```javascript
const GOOGLE_CONFIG = {
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',  // ← 이 부분
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    APP_FOLDER: 'StudyTracker-Sync',
};
```

### 2.3 CLIENT_ID 변경
**변경 전:**
```javascript
CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',
```

**변경 후:** (Step 1.7에서 복사한 값)
```javascript
CLIENT_ID: '123456789-abc123xyz456.apps.googleusercontent.com',
```

### 2.4 파일 저장
**Ctrl + S** 또는 File → Save

---

## Step 3: 저장 및 새로고침

### 3.1 브라우저에서 파일 열기
```
file:///C:/Users/CNXK/Downloads/webapp/judicial-scrivener-study-tracker.html
```

### 3.2 완전히 새로고침
- **Ctrl + Shift + Delete** (캐시 제거 후 새로고침)
- 또는 **Ctrl + F5**

### 3.3 로그인 테스트
1. 페이지에서 **"☁️ 로그인"** 버튼 찾기
2. 클릭
3. Google 계정 선택
4. **"계속"** 클릭
5. 권한 요청 확인 및 **"허용"** 클릭

### 3.4 성공 확인
로그인 후:
- ✅ 버튼이 **"🚪 로그아웃"**으로 변경
- ✅ **"⬆️ 업로드"**, **"⬇️ 다운로드"** 버튼 활성화
- ✅ 상태: **"✓ 동기화됨"** 표시

---

## 문제 해결

### Q: 여전히 400 에러가 나요
**A:**
1. CLIENT_ID가 완전히 복사되었는지 확인
2. `'YOUR_GOOGLE_CLIENT_ID_HERE'` 이 텍스트가 아직 남아있지는 않은지 확인
3. 브라우저 캐시 삭제: **Ctrl + Shift + Delete**
4. 브라우저 개발자 도구(F12) → Console 탭에서 에러 메시지 확인

### Q: 로그인 버튼을 클릭해도 아무것도 안 나와요
**A:**
1. 브라우저 콘솔 열기: **F12**
2. **Console** 탭 클릭
3. 빨간 에러 메시지 확인
4. 에러 메시지를 스크린샷으로 공유

### Q: "요청한 클라이언트 ID가 허용 목록에 없습니다"
**A:**
1. Google Cloud Console 확인
2. **Authorized JavaScript origins**에 `file://` 추가되었는지 확인
3. 다시 저장하고 캐시 삭제 후 재시도

### Q: Google Drive에 파일이 안 보여요
**A:**
1. Google Drive 웹사이트 열기: https://drive.google.com
2. 좌측 메뉴에서 **"StudyTracker-Sync"** 폴더 확인
3. 폴더 내 `study-tracker-backup.json` 파일 확인
4. 파일이 없으면 먼저 **"⬆️ 업로드"** 버튼 클릭

### Q: 다른 기기에서 동기화가 안 돼요
**A:**
1. 다른 기기에서도 같은 Google 계정으로 로그인
2. **"⬇️ 다운로드"** 클릭하여 최신 데이터 가져오기
3. 충돌 시 자동으로 최신 버전 선택됨

### Q: CLIENT_ID를 어디에서 찾나요?
**A:**
1. Google Cloud Console 열기
2. **APIs & Services** → **Credentials**
3. **OAuth 2.0 Client IDs** 섹션에서 **"StudyTracker"** 클릭
4. **Client ID** 값 복사

---

## ⚠️ 보안 주의사항

### CLIENT_ID 취급
- ✅ **개인 기기에서 사용 안전**
- ❌ **공개 저장소에 푸쉬하면 안 됨** (주의!)
- ❌ **다른 사람에게 공유하면 안 됨**
- ⚠️ **만약 공개한 경우**: Google Cloud Console에서 CLIENT_ID 삭제 후 새로 생성

### 파일 관리
```
공개 푸쉬 금지:
- judicial-scrivener-study-tracker.html (CLIENT_ID 포함)

해결책:
1. .gitignore에 추가
2. Google Cloud Console에서 CLIENT_ID 재설정
3. 새 파일로 푸쉬
```

---

## 📚 참고 자료

- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Drive API 문서](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 시작 가이드](https://developers.google.com/identity/protocols/oauth2)

---

## ✅ 완료 체크리스트

- [ ] Google Cloud 프로젝트 생성
- [ ] Google Drive API 활성화
- [ ] OAuth 2.0 Web Client 생성
- [ ] Authorized JavaScript origins 추가
- [ ] CLIENT_ID 복사
- [ ] 코드에 CLIENT_ID 입력
- [ ] 파일 저장
- [ ] 브라우저 캐시 삭제 및 새로고침
- [ ] "☁️ 로그인" 버튼으로 테스트
- [ ] Google Drive에 백업 확인

---

**설정이 완료되면 모든 기기에서 자유롭게 데이터를 동기화할 수 있습니다!** 🚀
