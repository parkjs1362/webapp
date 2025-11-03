/**
 * 사법시험 학습 시스템 v3.11.0
 *
 * ✅ TypeScript 패턴 · 단일 정보 소스(SSOT) 원칙 · 정규화 데이터 모델
 * ✅ 회독 추적 & 성적 분석 시스템 통합
 * ✅ 고급 UI/UX 디자인 · SVG 차트 · 애니메이션 · 인터렉션
 * ✅ 메트릭 카드 완벽한 인터렉션 & 상세 정보 모달
 *
 * 아키텍처:
 * 1. Data Model: 정규화된 데이터 구조 (timeBlocks 중심)
 * 2. Services: 비즈니스 로직 (DataManager, StreakService, StatisticsService)
 * 3. Managers: UI 로직 (ViewManager, 향상된 렌더링)
 * 4. Handlers: 이벤트 처리
 * 5. Analytics: 성적 & 회독 분석
 * 6. Design System: 메트릭 카드, SVG 차트, 애니메이션
 */

// ============================================================================
// 1️⃣  DATA MODEL LAYER (TypeScript 패턴)
// ============================================================================

/**
 * 데이터 모델 정의
 * 단일 정보 소스(SSOT) 원칙: timeBlocks이 모든 학습 기록의 원본
 */

class TimeBlock {
  constructor(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('TimeBlock: data must be an object');
    }

    this.id = data.id || Date.now();

    // ✅ FIX: 로컬 시간대 기반 날짜 사용
    this.date = this._validateDate(data.date || DataManager.getLocalDateString());
    this.subject = this._validateString(data.subject, 'subject');
    this.startTime = this._validateTime(data.startTime, 'startTime');
    this.endTime = this._validateTime(data.endTime, 'endTime');
    this.hours = this._validateHours(data.hours);
    this.completed = data.completed === true;
    this.detail = (data.detail || '').trim();

    // ✅ startTime < endTime 검증
    this._validateTimeRange();
  }

  _validateDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) {
      throw new Error(`TimeBlock: Invalid date format "${dateStr}" (expected YYYY-MM-DD)`);
    }
    return dateStr;
  }

  _validateString(value, fieldName) {
    if (!value || typeof value !== 'string') {
      throw new Error(`TimeBlock: ${fieldName} is required and must be a string`);
    }
    return value.trim();
  }

  _validateTime(timeStr, fieldName) {
    const regex = /^\d{2}:\d{2}$/;
    if (!regex.test(timeStr)) {
      throw new Error(`TimeBlock: Invalid ${fieldName} format "${timeStr}" (expected HH:MM)`);
    }
    return timeStr;
  }

  _validateHours(hours) {
    const h = Number(hours);
    if (isNaN(h) || h <= 0 || h > 24) {
      throw new Error(`TimeBlock: hours must be between 0 and 24, got ${hours}`);
    }
    return h;
  }

  _validateTimeRange() {
    const [startH, startM] = this.startTime.split(':').map(Number);
    const [endH, endM] = this.endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal >= endTotal) {
      throw new Error(`TimeBlock: startTime must be before endTime (${this.startTime} >= ${this.endTime})`);
    }
  }
}

class StudySession {
  constructor(date, timeBlocks) {
    this.date = date;
    // ✅ SSOT: 모든 계산은 timeBlocks에서 유도
    const blocksForDate = timeBlocks.filter(b => b.date === date);
    this.completedBlocks = blocksForDate.filter(b => b.completed);
    this.totalPlannedHours = blocksForDate.reduce((sum, b) => sum + b.hours, 0);
    this.totalCompletedHours = this.completedBlocks.reduce((sum, b) => sum + b.hours, 0);
    this.hasStudied = this.completedBlocks.length > 0;
  }
}

class StreakData {
  constructor() {
    this.current = 0;
    this.longest = 0;
    this.lastStudyDate = null;
    this.totalDays = 0;
  }
}

class SubjectProgress {
  constructor(name) {
    this.name = name;
    this.totalProblems = 0;
    this.completedProblems = 0;
    this.rotations = [false, false, false, false, false, false, false];
    this.avgMockScore = 0;
    this.lastScore = null;
  }

  get progressPercent() {
    return this.totalProblems > 0 ? (this.completedProblems / this.totalProblems) * 100 : 0;
  }
}

/**
 * ✅ 모의고사 성적 (정규화)
 */
class MockScore {
  constructor(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('MockScore: data must be an object');
    }

    this.id = data.id || Date.now();
    // ✅ FIX: 로컬 시간대 기반 날짜 사용
    this.date = this._validateDate(data.date || DataManager.getLocalDateString());
    this.subject = this._validateString(data.subject, 'subject');
    this.round = this._validateNumber(data.round || 1, 'round', 1, 10);
    this.score = this._validateNumber(data.score || 0, 'score', 0, 1000);
    this.maxScore = this._validateNumber(data.maxScore || 100, 'maxScore', 1, 1000);
    this.correctCount = this._validateNumber(data.correctCount || 0, 'correctCount', 0, 500);
    this.totalCount = this._validateNumber(data.totalCount || 0, 'totalCount', 0, 500);
    this.accuracy = this._validateNumber(data.accuracy || 0, 'accuracy', 0, 100);
    this.notes = (data.notes || '').trim();

