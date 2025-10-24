# 사법시험 학습 시스템 v3.0.0 구현 가이드

**버전**: v3.0.0
**상태**: 구현 준비 완료
**마지막 업데이트**: 2025-10-24

---

## 📋 목차

1. [개요](#개요)
2. [파일 구조](#파일-구조)
3. [모듈 설명](#모듈-설명)
4. [HTML 통합 방법](#html-통합-방법)
5. [마이그레이션 프로세스](#마이그레이션-프로세스)
6. [API 가이드](#api-가이드)
7. [테스트 체크리스트](#테스트-체크리스트)
8. [배포 절차](#배포-절차)

---

## 개요

### v3.0.0의 핵심 변화

| 항목 | v2.14.0 | v3.0.0 |
|------|---------|--------|
| 데이터 저장 방식 | 단일 JSON (studyData) | 정규화 Entity (7개) |
| 관계 정의 | 암묵적 | 명시적 (FK 기반) |
| 자동 동기화 | 부분적 | 완전 자동 (Observer) |
| 효율성 분석 | 기본 | 고급 (AI 기반 권고) |
| 호환성 | - | v2.14.0 완전 호환 |

### 기대 효과

✅ **명확한 데이터 관계**: Entity 간 관계가 명시적으로 정의됨
✅ **자동 동기화**: 데이터 변경 시 종속 데이터 자동 업데이트
✅ **학습 효율성**: 계획 대비 실제 학습을 자동으로 분석 및 개선안 제시
✅ **지능형 권고**: 각 학습자의 상황에 맞는 맞춤형 권고
✅ **하위호환성**: 기존 사용자 데이터 100% 보존 및 자동 마이그레이션

---

## 파일 구조

### 현재 파일들

```
judicial-scrivener-study-tracker.html
├── Version: 2.14.0 (기존)
└── 새로운 모듈들을 추가할 예정

신규 추가 파일들:
├── DATA_SCHEMA_v3.0.md              # 데이터 스키마 설계 문서
├── migration-v2-to-v3.js             # 마이그레이션 모듈
├── sync-manager-v3.0.js              # 자동 동기화 매니저
├── analytics-engine-v3.0.js          # 분석 엔진
└── IMPLEMENTATION_GUIDE_v3.0.md      # 이 문서
```

### 추가 필요 파일 (구현 시)

```
html 파일 내부:
├── <script src="migration-v2-to-v3.js"></script>
├── <script src="sync-manager-v3.0.js"></script>
├── <script src="analytics-engine-v3.0.js"></script>
└── <script>
    // 통합 초기화 로직 (아래 참고)
    </script>
```

---

## 모듈 설명

### 1. migration-v2-to-v3.js
**역할**: v2.14.0 데이터를 v3.0.0으로 자동 변환

**주요 함수**:
```javascript
// 자동 마이그레이션 (권장)
const v3Data = window.DataMigration.autoMigrate();

// 수동 마이그레이션
const oldData = localStorage.getItem('studyData');
const v3Data = window.DataMigration.migrate(JSON.parse(oldData));
window.DataMigration.save(v3Data);

// 데이터 검증
const validation = window.DataMigration.validate(v3Data);
```

**동작**:
1. localStorage의 v2.14.0 데이터 확인
2. 자동으로 v3.0.0 구조로 변환
3. UUID 기반 ID 생성
4. 정규화된 Entity로 분해
5. localStorage에 저장

**특징**:
- ✅ v2.14.0 데이터 100% 호환
- ✅ 자동 UUID 생성
- ✅ 관계 데이터 자동 매핑
- ✅ 에러 시 자동 롤백

---

### 2. sync-manager-v3.0.js
**역할**: 데이터 변경 감지 및 자동 동기화

**주요 클래스**: `SyncManager`

**초기화**:
```javascript
const syncMgr = new SyncManager(v3Data);
```

**주요 메서드**:

#### 데이터 변경 감지
```javascript
// TimeBlock 완료 시
syncMgr.onTimeBlockCompleted(timeBlock);
  → StudyLog 자동 생성
  → Subject 통계 업데이트
  → LearningHistory 업데이트
  → Streak 계산
  → localStorage 저장

// MockExam 기록 시
syncMgr.onMockExamRecorded(mockExam);
  → Subject 점수 통계 업데이트
  → 취약 과목 식별
  → LearningHistory 업데이트

// Subject 진도 변경
syncMgr.onSubjectProgressChanged(subjectId, newProgress);
  → StudyPlan 진도 업데이트
```

#### Observer 패턴
```javascript
// 이벤트 리스너 등록
syncMgr.on('timeBlockCompleted', (data) => {
    console.log('TimeBlock completed:', data.timeBlock);
    // UI 업데이트 등
});

syncMgr.on('synced', (data) => {
    console.log('Data synced:', data.timestamp);
});

syncMgr.on('weakSubjectsIdentified', (data) => {
    console.log('Weak subjects:', data.weakSubjects);
});
```

#### Cascade Update
```javascript
// TimeBlock 완료 → 자동 업데이트 체인
1. TimeBlock.status = 'completed'
2. StudyLog 생성
3. Subject 통계 재계산
4. StudyPlan 진도 업데이트
5. LearningHistory 업데이트
6. Streak 계산
7. 이벤트 발생
8. localStorage 저장
```

#### 동기화 제어
```javascript
// 수동 동기화
syncMgr.sync();

// 예약 동기화 (500ms 지연)
syncMgr.scheduleSync();

// 동기화 상태 확인
console.log(v3Data.metadata.lastSync);
console.log(v3Data.metadata.storageSize);
```

---

### 3. analytics-engine-v3.0.js
**역할**: 학습 효율성 분석 및 지능형 권고

**주요 클래스**: `AnalyticsEngine`

**초기화**:
```javascript
const analytics = new AnalyticsEngine(v3Data);
```

**주요 기능**:

#### 1. 학습 통계
```javascript
// 오늘 학습 분석
const today = analytics.getTodayAnalysis();
// {
//   date, totalHours, plannedHours, efficiency,
//   subjects: [{name, hours, blockCount}],
//   status, recommendation
// }

// 주간 분석
const week = analytics.getWeeklyAnalysis();
// { weekStart, totalHours, avgEfficiency, studyDays, ... }

// 월간 분석
const month = analytics.getMonthlyAnalysis();
// { month, totalHours, subjectStats, ... }
```

#### 2. 효율성 점수
```javascript
// 종합 효율성 점수 (0-100)
const score = analytics.getOverallEfficiencyScore();
// {
//   overall: 75,
//   breakdown: {
//     timeEfficiency: 80,      // 계획 대비 실제 (40%)
//     progressRate: 65,        // 진도율 (30%)
//     mockScore: 72,           // 모의고사 (20%)
//     streakScore: 85          // 연속성 (10%)
//   },
//   rating: { level: 'B+', emoji: '👍', label: '양호' }
// }
```

#### 3. 취약점 분석
```javascript
// 취약 과목 상세 분석
const weakness = analytics.getWeakSubjectsAnalysis();
// {
//   totalWeakSubjects: 2,
//   bySubject: [{
//     name, currentScore, issues: [],
//     recommendations: [{
//       priority, action, description, timeline
//     }]
//   }]
// }
```

#### 4. 학습 패턴
```javascript
// 과목별 학습 패턴
const patterns = analytics.getSubjectLearningPatterns();
// {
//   bySubject: [{
//     name, totalSessions, lastStudy,
//     recentWeekSessions, estimatedCompletion,
//     paceStatus
//   }]
// }
```

#### 5. 종합 권고
```javascript
// 종합 분석 리포트
const report = analytics.generateComprehensiveReport();
// {
//   efficiencyScore: { overall, breakdown, rating },
//   recommendations: [
//     { priority, title, description, actions }
//   ],
//   nextMilestone: { milestone, remaining, daysNeeded }
// }
```

---

## HTML 통합 방법

### Step 1: 스크립트 로드

HTML 파일의 `</body>` 전 에 다음 추가:

```html
<script>
    // 기존 studyData 변수 선언 (현재 그대로 유지)
    let studyData = { ... };

    // v3.0.0 관련 변수
    let v3Data = null;
    let syncMgr = null;
    let analytics = null;
</script>

<!-- 신규 모듈 로드 -->
<script src="migration-v2-to-v3.js"></script>
<script src="sync-manager-v3.0.js"></script>
<script src="analytics-engine-v3.0.js"></script>

<script>
    // v3.0.0 초기화 (아래 참고)
</script>
```

### Step 2: v3.0.0 초기화

기존 `loadData()` 함수 이후에 다음 추가:

```javascript
// === v3.0.0 초기화 ===
function initializeV3() {
    // 1. 자동 마이그레이션
    v3Data = window.DataMigration.autoMigrate();

    if (!v3Data) {
        console.error('Migration failed, falling back to v2.14.0');
        return false;
    }

    console.log('✅ v3.0.0 initialization successful');
    console.log('v3Data:', v3Data);

    // 2. SyncManager 초기화
    syncMgr = new SyncManager(v3Data);

    // 3. Observer 리스너 등록
    setupObservers();

    // 4. AnalyticsEngine 초기화
    analytics = new AnalyticsEngine(v3Data);

    return true;
}

function setupObservers() {
    // TimeBlock 완료 시 UI 업데이트
    syncMgr.on('timeBlockCompleted', (data) => {
        console.log('TimeBlock completed:', data.timeBlock);
        // renderTimeBlocks(); // UI 업데이트
    });

    // 데이터 동기화 완료 시
    syncMgr.on('synced', (data) => {
        console.log('Data synced:', data);
        // updateSyncStatus(); // 동기화 상태 표시
    });

    // 취약 과목 식별 시
    syncMgr.on('weakSubjectsIdentified', (data) => {
        console.log('Weak subjects:', data.weakSubjects);
        // displayWeakSubjectWarnings(data.weakSubjects);
    });

    // Streak 업데이트
    syncMgr.on('streakUpdated', (streak) => {
        console.log('Streak updated:', streak);
        // updateStreakDisplay(streak);
    });
}
```

### Step 3: 기존 함수 개선 (v3 연동)

#### toggleTimeBlock() 개선

```javascript
function toggleTimeBlock(id) {
    // 기존 코드
    const block = studyData.timeBlocks.find(b => b.id === id);
    if (block) {
        block.completed = !block.completed;

        // ... 기존 studyData 업데이트 ...

        // v3.0.0 동기화 추가
        if (v3Data && syncMgr) {
            const v3Block = v3Data.timeBlocks.find(b => b.id === id);
            if (v3Block && block.completed) {
                syncMgr.onTimeBlockCompleted(v3Block);
            } else if (v3Block) {
                v3Block.completed = block.completed;
                syncMgr.scheduleSync();
            }
        }
    }

    saveData();
    renderTimeBlocks();
}
```

#### saveScore() 개선

```javascript
function saveScore() {
    // 기존 코드
    const score = {
        id: Date.now(),
        date: document.getElementById('scoreDate').value,
        score: parseInt(document.getElementById('scoreInput').value),
        memo: document.getElementById('scoreMemo').value,
        examType: studyData.examType
    };

    studyData.mockScores.push(score);

    // v3.0.0 동기화 추가
    if (v3Data && syncMgr) {
        const v3Exam = {
            id: score.id.toString(),
            userId: v3Data.user.id,
            planId: v3Data.studyPlans[0].id,
            examType: score.examType,
            examName: score.memo,
            examDate: score.date,
            scores: { overall: { score: score.score, maxScore: 100 } },
            totalScore: score.score
        };
        syncMgr.onMockExamRecorded(v3Exam);
    }

    saveData();
    renderMockScores();
}
```

### Step 4: UI 표시 (대시보드 추가)

```javascript
function displayV3Analytics() {
    const report = analytics.generateComprehensiveReport();

    // 효율성 점수 표시
    document.getElementById('efficiencyScore').innerHTML = `
        <div class="score-display">
            <span class="emoji">${report.efficiencyScore.rating.emoji}</span>
            <span class="score">${report.efficiencyScore.overall}/100</span>
            <span class="label">${report.efficiencyScore.rating.label}</span>
        </div>
    `;

    // 권고사항 표시
    const recommendationsHTML = report.recommendations
        .map(rec => `
            <div class="recommendation priority-${rec.priority}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                <ul>${rec.actions.map(a => `<li>${a}</li>`).join('')}</ul>
            </div>
        `).join('');

    document.getElementById('recommendations').innerHTML = recommendationsHTML;

    // 다음 마일스톤 표시
    const milestone = report.nextMilestone;
    document.getElementById('milestone').innerHTML = `
        <div class="milestone">
            <p>${milestone.status}</p>
            <div class="progress-bar">
                <div class="fill" style="width: ${(milestone.current / milestone.milestone) * 100}%"></div>
            </div>
            <p>${milestone.current}h / ${milestone.milestone}h</p>
        </div>
    `;
}
```

---

## 마이그레이션 프로세스

### Phase 1: 준비 (선택사항)

```javascript
// 1. 데이터 검증
const validation = window.DataMigration.validate(v3Data);
if (!validation.isValid) {
    console.error('Validation errors:', validation.errors);
    console.warn('Validation warnings:', validation.warnings);
}

// 2. 백업 확인
const backup = localStorage.getItem('studyData.v2-backup');
console.log('v2.14.0 backup exists:', !!backup);
```

### Phase 2: 마이그레이션

```javascript
// 자동 마이그레이션 (권장)
const v3Data = window.DataMigration.autoMigrate();

// 마이그레이션 결과 확인
if (v3Data) {
    console.log('✅ Migration successful');
    console.log('Entities:');
    console.log('- User:', v3Data.user.id);
    console.log('- StudyPlans:', v3Data.studyPlans.length);
    console.log('- Subjects:', v3Data.subjects.length);
    console.log('- TimeBlocks:', v3Data.timeBlocks.length);
    console.log('- StudyLogs:', v3Data.studyLogs.length);
    console.log('- MockExams:', v3Data.mockExams.length);
    console.log('- LearningHistory:', v3Data.learningHistory.length);
} else {
    console.error('❌ Migration failed');
    // 롤백: v2.14.0 계속 사용
}
```

### Phase 3: 검증 및 확인

```javascript
// 1. 데이터 일관성 확인
const issues = [];

// 모든 timeBlock이 subject를 참조하는가?
v3Data.timeBlocks.forEach(block => {
    if (!v3Data.indices.subjectsById[block.subjectId]) {
        issues.push(`TimeBlock ${block.id} references non-existent subject`);
    }
});

// 모든 studyLog가 timeBlock을 참조하는가?
v3Data.studyLogs.forEach(log => {
    if (!v3Data.indices.timeBlocksById[log.timeBlockId]) {
        issues.push(`StudyLog ${log.id} references non-existent timeBlock`);
    }
});

if (issues.length > 0) {
    console.error('Data consistency issues:', issues);
} else {
    console.log('✅ Data consistency verified');
}

// 2. 저장소 크기 확인
const sizeMB = (v3Data.metadata.storageSize / 1024 / 1024).toFixed(2);
console.log(`Storage size: ${sizeMB}MB`);

// 3. 기존 데이터와 비교
const oldDataStr = localStorage.getItem('studyData');
const oldSize = oldDataStr ? (new Blob([oldDataStr]).size / 1024 / 1024).toFixed(2) : 0;
console.log(`Old v2 size: ${oldSize}MB → New v3 size: ${sizeMB}MB`);
```

### Phase 4: 롤백 절차

```javascript
// 문제 발생 시 롤백
function rollbackToV2() {
    const backup = localStorage.getItem('studyData.v2-backup');
    if (backup) {
        localStorage.setItem('studyData', backup);
        localStorage.removeItem('studyData.v3');
        console.log('✅ Rolled back to v2.14.0');
        location.reload();
    }
}

// 사용 예시
if (someErrorOccurs) {
    rollbackToV2();
}
```

---

## API 가이드

### SyncManager API

```javascript
// 데이터 변경 감지
syncMgr.onTimeBlockCreated(timeBlock)
syncMgr.onTimeBlockCompleted(timeBlock)
syncMgr.onTimeBlockDeleted(blockId)
syncMgr.onMockExamRecorded(mockExam)
syncMgr.onSubjectProgressChanged(subjectId, newProgress)

// 리스너 등록
syncMgr.on(eventType, callback)
syncMgr.off(eventType, callback)

// 분석 함수
syncMgr.getTodayEfficiency()
syncMgr.getWeeklyStats()
syncMgr.getPlanProgress(planId)
```

### AnalyticsEngine API

```javascript
// 학습 통계
analytics.getTodayAnalysis()
analytics.getWeeklyAnalysis()
analytics.getMonthlyAnalysis()

// 효율성 분석
analytics.getOverallEfficiencyScore()
analytics.getWeakSubjectsAnalysis()
analytics.getSubjectLearningPatterns()

// 종합 리포트
analytics.generateComprehensiveReport()
```

### DataMigration API

```javascript
// 자동 마이그레이션
window.DataMigration.autoMigrate()

// 수동 마이그레이션
window.DataMigration.migrate(oldData)
window.DataMigration.save(v3Data)
window.DataMigration.load()

// 검증
window.DataMigration.validate(v3Data)
```

---

## 테스트 체크리스트

### 단위 테스트 (각 모듈)

```
마이그레이션 모듈:
- [ ] v2.14.0 데이터 읽기
- [ ] Entity 생성 (User, StudyPlan, Subjects, ...)
- [ ] 관계 데이터 매핑
- [ ] UUID 생성
- [ ] localStorage 저장
- [ ] 데이터 검증

SyncManager:
- [ ] TimeBlock 완료 시 StudyLog 생성
- [ ] Subject 통계 재계산
- [ ] Cascade Update 작동
- [ ] Observer 패턴 리스너 호출
- [ ] localStorage 동기화
- [ ] Streak 계산

AnalyticsEngine:
- [ ] 일일 분석 계산
- [ ] 주간/월간 분석
- [ ] 효율성 점수 계산
- [ ] 취약점 분석
- [ ] 권고사항 생성
```

### 통합 테스트

```
데이터 흐름:
- [ ] TimeBlock 추가 → StudyLog 자동 생성 → Subject 업데이트
- [ ] MockExam 기록 → 취약 과목 식별
- [ ] 날짜 변경 → LearningHistory 생성
- [ ] 모든 변경사항 → localStorage 저장

호환성:
- [ ] 기존 사용자 (v2.14.0) 자동 마이그레이션
- [ ] 신규 사용자 (v3.0.0) 생성
- [ ] 롤백 절차 작동 확인

성능:
- [ ] 저장소 크기 (< 10MB)
- [ ] 초기 로드 시간 (< 2초)
- [ ] 동기화 지연 (< 1초)
```

### 회귀 테스트 (기존 기능)

```
v2.14.0 기능 유지:
- [ ] TimeBlock 추가/수정/삭제
- [ ] 과목 진도 관리
- [ ] MockExam 기록
- [ ] 타이머 기능
- [ ] 포모도로 타이머
- [ ] 학습 노트
- [ ] 다크모드
- [ ] 모든 UI 렌더링
```

---

## 배포 절차

### 사전 준비

```
1. [ ] 테스트 완료
2. [ ] 사용자 가이드 작성
3. [ ] 롤백 절차 검증
4. [ ] 백업 시스템 구성
5. [ ] 지원팀 교육
```

### 배포 단계

```
Step 1: 카나리 배포 (10% 사용자)
- [ ] 신규 모듈 로드
- [ ] 자동 마이그레이션 수행
- [ ] 모니터링 실시
- [ ] 이슈 없으면 계속

Step 2: 점진적 배포 (50%, 100%)
- [ ] 50% 사용자 배포
- [ ] 24시간 모니터링
- [ ] 100% 배포

Step 3: 모니터링 및 지원
- [ ] 일일 로그 확인
- [ ] 사용자 피드백 수집
- [ ] 긴급 패치 준비
```

### 배포 후

```
1. [ ] v2.14.0 백업 최소 3개월 유지
2. [ ] 마이그레이션 성공율 모니터링
3. [ ] 성능 지표 수집
4. [ ] 사용자 만족도 조사
5. [ ] 추가 기능 요청 수집
```

---

## 주요 개선사항 요약

### 데이터 정규화

| 이전 (v2) | 이후 (v3) |
|---------|---------|
| studyData 단일 JSON | 7개 Entity |
| 암묵적 관계 | FK 기반 명시적 관계 |
| 중복 데이터 | 정규화된 단일 출처 |
| 수동 일관성 유지 | 자동 Cascade Update |

### 자동 동기화

```
Before (v2):
saveData() → localStorage.setItem()
→ 수동으로 UI 업데이트

After (v3):
데이터 변경 → Observer 감지
→ Cascade Update 실행
→ 종속 데이터 자동 업데이트
→ localStorage 자동 저장
→ UI 자동 반영
→ 이벤트 발생
```

### 분석 기능

```
Before (v2):
- 기본 통계 (총 시간, 진도율)
- 수동 계산

After (v3):
- 종합 효율성 점수
- 일/주/월 분석
- 취약점 자동 식별
- 지능형 개선 권고
- 예상 완료일 계산
- 학습 패턴 분석
```

---

## 문제 해결

### 마이그레이션 실패

```
증상: v3Data가 null
원인: v2 데이터 형식 오류
해결:
1. localStorage.getItem('studyData') 확인
2. JSON.parse() 가능 여부 확인
3. 필수 필드 존재 확인
4. 롤백 및 데이터 복구
```

### Sync 오류

```
증상: 데이터가 저장되지 않음
원인: localStorage 할당량 초과
해결:
1. localStorage 크기 확인
2. 캐시 정리
3. 이전 버전 백업 삭제
4. 부분 동기화 시도
```

### 성능 저하

```
증상: 페이지 로드가 느림
원인: 대용량 v3Data 처리
해결:
1. indices 활용해 쿼리 최적화
2. 필터링 전 확인
3. 비동기 처리 적용
4. 캐싱 구현
```

---

## 향후 계획

### v3.1.0 예정

- [ ] 서버 연동 (선택사항)
- [ ] 클라우드 백업
- [ ] 멀티 디바이스 동기화
- [ ] 고급 분석 대시보드
- [ ] AI 기반 학습 추천

### v3.2.0 이후

- [ ] REST API 제공
- [ ] 모바일 앱
- [ ] 그룹 스터디 기능
- [ ] 소셜 공유
- [ ] 선생님/튜터 기능

---

## 참고 자료

- [DATA_SCHEMA_v3.0.md](DATA_SCHEMA_v3.0.md) - 데이터 스키마 상세 설계
- [migration-v2-to-v3.js](migration-v2-to-v3.js) - 마이그레이션 구현
- [sync-manager-v3.0.js](sync-manager-v3.0.js) - 동기화 매니저 구현
- [analytics-engine-v3.0.js](analytics-engine-v3.0.js) - 분석 엔진 구현

---

## FAQ

**Q: v2와 v3를 동시에 사용할 수 있나요?**
A: 네, 마이그레이션 후에도 v2 데이터 백업이 유지되어 롤백이 가능합니다.

**Q: 기존 데이터가 손실될까요?**
A: 아니요, 마이그레이션은 100% 데이터 보존을 보장합니다. 모든 정보가 v3로 변환됩니다.

**Q: 성능에 영향이 있을까요?**
A: 정규화로 인해 약간의 쿼리 오버헤드가 있을 수 있으나, 인덱싱과 최적화로 상쇄됩니다.

**Q: 모바일 지원은?**
A: 현재 HTML/JS 기반이므로 모든 모던 브라우저를 지원합니다.

---

**마지막 검토**: 2025-10-24
**다음 버전**: v3.0.0 안정화 후 v3.1.0 계획
