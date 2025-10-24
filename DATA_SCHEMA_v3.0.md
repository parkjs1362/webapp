# 사법시험 학습 시스템 - 정규화 데이터 스키마 v3.0.0

**작성일**: 2025-10-24
**버전**: v3.0.0-draft
**상태**: 설계 단계

---

## 📊 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [Entity 정의 및 관계](#entity-정의-및-관계)
3. [정규화 스키마](#정규화-스키마)
4. [데이터 흐름](#데이터-흐름)
5. [마이그레이션 전략](#마이그레이션-전략)
6. [구현 가이드](#구현-가이드)

---

## 아키텍처 개요

### 설계 원칙

| 원칙 | 설명 |
|------|------|
| **단일 책임** | 각 Entity는 한 가지 데이터만 관리 |
| **정규화** | 데이터 중복 최소화, 관계를 통한 참조 |
| **확장성** | 새 기능 추가 시 기존 Entity 수정 최소화 |
| **사용자 중심** | 학습자의 workflow를 반영한 구조 |
| **성능** | 필터링/쿼리 최적화 가능한 구조 |

### 아키텍처 레이어

```
┌─────────────────────────────────────────┐
│           UI Layer (HTML/CSS)           │
│  (Dashboard, Forms, Charts, Analytics)  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│     Service Layer (Business Logic)      │
│ (Data Sync, Calculation, Validation)    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│       Data Layer (Entity Objects)       │
│  (User, StudyPlan, Subject, ...)        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│    Storage Layer (localStorage/DB)      │
│  (JSON Serialization & Persistence)     │
└─────────────────────────────────────────┘
```

---

## Entity 정의 및 관계

### Entity Relationship Diagram (ERD)

```
┌──────────────┐         ┌──────────────┐
│   User       │1───┬────│ StudyPlan    │
│ (학습자)      │    │    │ (학습 계획)   │
└──────────────┘    │    └──────────────┘
                    │
                    │    ┌──────────────┐
                    └────│  Subject     │
                         │ (과목)        │
                    ┌────│              │
                    │    └──────────────┘
        ┌───────────┴─────────────┬──────────────┐
        │                         │              │
   ┌────▼────────┐    ┌──────────▼──┐    ┌─────▼────────┐
   │ TimeBlock    │    │ StudyLog    │    │ MockExam     │
   │(계획된 블록)  │    │(실제 학습)   │    │(모의고사)     │
   └─────────────┘    └─────────────┘    └──────────────┘
        │                   │                    │
        └───────┬───────────┴────────┬──────────┘
                │                    │
        ┌───────▼────────────────────▼───┐
        │   LearningHistory               │
        │   (일별/주별/월별 누적 통계)     │
        └────────────────────────────────┘
```

### Entity 상세 정의

#### 1️⃣ User (사용자)

학습자의 기본 정보 및 설정

```javascript
{
  id: string,                           // UUID (고유 ID)
  name: string,                         // 학습자 이름
  email: string,                        // 이메일 (선택)

  // 학습 설정
  examType: '1차' | '2차' | '3차',     // 현재 응시 대상
  startDate: 'YYYY-MM-DD',             // 학습 시작일
  targetDate: 'YYYY-MM-DD',            // 목표 합격일

  // UI 설정
  theme: 'light' | 'dark',             // 테마
  language: 'ko' | 'en',               // 언어

  // 메타 데이터
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLoginAt: timestamp,
  version: '3.0.0'                     // 데이터 스키마 버전
}
```

#### 2️⃣ StudyPlan (학습 계획)

기간별 학습 목표 및 전략

```javascript
{
  id: string,                          // UUID
  userId: string,                      // User.id 참조

  // 계획 정보
  title: string,                       // '1차 합격 전략', '기출 100회 풀기' 등
  description: string,                 // 상세 설명

  // 기간
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD',
  daysRemaining: number,               // 자동 계산

  // 목표
  targetHours: number,                 // 전체 목표 시간 (예: 1200h)
  targetScore: number,                 // 목표 점수 (예: 70점)

  // 과목별 목표
  subjectTargets: {
    subjectId: {
      name: string,
      targetHours: number,
      targetProgress: number,          // 0-100 %
      priority: 'high' | 'medium' | 'low'
    }
    // ...
  },

  // 상태
  status: 'planning' | 'active' | 'completed' | 'paused',

  // 메타
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 3️⃣ Subject (과목)

법과목 정보 및 진도 추적

```javascript
{
  id: string,                          // UUID or '헌법-1차'

  // 기본 정보
  name: string,                        // '헌법', '민법', '형법' 등
  examType: '1차' | '2차' | '3차',
  order: number,                       // 정렬 순서

  // 진도 정보
  totalProblems: number,               // 전체 문제 수 (예: 800)
  completedProblems: number,           // 완료 문제 수 (자동 계산)
  progressPercent: number,             // 0-100 % (자동 계산)

  // 학습 시간 정보
  plannedHours: number,                // 계획한 시간 (자동 계산)
  actualHours: number,                 // 실제 학습 시간 (자동 계산)
  efficiency: number,                  // actualHours / plannedHours * 100

  // 회독 추적
  rotations: {
    round1: boolean,
    round2: boolean,
    round3: boolean,
    round4: boolean,
    round5: boolean,
    round6: boolean,
    round7: boolean
  },

  // 평가
  averageMockScore: number,            // 모의고사 평균 점수 (자동 계산)
  recentScore: number,                 // 최근 점수
  scoresTrend: 'up' | 'down' | 'stable',  // 자동 분석

  // 상태
  status: 'not_started' | 'in_progress' | 'completed' | 'review',

  // 메타
  userId: string,
  planId: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 4️⃣ TimeBlock (계획된 시간 블록)

일일 학습 계획

```javascript
{
  id: string,                          // UUID or timestamp

  // 계획 정보
  userId: string,
  planId: string,
  subjectId: string,                   // Subject.id 참조

  // 날짜 및 시간
  date: 'YYYY-MM-DD',                 // 학습 계획 날짜
  timeSlot: {
    startTime: 'HH:MM',                // '06:00'
    endTime: 'HH:MM',                  // '08:00'
    duration: number                   // 시간 (2.0)
  },

  // 학습 내용
  topic: string,                       // '기출문제 #201-250'
  difficulty: 'easy' | 'medium' | 'hard',
  resources: [string],                 // ['기출', '강의노트'] 등

  // 계획 vs 실제
  plannedHours: number,                // 계획한 시간

  // 상태
  status: 'planned' | 'in_progress' | 'completed' | 'skipped',
  completed: boolean,                  // 간편 표시
  completedAt: timestamp,              // 실제 완료 시간

  // 메타
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 5️⃣ StudyLog (실제 학습 기록)

TimeBlock의 실제 완료 결과

```javascript
{
  id: string,                          // UUID

  // 참조
  userId: string,
  timeBlockId: string,                 // TimeBlock.id 참조
  subjectId: string,                   // Subject.id 참조

  // 날짜 및 시간
  date: 'YYYY-MM-DD',
  loggedAt: timestamp,                 // 기록한 정확한 시간

  // 실제 학습 시간
  actualHours: number,                 // 실제로 공부한 시간
  startTime: timestamp,                // 시작 시간
  endTime: timestamp,                  // 종료 시간

  // 학습 내용
  subjectId: string,
  completed: boolean,
  completionPercent: number,           // 계획한 학습의 몇 %를 완료했는지

  // 학습 품질
  focusLevel: 1 | 2 | 3 | 4 | 5,      // 집중도 (선택)
  difficulty: 'easy' | 'medium' | 'hard',  // 난이도 실제 경험
  problems: {
    attempted: number,                 // 시도한 문제 수
    correct: number,                   // 맞은 문제 수
    accuracy: number                   // 정답률 %
  },

  // 노트
  notes: string,                       // 학습 중 기억할 내용
  mistakes: [string],                  // 틀린 부분 메모

  // 메타
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 6️⃣ MockExam (모의고사 기록)

시험 응시 결과

```javascript
{
  id: string,                          // UUID

  // 참조
  userId: string,
  planId: string,

  // 시험 정보
  examType: '1차' | '2차' | '3차',
  examName: string,                    // '2025년 1월 모의고사'
  examDate: 'YYYY-MM-DD',

  // 점수 (과목별)
  scores: {
    subjectId: {
      subject: string,
      score: number,                   // 0-100
      maxScore: number                 // 100
    }
    // ...
  },

  // 전체 점수
  totalScore: number,
  maxTotalScore: number,
  percentile: number,                  // 상위 몇 %
  passingScore: number,                // 합격 기준 (현재: 60점)
  isPassed: boolean,                   // 합격 여부

  // 분석
  analysis: {
    strongSubjects: [string],          // 잘한 과목
    weakSubjects: [string],            // 약한 과목
    improvements: {
      subjectId: {
        previousScore: number,
        currentScore: number,
        improvement: number,           // currentScore - previousScore
        trend: 'up' | 'down' | 'stable'
      }
    }
  },

  // 메타
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 7️⃣ LearningHistory (누적 학습 이력)

일별/주별/월별 통계

```javascript
{
  id: string,                          // UUID

  // 참조
  userId: string,
  planId: string,

  // 기간
  date: 'YYYY-MM-DD',                 // 특정 날짜 (일일 기록)
  weekOf: 'YYYY-MM-DD',               // 주의 첫 날
  monthOf: 'YYYY-MM',                 // 월

  // 학습 시간
  totalHours: number,                  // 그날 총 학습 시간
  plannedHours: number,                // 계획했던 시간
  efficiency: number,                  // 실제/계획 * 100

  // 과목별 학습
  subjectBreakdown: {
    subjectId: {
      subject: string,
      hours: number,
      blockCount: number               // 몇 개 블록을 했는지
    }
    // ...
  },

  // 진도
  problemsSolved: number,              // 그날 푼 문제 수
  accuracy: number,                    // 정답률

  // 학습 연속성
  streak: {
    current: number,                   // 현재 연속 학습일
    longest: number,                   // 최장 기록
  },

  // 평가
  averageScore: number,                // 모의고사 평균 (있는 경우)
  notes: string,                       // 그날의 한줄 평가

  // 메타
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## 정규화 스키마

### localStorage 저장 구조

```javascript
{
  // 기본 설정
  "user": { User 객체 },

  // 학습 계획들
  "studyPlans": [ StudyPlan 배열 ],
  "studyPlan.{planId}": StudyPlan 객체,

  // 과목
  "subjects.{planId}": [ Subject 배열 ],
  "subject.{subjectId}": Subject 객체,

  // 일일 계획
  "timeBlocks.{planId}": [ TimeBlock 배열 ],
  "timeBlock.{id}": TimeBlock 객체,

  // 학습 기록
  "studyLogs.{planId}": [ StudyLog 배열 ],
  "studyLog.{id}": StudyLog 객체,

  // 모의고사
  "mockExams.{planId}": [ MockExam 배열 ],
  "mockExam.{id}": MockExam 객체,

  // 통계
  "learningHistory.{planId}": [ LearningHistory 배열 ],
  "learningHistory.{planId}.{date}": LearningHistory 객체,

  // 메타 데이터
  "metadata": {
    version: '3.0.0',
    lastSync: timestamp,
    storageSize: number
  }
}
```

### 쿼리 함수 (의사 코드)

```javascript
// 오늘 학습할 timeBlocks 조회
function getTodayTimeBlocks(userId) {
  const today = getTodayDate();
  return studyData.timeBlocks
    .filter(block => block.userId === userId && block.date === today)
    .sort(block => block.timeSlot.startTime);
}

// 특정 과목의 진도율 계산
function getSubjectProgress(subjectId) {
  const subject = studyData.subjects[subjectId];
  const subjectLogs = studyData.studyLogs
    .filter(log => log.subjectId === subjectId);

  const actualHours = subjectLogs.reduce((sum, log) => sum + log.actualHours, 0);
  const completedProblems = subjectLogs.reduce((sum, log) => sum + log.problems.correct, 0);

  return {
    progressPercent: (subject.completedProblems / subject.totalProblems) * 100,
    hoursSpent: actualHours,
    efficiency: (actualHours / subject.plannedHours) * 100
  };
}

// 오늘 계획 대비 실제 학습 비교
function getTodayEfficiency(userId) {
  const today = getTodayDate();
  const todayBlocks = getTodayTimeBlocks(userId);
  const todayLogs = studyData.studyLogs
    .filter(log => log.userId === userId && log.date === today);

  const plannedHours = todayBlocks.reduce((sum, block) => sum + block.plannedHours, 0);
  const actualHours = todayLogs.reduce((sum, log) => sum + log.actualHours, 0);

  return {
    planned: plannedHours,
    actual: actualHours,
    efficiency: (actualHours / plannedHours) * 100
  };
}
```

---

## 데이터 흐름

### 학습자 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│  아침: 학습 계획 확인                                             │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─→ getTodayTimeBlocks() 호출
               └─→ "오늘 학습 블록" UI에 표시
                   (시간대별로 과목/내용/시간 표시)

┌──────────────▼──────────────────────────────────────────────────┐
│  학습 시작                                                        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─→ "학습 시작" 버튼 클릭
               └─→ StudyLog 자동 생성
                   {
                     timeBlockId: ...,
                     subjectId: ...,
                     date: today,
                     startTime: now(),
                     status: 'in_progress'
                   }

┌──────────────▼──────────────────────────────────────────────────┐
│  학습 진행 중 (선택사항)                                           │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─→ 문제 풀이 진행 (문제 수, 정답/오답)
               └─→ StudyLog 실시간 업데이트
                   {
                     problems: { attempted: 50, correct: 45 },
                     accuracy: 90,
                     focusLevel: 4
                   }

┌──────────────▼──────────────────────────────────────────────────┐
│  학습 완료                                                        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─→ "학습 완료" 버튼 클릭
               ├─→ StudyLog 최종 확정
               │   {
               │     endTime: now(),
               │     actualHours: 계산됨,
               │     completionPercent: 100,
               │     status: 'completed'
               │   }
               │
               ├─→ [자동] TimeBlock.status = 'completed'
               ├─→ [자동] Subject 진도 업데이트
               ├─→ [자동] LearningHistory 업데이트
               └─→ [자동] 분석 대시보드 새로고침

┌──────────────▼──────────────────────────────────────────────────┐
│  오늘 학습 마무리                                                  │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─→ 오늘 효율성 계산 (계획 vs 실제)
               │   (예: 8시간 계획, 7.5시간 실제 = 93.75%)
               │
               ├─→ 부족한 과목 제안
               │   (예: "형법은 계획 2시간 중 1시간만 했습니다")
               │
               └─→ 내일 일정 추천
                   (예: "형법을 오늘 대비 1.5시간 더 늘리세요")

┌──────────────▼──────────────────────────────────────────────────┐
│  모의고사 응시                                                    │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─→ MockExam 생성 및 점수 입력
               ├─→ [자동] 과목별 점수 분석
               ├─→ [자동] 이전 점수와 비교 (trend 계산)
               ├─→ [자동] Subject.averageMockScore 업데이트
               └─→ [자동] 취약 과목 식별 및 학습 권고

┌──────────────▼──────────────────────────────────────────────────┐
│  주간/월간 분석                                                    │
└──────────────────────────────────────────────────────────────────┘

               ├─→ 주간 학습 시간 분석
               │   (계획 vs 실제, 과목별 분배)
               │
               ├─→ 학습 연속성 (streak) 계산
               │   (연속 학습일, 최장 기록)
               │
               ├─→ 목표 진행 상황
               │   (전체 진도율, 시간/점수 달성도)
               │
               └─→ 지능형 권고
                   (어느 과목에 더 집중해야 하는지)
```

### 데이터 변경 감시 (Observer)

```
┌────────────────────────────────┐
│  이벤트 발생                     │
│  (timeBlock 추가/수정, 완료 등)  │
└─────────────┬──────────────────┘
              │
              ├─→ 데이터 검증 (validation)
              │   - 필수 필드 확인
              │   - 데이터 타입 확인
              │   - 비즈니스 규칙 확인
              │
              ├─→ 데이터 수정
              │   - 해당 Entity 업데이트
              │
              ├─→ Cascade Update (종속 데이터)
              │   │
              │   ├─→ TimeBlock 완료
              │   │    ├─→ StudyLog 업데이트
              │   │    ├─→ Subject.actualHours 재계산
              │   │    ├─→ Subject.efficiency 재계산
              │   │    └─→ LearningHistory 업데이트
              │   │
              │   ├─→ MockExam 추가
              │   │    ├─→ Subject.averageMockScore 재계산
              │   │    ├─→ Subject.scoresTrend 재분석
              │   │    └─→ 취약 과목 식별
              │   │
              │   └─→ Subject 진도 변경
              │        ├─→ StudyPlan 전체 진도 재계산
              │        └─→ LearningHistory 업데이트
              │
              ├─→ localStorage 저장
              │   - JSON.stringify() 및 저장
              │
              ├─→ UI 업데이트
              │   - 해당 컴포넌트 새로고침
              │   - 차트/통계 재렌더링
              │
              └─→ 알림 (선택)
                  - 목표 달성 시 축하 메시지
                  - 취약 과목 경고
                  - 학습 효율성 팁 등
```

---

## 마이그레이션 전략

### v2.14.0 → v3.0.0 마이그레이션 경로

#### Phase 1: 읽기 호환성 (Backward Compatibility)

- v3.0.0 코드가 v2.14.0 데이터를 읽을 수 있도록 구현
- 기존 사용자 데이터 손실 없음

#### Phase 2: 자동 변환

```javascript
function migrateDataV2ToV3() {
  const oldData = localStorage.getItem('studyData');
  if (!oldData) return;

  const parsed = JSON.parse(oldData);

  // 1. User 생성
  const user = {
    id: generateUUID(),
    name: 'User',  // 기본값
    examType: parsed.examType || '1차',
    theme: localStorage.getItem('theme') || 'light',
    version: '3.0.0'
  };

  // 2. StudyPlan 생성
  const plan = {
    id: generateUUID(),
    userId: user.id,
    title: '기본 학습 계획',
    startDate: getTodayDate(),
    status: 'active'
  };

  // 3. Subjects 변환
  const subjects = parsed.subjects.map(oldSubj => ({
    id: generateUUID(),
    name: oldSubj.name,
    totalProblems: oldSubj.total,
    completedProblems: oldSubj.completed,
    rotations: oldSubj.rotations,
    planId: plan.id,
    userId: user.id
  }));

  // 4. TimeBlocks 변환 (date 필드 추가)
  const timeBlocks = (parsed.timeBlocks || []).map(oldBlock => ({
    ...oldBlock,
    id: oldBlock.id || generateUUID(),
    date: oldBlock.date || getTodayDate(),  // v2.14.0 이상
    userId: user.id,
    planId: plan.id,
    subjectId: findSubjectIdByName(oldBlock.subject, subjects)
  }));

  // 5. StudyLogs 생성 (timeBlocks.completed 기반)
  const studyLogs = timeBlocks
    .filter(block => block.completed)
    .map(block => ({
      id: generateUUID(),
      userId: user.id,
      timeBlockId: block.id,
      subjectId: block.subjectId,
      date: block.date,
      actualHours: block.hours,
      completed: true
    }));

  // 6. MockExams 변환
  const mockExams = (parsed.mockScores || []).map(oldScore => ({
    id: generateUUID(),
    userId: user.id,
    examType: parsed.examType,
    examDate: oldScore.date,
    scores: {
      [findSubjectIdByName('평균', subjects)]: {
        score: oldScore.score,
        maxScore: 100
      }
    },
    totalScore: oldScore.score
  }));

  // 7. LearningHistory 생성 (이전 기록 복원)
  const learningHistory = (parsed.studyHistory || []).map(oldHistory => ({
    id: generateUUID(),
    userId: user.id,
    planId: plan.id,
    date: oldHistory.date,
    totalHours: oldHistory.totalHours,
    notes: oldHistory.note
  }));

  // 8. 새로운 저장소에 저장
  const newData = {
    user,
    studyPlans: [plan],
    subjects,
    timeBlocks,
    studyLogs,
    mockExams,
    learningHistory
  };

  localStorage.setItem('studyData.v3', JSON.stringify(newData));
  console.log('✅ Migration completed: v2.14.0 → v3.0.0');

  return newData;
}
```

#### Phase 3: 검증 및 롤백

- 마이그레이션 후 데이터 무결성 검증
- 문제 발생 시 자동 롤백 (v2.14.0 데이터 유지)

### 마이그레이션 체크리스트

- [ ] v3.0.0 데이터 구조 테스트
- [ ] v2.14.0 데이터 읽기 호환성 확인
- [ ] 자동 변환 함수 구현
- [ ] 데이터 무결성 검증
- [ ] 사용자 안내 메시지
- [ ] 실제 사용자 데이터 마이그레이션
- [ ] 성능 테스트 (저장소 크기, 로드 시간)

---

## 구현 가이드

### 구현 순서

1. **Week 1**: Entity 정의 및 storage 구조
   - [ ] User, StudyPlan, Subject Entity 구현
   - [ ] localStorage 저장 구조 정립

2. **Week 2**: 데이터 접근 계층
   - [ ] Query 함수 작성 (getTodayTimeBlocks, getSubjectProgress 등)
   - [ ] CUD (Create/Update/Delete) 함수 작성

3. **Week 3**: 자동 동기화 로직
   - [ ] Observer 패턴 구현
   - [ ] Cascade Update 로직

4. **Week 4**: 마이그레이션 및 테스트
   - [ ] v2 → v3 마이그레이션 스크립트
   - [ ] 전체 데이터 흐름 테스트
   - [ ] UI 통합

### 핵심 함수 목록

#### Data Access Layer

```javascript
// 조회
getUserData(userId)
getStudyPlan(planId)
getSubjects(planId)
getTodayTimeBlocks(userId, date = today)
getCompletedLogs(subjectId, dateRange)
getMockExams(planId)
getLearningHistory(planId, dateRange)

// 생성
createTimeBlock(userId, timeBlockData)
createStudyLog(userId, logData)
recordMockExam(userId, examData)

// 수정
updateTimeBlock(blockId, updates)
completeTimeBlock(blockId)
updateStudyLog(logId, updates)

// 삭제
deleteTimeBlock(blockId)
deleteStudyLog(logId)

// 계산
calculateSubjectProgress(subjectId)
calculateTodayEfficiency(userId, date)
calculateWeeklyStats(userId, weekOf)
identifyWeakSubjects(userId, planId)
```

#### Business Logic Layer

```javascript
// 자동 계산
updateSubjectStats(subjectId)
updatePlanProgress(planId)
calculateStreak(userId)
analyzeMockExamTrend(subjectId)

// 추천 생성
recommendSubjectFocus(userId)
suggestTomorrowPlan(userId)
suggestReviewSchedule(userId, subjectId)

// 검증
validateTimeBlockData(data)
validateStudyLogData(data)
validateMockExamData(data)

// 동기화
syncAllData(userId)
reconcileTimeBlocksAndLogs(planId)
updateAllDependentData(entity, changes)
```

### 파일 구조 (제안)

```
judicial-scrivener-study-tracker.html (메인 파일)
├── <script type="module">
│   ├── dataSchema.js (Entity 정의)
│   ├── storage.js (localStorage 래퍼)
│   ├── dataLayer.js (CRUD 함수)
│   ├── businessLogic.js (자동 계산 및 추천)
│   ├── syncManager.js (Observer 및 동기화)
│   └── uiController.js (UI 연동)
└── <style>
    └── (기존 CSS)
```

---

## 다음 단계

### ✅ 완료
- [x] Entity 정의 및 관계도
- [x] 정규화 스키마 설계
- [x] 데이터 흐름 정의
- [x] 마이그레이션 전략

### 📋 다음 작업
1. **Step 2**: 정규화된 데이터 구조 구현
   - JavaScript Entity 클래스 작성
   - localStorage 저장 함수 구현

2. **Step 3**: 마이그레이션 스크립트 작성
   - v2.14.0 → v3.0.0 자동 변환

3. **Step 4**: 자동 동기화 로직 구현
   - Observer 패턴 적용
   - Cascade Update 구현

4. **Step 5**: 학습 분석 기능
   - 효율성 점수 계산
   - 취약 과목 식별
   - 학습 권고 생성

---

## 참고

- **설계 원칙**: SOLID 원칙 (Single Responsibility, Open/Closed, DIP 등)
- **패턴**: Observer, Repository, Factory 패턴 활용
- **성능**: 쿼리 최적화, 캐싱 고려
- **확장성**: 새로운 Entity/기능 추가 시 기존 코드 최소 수정

---

**문서 버전**: 2025-10-24
**다음 검토 예정**: Step 2 구현 후