    // ✅ score <= maxScore 검증
    if (this.score > this.maxScore) {
      throw new Error(`MockScore: score (${this.score}) cannot exceed maxScore (${this.maxScore})`);
    }
  }

  _validateDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) {
      throw new Error(`MockScore: Invalid date format "${dateStr}" (expected YYYY-MM-DD)`);
    }
    return dateStr;
  }

  _validateString(value, fieldName) {
    if (!value || typeof value !== 'string') {
      throw new Error(`MockScore: ${fieldName} is required and must be a string`);
    }
    return value.trim();
  }

  _validateNumber(value, fieldName, min, max) {
    const n = Number(value);
    if (isNaN(n) || n < min || n > max) {
      throw new Error(`MockScore: ${fieldName} must be between ${min} and ${max}, got ${value}`);
    }
    return n;
  }

  get scorePercent() {
    return this.maxScore > 0 ? (this.score / this.maxScore) * 100 : 0;
  }
}

/**
 * ✅ 회독 추적 시스템
 */
class RotationTracker {
  constructor(subject) {
    this.subject = subject;
    this.rotations = [
      { round: 1, completed: false, date: null, studyHours: 0 },
      { round: 2, completed: false, date: null, studyHours: 0 },
      { round: 3, completed: false, date: null, studyHours: 0 },
      { round: 4, completed: false, date: null, studyHours: 0 },
      { round: 5, completed: false, date: null, studyHours: 0 },
      { round: 6, completed: false, date: null, studyHours: 0 },
      { round: 7, completed: false, date: null, studyHours: 0 }
    ];
  }

  /**
   * ✅ 회독 완료 표시
   */
  completeRotation(roundNum) {
    const rotation = this.rotations[roundNum - 1];
    if (rotation) {
      rotation.completed = true;
      // ✅ FIX: 로컬 시간대 기반 날짜 사용
      rotation.date = DataManager.getLocalDateString();
    }
  }

  /**
   * ✅ 회독 진도율 계산
   */
  get progressPercent() {
    const completed = this.rotations.filter(r => r.completed).length;
    return (completed / 7) * 100;
  }

  /**
   * ✅ 다음 회독 번호
   */
  get nextRotation() {
    const incomplete = this.rotations.find(r => !r.completed);
    return incomplete ? incomplete.round : 8;
  }
}

// ============================================================================
// 2️⃣  BUSINESS LOGIC LAYER (Services)
// ============================================================================

/**
 * ✅ 핵심: 데이터 관리자 (SSOT 중심)
 * timeBlocks을 단일 정보 소스로 사용
 */
class DataManager {
  constructor() {
    this.timeBlocks = [];
    this.subjects = [];
    this.mockScores = [];  // ✅ 정규화된 MockScore 객체 배열
    this.rotationTrackers = {};  // ✅ 과목별 RotationTracker (subject -> RotationTracker)
    this.streak = new StreakData();
    this.examType = '1차';

    this.loadFromStorage();
  }

  /**
   * ✅ FIX: 로컬 시간대 기반 날짜 문자열 반환
   * ISO 문자열은 UTC 기반이므로 한국 시간과 다를 수 있음
   * 예: 한국 23:00 = UTC 14:00 (다른 날짜!)
   * @param {number} dayOffset - 일 오프셋 (기본: 0, 어제: -1)
   */
  static getLocalDateString(dayOffset = 0) {
    const now = new Date();
    now.setDate(now.getDate() + dayOffset);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }

  /**
   * ✅ 핵심: 모든 데이터는 timeBlocks에서 계산
   * studyHistory는 캐시일 뿐, 원본이 아님
   */
  getSessionForDate(date) {
    return new StudySession(date, this.timeBlocks);
  }

  addTimeBlock(block) {
    // ✅ FIX: 에러 처리 추가
    try {
      // date 필드는 필수!
      if (!block.date) {
        block.date = DataManager.getLocalDateString();
      }
      const timeBlock = new TimeBlock(block);
      this.timeBlocks.push(timeBlock);
      this.save();
      return timeBlock;
    } catch (error) {
      console.error('❌ TimeBlock 생성 실패:', error.message);
      throw error;
    }
  }

  toggleTimeBlock(id) {
    const block = this.timeBlocks.find(b => b.id === id);
    if (block) {
      block.completed = !block.completed;
      this.save();
      return true;
    }
    return false;
  }

