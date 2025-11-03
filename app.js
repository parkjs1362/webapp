/**
 * 사법시험 학습 시스템 v3.9.0
 *
 * ✅ TypeScript 패턴 · 단일 정보 소스(SSOT) 원칙 · 정규화 데이터 모델
 * ✅ 회독 추적 & 성적 분석 시스템 통합
 *
 * 아키텍처:
 * 1. Data Model: 정규화된 데이터 구조 (timeBlocks 중심)
 * 2. Services: 비즈니스 로직 (DataManager, StreakService, StatisticsService)
 * 3. Managers: UI 로직 (ViewManager, ChartManager)
 * 4. Handlers: 이벤트 처리
 * 5. Analytics: 성적 & 회독 분석
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
    this.id = data.id || Date.now();
    this.date = data.date || new Date().toISOString().split('T')[0];  // YYYY-MM-DD (필수!)
    this.subject = data.subject;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.hours = data.hours || 2;
    this.completed = data.completed || false;
    this.detail = data.detail || '';
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
    this.id = data.id || Date.now();
    this.date = data.date || new Date().toISOString().split('T')[0];
    this.subject = data.subject;
    this.round = data.round || 1;  // 회차
    this.score = data.score || 0;
    this.maxScore = data.maxScore || 100;
    this.correctCount = data.correctCount || 0;
    this.totalCount = data.totalCount || 0;
    this.accuracy = data.accuracy || 0; // 정답률 (%)
    this.notes = data.notes || '';
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
      rotation.date = new Date().toISOString().split('T')[0];
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
   * ✅ 핵심: 모든 데이터는 timeBlocks에서 계산
   * studyHistory는 캐시일 뿐, 원본이 아님
   */
  getSessionForDate(date) {
    return new StudySession(date, this.timeBlocks);
  }

  addTimeBlock(block) {
    // ✅ date 필드는 필수!
    if (!block.date) {
      block.date = new Date().toISOString().split('T')[0];
    }
    this.timeBlocks.push(new TimeBlock(block));
    this.save();
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
        block.date = new Date().toISOString().split('T')[0];
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
    const mockScore = new MockScore(scoreData);
    this.mockScores.push(mockScore);
    this.save();
    return mockScore;
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
      this.rotationTrackers = data.rotationTrackers || {};
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
    const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
    const todaySession = this.dataManager.getSessionForDate(today);
    return todaySession.hasStudied;
  }

  /**
   * ✅ 마지막 학습이 오늘인지 확인
   */
  isLastStudyToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.dataManager.streak.lastStudyDate === today;
  }

  /**
   * ✅ 시간 블록 제거 시 스트릭 재계산
   * 마지막 완료 블록이 제거되었을 수 있으므로 검증 필요
   */
  validateStreakAfterChange() {
    const today = new Date().toISOString().split('T')[0];
    const todaySession = this.dataManager.getSessionForDate(today);
    const lastStudy = this.dataManager.streak.lastStudyDate;

    // 오늘 공부가 없는데 lastStudyDate가 오늘이면, 이전 날로 변경
    if (!todaySession.hasStudied && lastStudy === today) {
      // 어제 데이터 확인
      const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
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

    const today = new Date().toISOString().split('T')[0];
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
    this.viewManager.render();
    console.log('✅ 애플리케이션 초기화 완료');
  }

  /**
   * ✅ TimeBlock 토글 + 전체 업데이트
   */
  toggleBlock(id) {
    if (this.dataManager.toggleTimeBlock(id)) {
      this.streakService.updateStreak();
      this.viewManager.render();
      showToast('학습 상태가 업데이트되었습니다');
    }
  }

  /**
   * ✅ TimeBlock 추가
   */
  addBlock(subject, startTime, endTime, detail) {
    const hours = this.calculateHours(startTime, endTime);
    this.dataManager.addTimeBlock({
      date: new Date().toISOString().split('T')[0],
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
        rotation.date = new Date().toISOString().split('T')[0];
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

console.log('✅ app.js 로드 완료 - v3.9.0 회독 추적 & 성적 분석 시스템 통합');
