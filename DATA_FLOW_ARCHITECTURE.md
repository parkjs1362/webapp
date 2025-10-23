# 📊 Judicial Study Tracker - Complete Data Flow Architecture
**Version**: 2.14.0
**Last Updated**: 2025-10-23
**Status**: Comprehensive data integration completed

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Data Model](#data-model)
3. [Daily Data Flow](#daily-data-flow)
4. [Complete Entity Relationships](#complete-entity-relationships)
5. [Feature Integration Map](#feature-integration-map)
6. [Data Persistence & Sync](#data-persistence--sync)
7. [Daily Reset Mechanism](#daily-reset-mechanism)
8. [Debugging Guide](#debugging-guide)

---

## Executive Summary

This application implements a **daily-aware study tracking system** where:
- **Today's data** is isolated and displayed separately
- **Historical data** is preserved for analytics and trends
- **All changes** automatically trigger UI updates
- **Data consistency** is maintained across all features

### Key Data Entities
1. **timeBlocks** - Daily study sessions (filtered by date)
2. **studyHistory** - Daily summaries (accumulated data)
3. **mockScores** - Exam practice scores with dates
4. **subjects** - Learning progress tracking
5. **streak** - Consecutive study day counter
6. **timer** - Cumulative study duration
7. **goals** - Learning objectives with progress

---

## Data Model

### 1. **timeBlocks** Array
Represents scheduled study sessions for a specific date.

```javascript
{
  id: 1698019200000,           // Timestamp ID (unique per block)
  date: "2025-10-23",          // 🔑 TODAY's date in YYYY-MM-DD
  time: "06:00-08:00",         // Time slot (HH:MM-HH:MM)
  subject: "민법",             // Subject name
  hours: 2,                    // Duration in hours
  detail: "제1장 계약",        // Study content
  completed: false             // Completion status
}
```

**Key Point**: Each block has a `date` field. Only blocks where `date === TODAY` are displayed in "오늘의 학습 전략".

**Lifecycle**:
```
User adds block → date: today → saveData() → renderTimeBlocks() filters by today
         ↓
User completes block → toggleTimeBlock() → updates studyHistory → updateStreak()
         ↓
Tomorrow → date != today → doesn't show in today's card
```

---

### 2. **studyHistory** Array
Daily summaries of completed study sessions.

```javascript
{
  date: "2025-10-23",          // 🔑 Date of the study session
  totalHours: 6,               // Cumulative hours for this day
  completedBlocks: [
    {
      subject: "민법",
      hours: 2,
      time: "06:00-08:00"
    },
    // ... more blocks
  ],
  note: "Good focus today"     // Optional daily note
}
```

**Purpose**: Tracks daily aggregates for analytics, streak calculation, and historical records.

**Population Flow**:
```
toggleTimeBlock(completed=true) →
  Creates/updates studyHistory entry for today →
  Adds block to completedBlocks array →
  Increments totalHours →
  saveData()
```

---

### 3. **mockScores** Array
Exam practice test results with date tracking.

```javascript
{
  date: "2025-10-23",          // 🔑 Test date
  score: 82,                   // Test score (0-100)
  examType: "1차",             // Exam type (1차 or 2차)
  memo: "Better performance"   // Optional notes
}
```

**Used By**:
- **Trend Chart**: Shows score progression over time
- **Analytics**: Calculates average score
- **Date Range Filter**: 1주, 1개월, 전체

---

### 4. **subjects** Array
Learning progress for exam subjects (active set based on examType).

```javascript
{
  name: "민법",                // Subject name
  total: 800,                  // Total problems in curriculum
  completed: 580,              // Problems completed
  rotations: [                 // Learning cycle tracking
    true, true, true, false, false, false, false
  ]  // 7-rotation system
}
```

**Dynamic Selection**:
```javascript
if (examType === '1차') {
  subjects = subjects1st;    // 7 subjects for 1차
} else {
  subjects = subjects2nd;    // 7 subjects for 2차
}
```

**Used By**:
- **Progress bars**: Calculates completion % per subject
- **Doughnut chart**: Visualizes time spent by subject
- **Analytics**: Overall progress calculation

---

### 5. **streak** Object
Tracks consecutive study days.

```javascript
{
  current: 5,                  // Current streak (days)
  longest: 12,                 // Longest ever streak
  lastStudyDate: "2025-10-23", // Last study date
  totalDays: 18                // Total study days (lifetime)
}
```

**Calculation Logic**:
```
Check today's data:
  - Timer has study time? OR
  - Any completed timeBlocks for today? (date === today)

If yes:
  - Compare lastStudyDate with today
  - If diff = 1 day → increment current streak
  - If diff > 1 day → reset current to 1
  - Update lastStudyDate to today
  - Increment totalDays
```

---

### 6. **timer** Object
Cumulative study duration tracking.

```javascript
{
  seconds: 45600,              // Total accumulated seconds
  isRunning: false,            // Timer active status
  interval: null               // setInterval ID
}
```

**Sources**:
1. Manual timer start/stop
2. Completed timeBlocks (hours × 3600 seconds)
3. Daily persistence via localStorage

---

## Daily Data Flow

### ✅ Morning (New Day Starts)

```
Page Load at 10:00 AM on 2025-10-24
  ↓
loadData() → retrieves all historical data from localStorage
  ↓
init() → initializes UI with loaded data
  ↓
renderTimeBlocks():
  today = "2025-10-24"
  Filter: timeBlocks.filter(b => b.date === "2025-10-24")
  Result: Empty array (no blocks added yet for today)
  ↓
Display: Shows "오늘의 학습 계획이 없습니다" message with 📚 emoji
  ↓
User adds time block for 06:00-08:00
  ↓
saveTimeBlock():
  block.date = "2025-10-24"  // Automatically set to today
  studyData.timeBlocks.push(block)
  saveData() → localStorage
  renderTimeBlocks() → Shows the new block (because date matches)
```

---

### ✅ During the Day (Block Completion)

```
User clicks "완료" button on a time block
  ↓
toggleTimeBlock(blockId):
  block.completed = true
  hours = 2
  seconds = 7200

  today = "2025-10-24"

  // Add to timer
  timer.seconds += 7200

  // Populate studyHistory
  todayHistory = studyHistory.find(h => h.date === "2025-10-24")
  if (!todayHistory) {
    Create new: { date: "2025-10-24", totalHours: 0, blocks: [] }
    Push to studyHistory
  }

  todayHistory.totalHours += 2
  todayHistory.completedBlocks.push({subject, hours, time})

  saveData() → localStorage
  ↓
renderTimeBlocks() → Updates UI (shows "완료✓" on block)
updateStreak() → Checks if studied today, updates counter
renderAnalytics() → Recalculates metrics from updated data
```

---

### ✅ Data Sync Flow

```
User makes any change (add block, complete block, update score):
  ↓
saveData():
  JSON.stringify(studyData) → localStorage
  Wrapped function calls:
    → initAllCharts() → Updates all visualizations
    → updateSyncStatus() → Updates data size display
  ↓
initAllCharts():
  initSubjectTimeChart() → Reads subjectTimeSpent
  initMockScoreChart() → Reads mockScores (with date filters)
  renderSubjectProgressBars() → Reads subjects array
  updateSyncStatus() → Calculates data size in KB
  ↓
renderAnalytics():
  Recalculates from current data:
  - Total hours: timer + completed blocks + weeklyHours
  - Study days: unique dates from completed blocks + studyHistory
  - Avg hours: totalHours / studyDays
  - Overall progress: SUM(completed) / SUM(total) * 100
```

---

### ❌ Yesterday's Data Flow

```
Page loads on 2025-10-24
Yesterday's timeBlocks still in array:
  { date: "2025-10-23", subject: "헌법", hours: 2, completed: true }

renderTimeBlocks() filters:
  today = "2025-10-24"
  Filter: block.date === "2025-10-24"  → Returns false
  → Block is NOT displayed in "오늘의 학습 전략"

BUT Block is preserved in:
  ✓ studyHistory (if completed)
  ✓ Analytics (for historical calculations)
  ✓ Charts (for trend visualization)
  ✓ localStorage (permanently)
```

---

## Complete Entity Relationships

### Data Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    User Actions                         │
│  (Add/Edit/Complete blocks, add scores, etc.)           │
└──────────────┬──────────────────────────────────────────┘
               │
               ↓
        ┌──────────────┐
        │  saveData()  │ ← Triggered on every change
        └──────┬───────┘
               │ Saves to localStorage
               ↓
        ┌──────────────────────┐
        │   localStorage.      │
        │   studyData          │
        └──────┬───────────────┘
               │ Preserved across refreshes
               ↓
    ┌──────────────────────────────┐
    │  initAllCharts() calls:      │
    │  - initSubjectTimeChart()    │
    │  - initMockScoreChart()      │
    │  - renderSubjectProgress()   │
    │  - updateSyncStatus()        │
    │  - renderAnalytics()         │
    └──────────────────────────────┘
               │
          ┌────┴────┬───────────┬────────────┬──────────┐
          ↓         ↓           ↓            ↓          ↓
      ┌────────┐ ┌──────┐ ┌──────────┐ ┌────────┐ ┌───────┐
      │Doughnut│ │ Line │ │Progress  │ │ Sync   │ │Data   │
      │Chart   │ │Chart │ │Bars      │ │Status  │ │Size   │
      └────────┘ └──────┘ └──────────┘ └────────┘ └───────┘
```

### Read/Write Matrix

| Entity | Create | Read | Update | Delete | Trigger |
|--------|--------|------|--------|--------|---------|
| **timeBlocks** | addTimeBlock() | renderTimeBlocks() | editTimeBlock() | deleteTimeBlock() | saveData() |
| **studyHistory** | toggleTimeBlock() | renderAnalytics() | toggleTimeBlock() | toggleTimeBlock() | saveData() |
| **mockScores** | addMockScore() | initMockScoreChart() | editMockScore() | deleteMockScore() | saveData() |
| **subjects** | init() | renderAnalytics(), charts | updateSubjects() | - | setExamType() |
| **streak** | init() | UI display | updateStreak() | resetStreak() | toggleTimeBlock() |
| **timer** | init() | updateTimerDisplay() | startTimer/toggleTimeBlock() | resetTimer() | saveData() |
| **goals** | addGoal() | renderGoals() | updateGoalProgress() | deleteGoal() | saveData() |

---

## Feature Integration Map

### 1. "오늘의 학습 전략" Card

**Responsible Functions**:
- **renderTimeBlocks()** - Displays today's blocks
- **saveTimeBlock()** - Creates blocks (sets date: today)
- **toggleTimeBlock()** - Marks blocks complete

**Data Flow**:
```
addTimeBlock() → Modal Opens
  ↓
saveTimeBlock() → date = today
  ↓
saveData() → Triggers renderTimeBlocks()
  ↓
renderTimeBlocks() filters:
  today = "2025-10-23"
  blocks = timeBlocks.filter(b => b.date === today)
  ↓
Display: Shows only today's blocks
```

**Required Data Consistency**:
- ✅ Every timeBlock must have `date` field (added in v2.14.0)
- ✅ Date must be set to TODAY when created
- ✅ renderTimeBlocks() must filter by `block.date === today`
- ✅ Block completion updates studyHistory (added in v2.14.0)

---

### 2. "과목별 진도율" Progress Bars

**Responsible Functions**:
- **renderSubjectProgressBars()** - Creates progress UI
- **renderAnalytics()** - Calls chart rendering

**Data Flow**:
```
subjects array (from studyData)
  ↓
renderSubjectProgressBars():
  For each subject:
    progress = completed / total * 100
    Create progress bar element
    Update DOM
```

**Required Data Consistency**:
- ✅ subjects array must exist
- ✅ exam type must match current selection (handled by updateSubjectsByExamType())
- ✅ completed/total must be updated when subject is worked on

---

### 3. "과목별 학습 시간 분포" Doughnut Chart

**Responsible Functions**:
- **initSubjectTimeChart()** - Creates doughnut chart
- **getThemeColors()** - Provides Apple color palette

**Data Flow**:
```
studyData.timeBlocks + subjects
  ↓
initSubjectTimeChart():
  1. Calculate subjectTimes from subjects progress:
     progress = completed / total
     estimatedHours = progress * 100

  2. Add actual time from completed blocks:
     For each block:
       if (block.completed):
         subjectTimes[subject] += block.duration

  3. Create doughnut chart with aggregated times
```

**Required Data Consistency**:
- ✅ timeBlocks.duration must have value
- ✅ timeBlocks.subject must match subjects array
- ✅ Chart reads from studyData.timeBlocks (all time, not just today)
- ✅ Chart updates on every saveData() call

---

### 4. "모의고사 점수 추이" Line Chart

**Responsible Functions**:
- **initMockScoreChart(range)** - Creates line chart
- **setScoreDateRange()** - Filters by date range

**Data Flow**:
```
studyData.mockScores (with dates)
  ↓
initMockScoreChart(range):
  1. Filter by date range:
     'all' → All scores
     'month' → Last 30 days
     'week' → Last 7 days

  2. Sort by date

  3. Calculate average score line

  4. Create line chart with points and average
```

**Required Data Consistency**:
- ✅ Each mockScore must have `date` field
- ✅ Date format must be YYYY-MM-DD (consistent)
- ✅ Chart preserves all historical data

---

### 5. "연동 현황" Sync Status Dashboard

**Responsible Functions**:
- **updateSyncStatus()** - Updates sync display
- **Called from**: initAllCharts(), toggleDarkMode()

**Data Flow**:
```
studyData (complete object)
  ↓
updateSyncStatus():
  1. Set sync status to "정상"
  2. Update last sync time: "마지막 업데이트: 방금 전"
  3. Calculate success rate: 100%
  4. Increment sync count
  5. Calculate data size:
     size = JSON.stringify(studyData).length / 1024
     Display: "저장된 데이터: 12.34KB"
```

**Required Data Consistency**:
- ✅ JSON.stringify() must work (no circular references)
- ✅ updateSyncStatus() must be called after every change
- ✅ updateSyncStatus() must be called in init() (added in v2.13.2)

---

### 6. Streak Tracking System

**Responsible Functions**:
- **updateStreak()** - Calculates consecutive days
- **Called from**: toggleTimeBlock(), init()

**Data Flow**:
```
today's study records
  ↓
updateStreak():
  1. Check if studied today:
     timer.seconds > 0 OR
     timeBlocks.filter(b => b.date === today && b.completed).length > 0

  2. If yes, compare lastStudyDate:
     diff = today - lastStudyDate

  3. Update streak:
     if (diff === 1) → current++
     if (diff > 1) → current = 1 (reset)
     lastStudyDate = today
     totalDays++

  4. Update longest:
     if (current > longest) → longest = current
```

**Required Data Consistency**:
- ✅ Must filter timeBlocks by today's date (added in v2.14.0)
- ✅ updateStreak() must be called after toggleTimeBlock()
- ✅ Date comparison must use YYYY-MM-DD format

---

### 7. Analytics Dashboard

**Responsible Functions**:
- **renderAnalytics()** - Calculates and displays metrics

**Data Flow**:
```
Multiple sources:
  - timer.seconds
  - timeBlocks.completed + hours
  - weeklyHours object
  - studyHistory array
  - mockScores array
  ↓
renderAnalytics():
  1. Total hours = timer/3600 + completed blocks + weeklyHours
  2. Study days = unique dates from completed blocks + studyHistory
  3. Avg hours = totalHours / studyDays
  4. Overall progress = SUM(completed)/SUM(total) * 100
  5. Mock average = SUM(scores) / count
  ↓
Display: All metrics with color-coded progress bars
```

**Required Data Consistency**:
- ✅ Must use block.date, not block.time (fixed in v2.14.0)
- ✅ Must read from studyHistory if populated
- ✅ Must handle empty data gracefully

---

## Data Persistence & Sync

### localStorage Keys

```javascript
{
  'studyData': {
    // Complete data object
    examType, subjects1st, subjects2st,
    timeBlocks, mockScores, streak,
    timer, goals, studyHistory, ...
  },
  'theme': 'light|dark',
  'examType': '1차|2차',
  'syncCount': number,
  'timer_YYYY-MM-DD': seconds  // Per-day timer
}
```

### Save Trigger Points

```
User Action → Function → saveData() → localStorage + initAllCharts()
  ├─ Add/Complete/Delete block → saveTimeBlock/toggleTimeBlock
  ├─ Add/Edit/Delete score → saveMockScore
  ├─ Update subject progress → updateSubjects
  ├─ Toggle dark mode → toggleDarkMode → initAllCharts()
  ├─ Switch exam type → setExamType
  └─ Add/Update goal → saveGoal
```

### Automatic Sync Points

```
Page Load → init() → loadData() → renderTimeBlocks() → saveData()
Window Close → beforeunload → saveData() + saveNotes()
Every Change → saveData() wrapped with initAllCharts() + updateSyncStatus()
Dark Mode Toggle → toggleDarkMode() wrapped with initAllCharts()
```

---

## Daily Reset Mechanism

### What Happens at Midnight

**Current Implementation** (v2.14.0):
- No automatic reset (by design - data persists)
- New blocks for new day have new `date` value
- Timer persists globally (cumulative)
- Streak calculation handles date boundary

### Daily Isolation in Action

```
2025-10-23 11:59 PM
  timeBlocks = [
    { date: "2025-10-23", subject: "민법", completed: true },
    { date: "2025-10-23", subject: "헌법", completed: false }
  ]

renderTimeBlocks():
  today = "2025-10-23"
  Filter → Shows 2 blocks
  ↓
(Midnight passes)
  ↓
2025-10-24 12:00 AM
  same timeBlocks array (unchanged in memory)

renderTimeBlocks():
  today = "2025-10-24"
  Filter → Shows 0 blocks (no date match)
  Display: "오늘의 학습 계획이 없습니다"
```

**Result**: Daily isolation without resetting data ✅

---

## Debugging Guide

### Q: "오늘의 학습 전략" shows old blocks

**Possible Causes**:
1. ❌ timeBlocks don't have `date` field
2. ❌ `date` is set to wrong value
3. ❌ renderTimeBlocks() not filtering by date

**Debug Steps**:
```javascript
// Browser Console
console.log('Today:', new Date().toISOString().split('T')[0]);
console.log('timeBlocks:', studyData.timeBlocks);

// Check each block
studyData.timeBlocks.forEach((b, i) => {
  console.log(`Block ${i}: date="${b.date}", subject="${b.subject}"`);
});

// Test filter
const today = new Date().toISOString().split('T')[0];
const todayBlocks = studyData.timeBlocks.filter(b => b.date === today);
console.log('Today\'s blocks:', todayBlocks);
```

---

### Q: Streak not calculating correctly

**Possible Causes**:
1. ❌ timeBlocks missing `date` field
2. ❌ updateStreak() not called after block completion
3. ❌ Date comparison uses wrong format

**Debug Steps**:
```javascript
// Browser Console
const today = new Date().toISOString().split('T')[0];
console.log('Today:', today);
console.log('Streak:', studyData.streak);

// Check for today's completed blocks
const todayCompleted = studyData.timeBlocks.filter(
  b => b.date === today && b.completed
);
console.log('Today completed blocks:', todayCompleted);

// Check studyHistory
console.log('Study history:', studyData.studyHistory);
```

---

### Q: Charts not updating after adding data

**Possible Causes**:
1. ❌ saveData() not called
2. ❌ initAllCharts() not triggered
3. ❌ Chart data not reading from studyData

**Debug Steps**:
```javascript
// Browser Console - Check if saveData is wrapped
console.log('saveData:', saveData.toString());
// Should contain: initAllCharts() call

// Manually trigger update
saveData();

// Check chart instances
console.log('subjectTimeChart:', subjectTimeChart);
console.log('mockScoreChart:', mockScoreChart);

// Check if data is available
console.log('mockScores:', studyData.mockScores);
console.log('timeBlocks:', studyData.timeBlocks);
```

---

### Q: Data size stuck on "계산 중..."

**Root Cause** (fixed in v2.13.2):
- updateSyncStatus() not called in init()

**Verification**:
```javascript
// Browser Console
updateSyncStatus();  // Manually call
// Should display size like "저장된 데이터: 12.34KB"
```

---

## Version History

### v2.14.0 - Daily Data Isolation & Complete Integration
- ✅ **NEW**: Added `date` field to timeBlocks
- ✅ **NEW**: Filter timeBlocks by today in renderTimeBlocks()
- ✅ **NEW**: Auto-populate studyHistory when blocks completed
- ✅ **FIX**: Analytics use correct date field (not time)
- ✅ **FIX**: Streak calculates only today's completed blocks
- ✅ **IMPROVED**: Complete data flow documentation

### v2.13.2 - Data Sync Initialization Fix
- ✅ Added updateSyncStatus() to init()
- ✅ Proper initialization sequence

### v2.13.1 - Chart Data Rendering Fix
- ✅ Fixed updateSubjectsByExamType() call
- ✅ Added sample data safety checks

### v2.13.0 - Chart.js Integration
- ✅ Integrated Chart.js v4.4.1
- ✅ Added 4 data visualization types

---

## Summary

✅ **All data flows are now properly integrated**
- Daily isolation works via date filtering
- Charts update automatically via wrapped saveData()
- Sync status displays correctly via updateSyncStatus()
- Streak calculates accurately with date filtering
- Analytics use correct data sources
- studyHistory populates automatically
- Complete documentation provided