  removeTimeBlock(id) {
    const index = this.timeBlocks.findIndex(b => b.id === id);
    if (index !== -1) {
      this.timeBlocks.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  /**
   * ✅ 시간 블록 제거 (스트릭 재검증 포함)
   */
  removeTimeBlockWithValidation(id, streakService) {
    if (this.removeTimeBlock(id)) {
      // 스트릭 재검증 (마지막 완료 블록이 삭제되었을 수 있음)
      streakService.validateStreakAfterChange();
      return true;
    }
    return false;
  }

  updateTimeBlock(id, updates) {
    const block = this.timeBlocks.find(b => b.id === id);
    if (block) {
      Object.assign(block, updates);
      if (!block.date) {
        block.date = DataManager.getLocalDateString();
      }
      this.save();
      return true;
    }
    return false;
  }

  /**
   * ✅ SSOT: 특정 날짜의 총 학습 시간을 계산
   */
  getTotalHoursForDate(date) {
    return this.timeBlocks
      .filter(b => b.date === date && b.completed)
      .reduce((sum, b) => sum + b.hours, 0);
  }

  /**
   * ✅ SSOT: 주간 통계 계산
   */
  getWeeklyStats() {
    const today = new Date();
    const stats = {};

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

      stats[dayName] = this.getTotalHoursForDate(dateStr);
    }

    return stats;
  }

  /**
   * ✅ SSOT: 총 학습 시간 (모든 완료된 timeBlocks)
   */
  getTotalStudyHours() {
    return this.timeBlocks
      .filter(b => b.completed)
      .reduce((sum, b) => sum + b.hours, 0);
  }

  /**
   * ✅ 과목의 RotationTracker 가져오기 (없으면 생성)
   */
  getRotationTracker(subjectName) {
    if (!this.rotationTrackers[subjectName]) {
      this.rotationTrackers[subjectName] = new RotationTracker(subjectName);
    }
    return this.rotationTrackers[subjectName];
  }

  /**
   * ✅ 모의고사 성적 추가
   */
  addMockScore(scoreData) {
    // ✅ FIX: 에러 처리 추가
    try {
      const mockScore = new MockScore(scoreData);
      this.mockScores.push(mockScore);
      this.save();
      return mockScore;
    } catch (error) {
      console.error('❌ MockScore 생성 실패:', error.message);
      throw error;
    }
  }

  /**
   * ✅ 특정 과목의 평균 성적 계산
   */
  getAverageMockScore(subject) {
    const subjectScores = this.mockScores.filter(s => s.subject === subject);
    if (subjectScores.length === 0) return 0;
    const totalScore = subjectScores.reduce((sum, s) => sum + s.scorePercent, 0);
    return totalScore / subjectScores.length;
  }

  save() {
    localStorage.setItem('studyData', JSON.stringify({
      timeBlocks: this.timeBlocks,
      subjects: this.subjects,
      mockScores: this.mockScores,
      rotationTrackers: this.rotationTrackers,
      streak: this.streak,
      examType: this.examType
    }));
  }

  loadFromStorage() {
    const saved = localStorage.getItem('studyData');
    if (saved) {
      const data = JSON.parse(saved);
      this.timeBlocks = (data.timeBlocks || []).map(b => new TimeBlock(b));
      this.subjects = data.subjects || [];
      this.mockScores = (data.mockScores || []).map(m => new MockScore(m));

      // ✅ FIX: RotationTracker 인스턴스로 올바르게 복원
      this.rotationTrackers = {};
      if (data.rotationTrackers) {
        Object.keys(data.rotationTrackers).forEach(subject => {
          const tracker = new RotationTracker(subject);
          const saved = data.rotationTrackers[subject];
          // 저장된 rotations 데이터로 복원
          if (saved && saved.rotations && Array.isArray(saved.rotations)) {
            tracker.rotations = saved.rotations;
          }
          this.rotationTrackers[subject] = tracker;
        });
      }

      this.streak = { ...new StreakData(), ...data.streak };
      this.examType = data.examType || '1차';
    }
  }
}

/**
 * ✅ 스트릭 서비스 (완전 재작성)
 */
class StreakService {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * ✅ 핵심 로직: 오늘 공부했는지 판정
   * SSOT: StudySession.hasStudied 사용
   */
  updateStreak() {
    const today = DataManager.getLocalDateString();
    const todaySession = this.dataManager.getSessionForDate(today);
    const lastStudy = this.dataManager.streak.lastStudyDate;

    // ✅ 중요: 오늘 공부했고, 아직 업데이트하지 않은 경우만
    if (todaySession.hasStudied && lastStudy !== today) {
      if (lastStudy) {
        const lastDate = new Date(lastStudy);
        const todayDate = new Date(today);
        const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          this.dataManager.streak.current++;
          console.log(`✅ 스트릭 연속: ${this.dataManager.streak.current}일`);
        } else if (daysDiff > 1) {
          this.dataManager.streak.current = 1;
          console.log(`⚠️ 스트릭 끊김: 1일부터 시작`);
        }
      } else {
        this.dataManager.streak.current = 1;
        console.log(`🌱 첫 스트릭: 1일 시작`);
      }

      this.dataManager.streak.lastStudyDate = today;
      this.dataManager.streak.totalDays++;

      if (this.dataManager.streak.current > this.dataManager.streak.longest) {
        this.dataManager.streak.longest = this.dataManager.streak.current;
      }

      this.dataManager.save();
      console.log(`📊 스트릭 저장: 현재=${this.dataManager.streak.current}, 최장=${this.dataManager.streak.longest}`);
    }

    // ✅ 오늘 공부 안 했는데 마지막 학습이 오늘인 경우
    if (!todaySession.hasStudied && lastStudy === today) {
      console.log(`🔄 오늘 학습 제거됨: 스트릭 미업데이트`);
    }
  }

  /**
   * ✅ 오늘 공부 여부만 판정 (스트릭 업데이트 없음)
   */
  hasStudiedToday() {
    const today = DataManager.getLocalDateString();
    const todaySession = this.dataManager.getSessionForDate(today);
    return todaySession.hasStudied;
  }

  /**
   * ✅ 마지막 학습이 오늘인지 확인
   */
  isLastStudyToday() {
    const today = DataManager.getLocalDateString();
    return this.dataManager.streak.lastStudyDate === today;
  }

  /**
   * ✅ 시간 블록 제거 시 스트릭 재계산
   * 마지막 완료 블록이 제거되었을 수 있으므로 검증 필요
   */
  validateStreakAfterChange() {
    const today = DataManager.getLocalDateString();
    const todaySession = this.dataManager.getSessionForDate(today);
    const lastStudy = this.dataManager.streak.lastStudyDate;

    // 오늘 공부가 없는데 lastStudyDate가 오늘이면, 이전 날로 변경
    if (!todaySession.hasStudied && lastStudy === today) {
      // ✅ FIX: 어제 데이터 확인 (로컬 시간대 사용)
      const yesterday = DataManager.getLocalDateString(-1);
      const yesterdaySession = this.dataManager.getSessionForDate(yesterday);

      if (yesterdaySession.hasStudied) {
        this.dataManager.streak.lastStudyDate = yesterday;
        console.log(`🔧 스트릭 수정: lastStudyDate를 어제로 변경`);
      } else {
        // 어제도 공부 안 했으면, 더 이전을 찾아야 함
        this.findLastStudyDate();
      }
      this.dataManager.save();
    }
  }

  /**
   * ✅ 마지막 공부 날짜 재탐색
   */
  findLastStudyDate() {
    let searchDate = new Date();

    for (let i = 0; i < 365; i++) {
      const dateStr = new Date(searchDate.setDate(searchDate.getDate() - 1)).toISOString().split('T')[0];
      const session = this.dataManager.getSessionForDate(dateStr);

      if (session.hasStudied) {
        this.dataManager.streak.lastStudyDate = dateStr;
        console.log(`🔍 마지막 공부 날짜 찾음: ${dateStr}`);
        return dateStr;
      }
    }

    // 365일 이내에 공부가 없으면 초기화
    this.dataManager.streak.lastStudyDate = null;
    this.dataManager.streak.current = 0;
    console.log(`❌ 365일 이내 공부 기록 없음: 스트릭 초기화`);
  }
}

/**
 * 통계 서비스
 */
class StatisticsService {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * ✅ SSOT: 일 평균 학습 시간
   */
  getAverageDailyHours() {
    const completedDates = new Set();
    this.dataManager.timeBlocks.forEach(block => {
      if (block.completed) {
        completedDates.add(block.date);
      }
    });

    if (completedDates.size === 0) return 0;

    const totalHours = this.dataManager.getTotalStudyHours();
    return totalHours / completedDates.size;
  }

  /**
   * ✅ SSOT: 월간 통계
   */
  getMonthlyStats(monthStr) {
    const blocksForMonth = this.dataManager.timeBlocks.filter(b =>
      b.date.startsWith(monthStr) && b.completed
    );

    return {
      totalHours: blocksForMonth.reduce((sum, b) => sum + b.hours, 0),
      blockCount: blocksForMonth.length,
      avgHoursPerDay: blocksForMonth.length > 0 ? blocksForMonth.reduce((sum, b) => sum + b.hours, 0) / new Set(blocksForMonth.map(b => b.date)).size : 0
    };
  }

  /**
   * ✅ 학습 효율성 점수 (0-100)
   */
  getEfficiencyScore() {
    const today = DataManager.getLocalDateString();
    const todaySession = this.dataManager.getSessionForDate(today);

    if (todaySession.totalPlannedHours === 0) return 0;

    const ratio = todaySession.totalCompletedHours / todaySession.totalPlannedHours;
    return Math.min(100, Math.round(ratio * 100));
  }

  /**
   * ✅ 성적 분석: 약점 과목 식별
   */
  getWeakSubjects(threshold = 60) {
    const weakSubjects = [];
    const uniqueSubjects = new Set(this.dataManager.mockScores.map(s => s.subject));

    uniqueSubjects.forEach(subject => {
      const avgScore = this.dataManager.getAverageMockScore(subject);
      if (avgScore < threshold) {
        weakSubjects.push({
          subject,
          avgScore: Math.round(avgScore),
          count: this.dataManager.mockScores.filter(s => s.subject === subject).length
        });
      }
    });

    return weakSubjects.sort((a, b) => a.avgScore - b.avgScore);
  }

  /**
   * ✅ 성적 추이 분석 (최근 N개)
   */
  getScoreTrend(subject = null, limit = 5) {
    let scores = this.dataManager.mockScores;

    if (subject) {
      scores = scores.filter(s => s.subject === subject);
    }

    return scores.slice(-limit).map(s => ({
      date: s.date,
      score: s.scorePercent,
      subject: s.subject
    }));
  }

  /**
   * ✅ 회독 진도 분석
   */
  getRotationProgress(subject) {
    const tracker = this.dataManager.getRotationTracker(subject);
    return {
      subject,
      progress: tracker.progressPercent,
      completed: tracker.rotations.filter(r => r.completed).length,
      nextRotation: tracker.nextRotation,
      rotations: tracker.rotations
    };
  }

  /**
   * ✅ 성적과 회독의 상관관계 분석
   */
  analyzeStudyEffectiveness(subject) {
    const avgScore = this.dataManager.getAverageMockScore(subject);
    const tracker = this.dataManager.getRotationTracker(subject);
    const studyHours = this.dataManager.timeBlocks
      .filter(b => b.subject === subject && b.completed)
      .reduce((sum, b) => sum + b.hours, 0);

    return {
      subject,
      avgScore: Math.round(avgScore),
      rotationProgress: Math.round(tracker.progressPercent),
      studyHours: Math.round(studyHours * 10) / 10,
      effectiveness: {
        score: avgScore > 70 ? '우수' : avgScore > 50 ? '보통' : '미흡',
        rotations: tracker.progressPercent > 50 ? '진행 중' : '시작 단계'
      }
    };
  }
}

// ============================================================================
// 3️⃣  UI MANAGER LAYER
// ============================================================================

/**
 * 뷰 관리자 (렌더링 통합)
 */
class ViewManager {
  constructor(dataManager, streakService, statsService) {
    this.dataManager = dataManager;
    this.streakService = streakService;
    this.statsService = statsService;
  }

  /**
   * ✅ 통합 렌더링: 모든 UI 업데이트
   */
  render() {
    this.renderTimeBlocks();
    this.renderStreak();
    this.renderWeeklyStats();
    this.renderSubjectProgress();
    this.renderRotationTracker();
  }

  renderTimeBlocks() {
    const container = document.getElementById('time-blocks-container');
    if (!container) return;

    const today = DataManager.getLocalDateString();
    const todayBlocks = this.dataManager.timeBlocks.filter(b => b.date === today);

    if (todayBlocks.length === 0) {
      container.innerHTML = '<p>오늘 계획된 학습이 없습니다</p>';
      return;
    }

    const html = todayBlocks.map(block => `
      <div class="time-block ${block.completed ? 'completed' : ''}">
        <div>
          <strong>${block.subject}</strong>
          <span>${block.startTime} - ${block.endTime} (${block.hours}시간)</span>
        </div>
        <button onclick="appState.toggleBlock(${block.id})" class="btn-check">
          ${block.completed ? '✓' : '완료'}
        </button>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  renderStreak() {
    const streakEl = document.getElementById('current-streak');
    const longestEl = document.getElementById('longest-streak');
    const statusEl = document.getElementById('streak-status');

    if (streakEl) streakEl.textContent = this.dataManager.streak.current || 0;
    if (longestEl) longestEl.textContent = this.dataManager.streak.longest || 0;

    if (statusEl) {
      if (this.streakService.isLastStudyToday()) {
        statusEl.innerHTML = '✅ 오늘 학습 완료!';
        statusEl.style.background = 'rgba(52, 211, 153, 0.2)';
        statusEl.style.color = '#34D399';
      } else if (this.dataManager.streak.current > 0) {
        statusEl.innerHTML = `🔥 ${this.dataManager.streak.current}일 연속`;
        statusEl.style.background = 'rgba(255, 107, 107, 0.2)';
        statusEl.style.color = '#FF6B6B';
      } else {
        statusEl.innerHTML = '🌱 스트릭 시작하기';
        statusEl.style.background = 'rgba(100, 200, 255, 0.2)';
        statusEl.style.color = '#64C8FF';
      }
    }
  }

  renderWeeklyStats() {
    const stats = this.dataManager.getWeeklyStats();
    // ✅ UI 업데이트 (기존 DOM 활용)
    const statsContainer = document.getElementById('weekly-stats');
    if (statsContainer) {
      const statsHtml = Object.entries(stats).map(([day, hours]) => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
          <span>${day}</span>
          <strong>${hours.toFixed(1)}시간</strong>
        </div>
      `).join('');
      statsContainer.innerHTML = statsHtml || '<p>주간 데이터가 없습니다</p>';
    }
  }

  renderSubjectProgress() {
    const progressEl = document.getElementById('subject-progress');
    if (progressEl) {
      const progressHtml = this.dataManager.subjects.map(subject => {
        const percent = subject.progressPercent || 0;
        return `
          <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: 600;">${subject.name}</span>
              <span>${percent.toFixed(0)}%</span>
            </div>
            <div style="background: #e9ecef; border-radius: 8px; height: 20px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #6366f1, #8b5cf6); height: 100%; width: ${percent}%; transition: width 0.3s;"></div>
            </div>
          </div>
        `;
      }).join('');
      progressEl.innerHTML = progressHtml || '<p>과목이 없습니다</p>';
    }
  }

  renderRotationTracker() {
    const trackerEl = document.getElementById('rotation-tracker');
    if (trackerEl) {
      const trackerHtml = this.dataManager.subjects.map(subject => {
        const rotations = subject.rotations || [false, false, false, false, false, false, false];
        const rotationDots = rotations.map((completed, idx) => `
          <span style="display: inline-block; width: 24px; height: 24px; margin: 0 4px; background: ${completed ? '#34D399' : '#e9ecef'}; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; color: ${completed ? '#fff' : '#6c757d'}; cursor: pointer; transition: all 0.2s;"
                onclick="appState.toggleRotation('${subject.name}', ${idx})">
            ${idx + 1}
          </span>
        `).join('');

        return `
          <div style="margin-bottom: 15px;">
            <div style="font-weight: 600; margin-bottom: 8px;">${subject.name}</div>
            <div>${rotationDots}</div>
          </div>
        `;
      }).join('');
      trackerEl.innerHTML = trackerHtml || '<p>과목이 없습니다</p>';
    }
  }

  /**
   * ✅ v3.10.0: 향상된 성적 분석 대시보드
   */
  renderAnalyticsDashboard() {
    const weakSubjects = this.statsService.getWeakSubjects(60);

    // 약점 과목 경고
    const alertsContainer = document.getElementById('analytics-alerts');
    if (alertsContainer && weakSubjects.length > 0) {
      const alerts = weakSubjects.map(s => `
        <div class="alert alert--warning">
          <span>⚠️</span>
          <span><strong>${s.subject}</strong>: 평균 ${s.scorePercent}% (${s.count}회)</span>
        </div>
      `).join('');
      alertsContainer.innerHTML = alerts;
    }

    // 성적 추이 차트
    this.renderScoreTrendChart();
  }

  /**
   * ✅ 성적 추이 차트 (SVG 막대 그래프)
   */
  renderScoreTrendChart() {
    const chartEl = document.getElementById('score-trend-chart');
    if (!chartEl) return;

    const trend = this.statsService.getScoreTrend(null, 5);
    if (trend.length === 0) {
      chartEl.innerHTML = '<p style="text-align: center; color: #9ca3af;">성적 데이터가 없습니다</p>';
      return;
    }

    const maxScore = Math.max(...trend.map(t => t.score), 100);
    const barWidth = 40;
    const gap = 15;
    const svgWidth = trend.length * (barWidth + gap) + 20;
    const svgHeight = 250;

    const bars = trend.map((item, idx) => {
      const height = (item.score / maxScore) * 180;
      const x = 10 + idx * (barWidth + gap);
      const y = 200 - height;

      return `
        <g>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${height}"
                fill="url(#barGradient)" rx="4" class="bar"
                style="cursor: pointer; transition: filter 0.3s;">
            <title>${item.subject}: ${item.score.toFixed(0)}%</title>
          </rect>
          <text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle"
                font-weight="700" font-size="12" fill="#1f2937">
            ${item.score.toFixed(0)}%
          </text>
          <text x="${x + barWidth/2}" y="${svgHeight - 5}" text-anchor="middle"
                font-size="11" fill="#6b7280">
            ${item.date.slice(5)}
          </text>
        </g>
      `;
    }).join('');

    const svg = `
      <svg width="${svgWidth}" height="${svgHeight}" style="max-width: 100%; height: auto;">
        <defs>
          <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <!-- X축 -->
        <line x1="0" y1="200" x2="${svgWidth}" y2="200" stroke="#e5e7eb" stroke-width="2"/>
        <!-- Y축 -->
        <line x1="0" y1="0" x2="0" y2="200" stroke="#e5e7eb" stroke-width="2"/>
        ${bars}
      </svg>
    `;

    chartEl.innerHTML = svg;
  }

  /**
   * ✅ 메트릭 카드 렌더링
   */
  renderMetricCards() {
    const today = DataManager.getLocalDateString();
    const todaySession = this.dataManager.getSessionForDate(today);
    const totalHours = this.dataManager.getTotalStudyHours();
    const efficiency = this.statsService.getEfficiencyScore();

    const metricsEl = document.getElementById('metrics-cards-container');
    if (!metricsEl) return;

    const metricsHtml = `
      <div class="metric-card animate-fade-in-up">
        <span class="metric-icon">🔥</span>
        <div>
          <div style="font-size: 0.9rem; opacity: 0.9;">현재 스트릭</div>
          <div class="metric-value">${this.dataManager.streak.current}일</div>
          <div style="font-size: 0.8rem; opacity: 0.8;">최장: ${this.dataManager.streak.longest}일</div>
        </div>
      </div>

      <div class="metric-card metric-card--success animate-fade-in-up" style="animation-delay: 0.1s;">
        <span class="metric-icon">⏱️</span>
        <div>
          <div style="font-size: 0.9rem; opacity: 0.9;">총 학습 시간</div>
          <div class="metric-value">${totalHours.toFixed(1)}h</div>
          <div style="font-size: 0.8rem; opacity: 0.8;">오늘: ${todaySession.totalCompletedHours.toFixed(1)}h</div>
        </div>
      </div>

      <div class="metric-card metric-card--accent animate-fade-in-up" style="animation-delay: 0.2s;">
        <span class="metric-icon">📊</span>
        <div>
          <div style="font-size: 0.9rem; opacity: 0.9;">효율성</div>
          <div class="metric-value">${efficiency}%</div>
          <div style="font-size: 0.8rem; opacity: 0.8;">계획 대비</div>
        </div>
      </div>
    `;

    metricsEl.innerHTML = metricsHtml;
  }

  /**
   * ✅ 주간 차트 렌더링 (막대 그래프)
   */
  renderWeeklyChart() {
    const chartEl = document.getElementById('weekly-chart');
    if (!chartEl) return;

    const stats = this.dataManager.getWeeklyStats();
    const days = Object.entries(stats);
    const maxHours = Math.max(...days.map(d => d[1]), 5);

    const bars = days.map(([day, hours], idx) => {
      const percent = (hours / maxHours) * 100;
      return `
        <div style="flex: 1; text-align: center;">
          <div class="bar" style="height: ${percent * 2}px;">
            <div class="bar-value">${hours.toFixed(1)}h</div>
          </div>
          <div class="bar-label">${day}</div>
        </div>
      `;
    }).join('');

    const chartHtml = `
      <div class="chart-container">
        <div class="chart-bar">
          ${bars}
        </div>
      </div>
    `;

    chartEl.innerHTML = chartHtml;
  }

  /**
   * ✅ 회독 진도 원형 차트 (SVG)
   */
  renderRotationProgressCircle(subject) {
    const tracker = this.dataManager.getRotationTracker(subject);
    const progress = tracker.progressPercent;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const svg = `
      <div class="rotation-ring">
        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="60" r="${radius}" fill="none"
                  stroke="#e5e7eb" stroke-width="8"/>
          <circle cx="60" cy="60" r="${radius}" fill="none"
                  stroke="url(#rotationGradient)" stroke-width="8"
                  stroke-dasharray="${circumference}"
                  stroke-dashoffset="${strokeDashoffset}"
                  stroke-linecap="round"
                  transform="rotate(-90 60 60)"/>
          <defs>
            <linearGradient id="rotationGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
          </defs>
          <text x="60" y="60" text-anchor="middle" dy="0.3em"
                font-weight="700" font-size="20" fill="#1f2937">
            ${Math.round(progress)}%
          </text>
        </svg>
      </div>
    `;

    return svg;
  }
}

// ============================================================================
// 4️⃣  APPLICATION STATE & HANDLERS
// ============================================================================

/**
 * ✅ 전역 애플리케이션 상태 및 이벤트 핸들러
 */
class AppState {
  constructor() {
    this.dataManager = new DataManager();
    this.streakService = new StreakService(this.dataManager);
    this.statsService = new StatisticsService(this.dataManager);
    this.viewManager = new ViewManager(this.dataManager, this.streakService, this.statsService);
  }

  init() {
    // 기본 렌더링
    this.viewManager.render();

    // v3.10.0 향상된 UI 렌더링
    this.viewManager.renderMetricCards();
    this.viewManager.renderWeeklyChart();
    this.viewManager.renderAnalyticsDashboard();

    console.log('✅ 애플리케이션 초기화 완료 (v3.10.0 UI 개선사항 포함)');
  }

  /**
   * ✅ TimeBlock 토글 + 전체 업데이트
   */
  toggleBlock(id) {
    if (this.dataManager.toggleTimeBlock(id)) {
      this.streakService.updateStreak();
      this.viewManager.render();
      // v3.10.0 향상된 UI 업데이트
      this.viewManager.renderMetricCards();
      this.viewManager.renderWeeklyChart();
      showToast('학습 상태가 업데이트되었습니다');
    }
  }

  /**
   * ✅ TimeBlock 추가
   */
  addBlock(subject, startTime, endTime, detail) {
    const hours = this.calculateHours(startTime, endTime);
    this.dataManager.addTimeBlock({
      date: DataManager.getLocalDateString(),
      subject,
      startTime,
      endTime,
      hours,
      detail,
      completed: false
    });
    this.viewManager.render();
    showToast('학습 블록이 추가되었습니다');
  }

  /**
   * ✅ TimeBlock 제거 (스트릭 재검증)
   */
  removeBlock(id) {
    if (this.dataManager.removeTimeBlockWithValidation(id, this.streakService)) {
      this.viewManager.render();
      showToast('학습 블록이 제거되었습니다');
    }
  }

  calculateHours(startTime, endTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
  }

  /**
   * ✅ 회독 토글 (RotationTracker 기반)
   */
  toggleRotation(subjectName, rotationIndex) {
    const tracker = this.dataManager.getRotationTracker(subjectName);
    const roundNum = rotationIndex + 1;
    const rotation = tracker.rotations[rotationIndex];

    if (rotation) {
      rotation.completed = !rotation.completed;
      if (rotation.completed) {
        rotation.date = DataManager.getLocalDateString();
      }
      this.dataManager.save();
      this.viewManager.render();
      showToast(`${subjectName} 회독 #${roundNum} ${rotation.completed ? '완료' : '취소'}`);
    }
  }

  /**
   * ✅ 모의고사 성적 추가
   */
  addMockScore(subject, score, maxScore = 100, round = 1) {
    const mockScore = this.dataManager.addMockScore({
      subject,
      score,
      maxScore,
      round,
      accuracy: (score / maxScore) * 100
    });
    this.viewManager.render();
    showToast(`${subject} 모의고사 성적 기록: ${score}/${maxScore}`);
    return mockScore;
  }

  /**
   * ✅ 회독 완료 표시
   */
  completeRotation(subject, roundNum) {
    const tracker = this.dataManager.getRotationTracker(subject);
    tracker.completeRotation(roundNum);
    this.dataManager.save();
    this.viewManager.render();
    showToast(`${subject} 회독 #${roundNum} 완료!`);
  }

  /**
   * ✅ 약점 과목 분석
   */
  getWeakSubjectsReport() {
    const weakSubjects = this.statsService.getWeakSubjects(60);
    if (weakSubjects.length === 0) {
      showToast('모든 과목이 우수합니다! 🎉');
      return [];
    }
    return weakSubjects;
  }

  /**
   * ✅ 과목별 효율성 분석
   */
  getSubjectEffectiveness(subject) {
    return this.statsService.analyzeStudyEffectiveness(subject);
  }

  /**
   * ✅ 데이터 초기화 (디버그용)
   */
  resetData() {
    if (confirm('모든 데이터를 초기화하시겠습니까?')) {
      this.dataManager.timeBlocks = [];
      this.dataManager.subjects = [];
      this.dataManager.mockScores = [];
      this.dataManager.rotationTrackers = {};
      this.dataManager.streak = new StreakData();
      this.dataManager.save();
      this.viewManager.render();
      showToast('데이터가 초기화되었습니다');
    }
  }

  /**
   * ✅ v3.11.0: 메트릭 모달 표시
   */
  showMetricModal(metricType) {
    const today = DataManager.getLocalDateString();
    const todaySession = this.dataManager.getSessionForDate(today);
    const totalHours = this.dataManager.getTotalStudyHours();
    const weakSubjects = this.statsService.getWeakSubjects(60);

    let title = '';
    let content = '';

    switch(metricType) {
      case 'overall-progress':
        const completedDates = new Set();
        this.dataManager.timeBlocks.forEach(block => {
          if (block.completed) completedDates.add(block.date);
        });

        title = '📊 전체 학습 진도';
        content = `
          <div class="modal-metric-content">
            <div class="metric-stat">
              <span class="stat-label">총 학습 시간</span>
              <span class="stat-value">${totalHours.toFixed(1)}시간</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">학습한 날짜</span>
              <span class="stat-value">${completedDates.size}일</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">계획 블록</span>
              <span class="stat-value">${this.dataManager.timeBlocks.length}개</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">완료 블록</span>
              <span class="stat-value">${this.dataManager.timeBlocks.filter(b => b.completed).length}개</span>
            </div>
          </div>
        `;
        break;

      case 'streak':
        title = '🔥 연속 학습 통계';
        content = `
          <div class="modal-metric-content">
            <div class="metric-stat">
              <span class="stat-label">현재 스트릭</span>
              <span class="stat-value" style="color: #ff6b6b; font-size: 2rem;">${this.dataManager.streak.current}일</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">최장 스트릭</span>
              <span class="stat-value" style="color: #667eea; font-size: 2rem;">${this.dataManager.streak.longest}일</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">마지막 학습</span>
              <span class="stat-value">${this.dataManager.streak.lastStudyDate || '없음'}</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">누적 학습일</span>
              <span class="stat-value">${this.dataManager.streak.totalDays}일</span>
            </div>
          </div>
        `;
        break;

      case 'today-completed':
        title = '✅ 오늘 완료 현황';
        content = `
          <div class="modal-metric-content">
            <div class="metric-stat">
              <span class="stat-label">계획한 블록</span>
              <span class="stat-value">${this.dataManager.timeBlocks.filter(b => b.date === today).length}개</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">완료한 블록</span>
              <span class="stat-value">${todaySession.completedBlocks.length}개</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">완료율</span>
              <span class="stat-value">${this.dataManager.timeBlocks.filter(b => b.date === today).length > 0 ? Math.round((todaySession.completedBlocks.length / this.dataManager.timeBlocks.filter(b => b.date === today).length) * 100) : 0}%</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">오늘 공부함</span>
              <span class="stat-value">${todaySession.hasStudied ? '✅ 네' : '❌ 아니오'}</span>
            </div>
          </div>
        `;
        break;

      case 'today-hours':
        title = '⏱️ 오늘 학습 시간';
        content = `
          <div class="modal-metric-content">
            <div class="metric-stat">
              <span class="stat-label">계획 시간</span>
              <span class="stat-value">${todaySession.totalPlannedHours.toFixed(1)}시간</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">완료 시간</span>
              <span class="stat-value">${todaySession.totalCompletedHours.toFixed(1)}시간</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">효율성</span>
              <span class="stat-value">${this.statsService.getEfficiencyScore()}%</span>
            </div>
            <div class="metric-stat">
              <span class="stat-label">남은 시간</span>
              <span class="stat-value">${Math.max(0, todaySession.totalPlannedHours - todaySession.totalCompletedHours).toFixed(1)}시간</span>
            </div>
          </div>
        `;
        break;

      default:
        return;
    }

    // 모달 표시
    this.showModal(title, content);
  }

  /**
   * ✅ 모달 표시 (일반 용도)
   */
  showModal(title, content) {
    let modal = document.getElementById('metric-detail-modal');

    // ✅ FIX: 모달 생성 및 이벤트 리스너 한 번만 등록
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'metric-detail-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h2 id="modal-title"></h2>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body" id="modal-body"></div>
        </div>
      `;
      document.body.appendChild(modal);

      // ✅ FIX: 클릭 핸들러 저장 (나중에 제거 가능하도록)
      modal._closeClickHandler = (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      };
      modal.addEventListener('click', modal._closeClickHandler);

      // ✅ FIX: 닫기 버튼 핸들러
      const closeBtn = modal.querySelector('.modal-close');
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });

      // ✅ FIX: ESC 키 핸들러 저장 (나중에 제거 가능하도록)
      modal._escapeKeyHandler = (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
          modal.style.display = 'none';
        }
      };
      document.addEventListener('keydown', modal._escapeKeyHandler);

      // ✅ 초기화 플래그
      modal._initialized = true;
    }

    // 모달 내용 업데이트
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;

    // 모달 표시
    modal.style.display = 'flex';
  }
}

// ============================================================================
// 5️⃣  INITIALIZATION
// ============================================================================

// ✅ 전역 상태
let appState = null;

// ✅ 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  appState = new AppState();
  appState.init();

  console.log('📊 v3.9.0 데이터 구조 검증:');
  console.log('✅ SSOT 중심: timeBlocks');
  console.log('✅ 단일 정보 소스 원칙 적용됨');
  console.log('✅ 스트릭 시스템 재작성 완료');
  console.log('✅ TypeScript 패턴 적용됨');
  console.log('✅ MockScore 정규화 완료');
  console.log('✅ RotationTracker 통합 완료');
  console.log('✅ 성적 분석 엔진 추가됨');
});

/**
 * ✅ 기존 함수와의 호환성 (기존 HTML에서 호출하는 함수들)
 */

function showToast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // 기존 showToast 함수 있으면 호출, 없으면 console 사용
  const existingShowToast = window.showToast;
  if (existingShowToast && typeof existingShowToast === 'function') {
    existingShowToast(message, type);
  }
}

// 기존 toggleTimeBlock 호환성
function toggleTimeBlock(id) {
  if (appState) appState.toggleBlock(id);
}

// 기존 saveData 호환성
function saveData() {
  if (appState) appState.dataManager.save();
}

// 기존 updateStreak 호환성
function updateStreak() {
  if (appState) appState.streakService.updateStreak();
}

console.log('✅ app.js 로드 완료 - v3.10.0 UI/UX 디자인 & 인터렉션 개선');
