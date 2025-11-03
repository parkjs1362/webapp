/**
 * 동기화 매니저 (Sync Manager)
 * v3.0.0 정규화 데이터의 자동 동기화 및 Observer 패턴 구현
 *
 * 역할:
 * 1. 데이터 변경 감지 (Observer)
 * 2. 종속 데이터 자동 업데이트 (Cascade Update)
 * 3. localStorage 저장
 * 4. UI 이벤트 발생
 */

class SyncManager {
    constructor(v3Data) {
        this.v3Data = v3Data;
        this.observers = {};  // 데이터 변경 리스너
        this.syncQueue = [];  // 동기화 대기열
        this.isSyncing = false;
        this.lastSyncTime = Date.now();

        console.log('✅ SyncManager initialized');
    }

    // ========================================================================
    // Observer 패턴 (리스너 등록/해제)
    // ========================================================================

    /**
     * 데이터 변경 감지 리스너 등록
     * @param {string} eventType - 이벤트 타입 (예: 'timeBlockCompleted')
     * @param {Function} callback - 콜백 함수
     */
    on(eventType, callback) {
        if (!this.observers[eventType]) {
            this.observers[eventType] = [];
        }
        this.observers[eventType].push(callback);
        console.log(`📌 Observer registered: ${eventType}`);
    }

    /**
     * 리스너 제거
     */
    off(eventType, callback) {
        if (this.observers[eventType]) {
            this.observers[eventType] = this.observers[eventType].filter(cb => cb !== callback);
        }
    }

    /**
     * 이벤트 발생
     */
    emit(eventType, data) {
        if (this.observers[eventType]) {
            this.observers[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in observer callback: ${eventType}`, error);
                }
            });
        }
    }

    // ========================================================================
    // 데이터 변경 감지 및 처리
    // ========================================================================

    /**
     * TimeBlock 추가/생성 시
     */
    onTimeBlockCreated(timeBlock) {
        console.log(`📝 TimeBlock created: ${timeBlock.id}`);

        // 1. 인덱스 추가
        this.v3Data.indices.timeBlocksById[timeBlock.id] = timeBlock;

        // 2. StudyPlan 진도 업데이트
        this.updatePlanProgress(timeBlock.planId);

        // 3. Subject 통계 업데이트
        this.updateSubjectStats(timeBlock.subjectId);

        // 4. 이벤트 발생
        this.emit('timeBlockCreated', { timeBlock });

        // 5. 저장
        this.scheduleSync();
    }

    /**
     * TimeBlock 완료 시
     */
    onTimeBlockCompleted(timeBlock) {
        console.log(`✅ TimeBlock completed: ${timeBlock.id}`);

        // 1. TimeBlock 상태 업데이트
        timeBlock.status = 'completed';
        timeBlock.completed = true;
        timeBlock.completedAt = Date.now();

        // 2. StudyLog 자동 생성
        const studyLog = this.createStudyLogFromTimeBlock(timeBlock);
        this.v3Data.studyLogs.push(studyLog);
        this.v3Data.indices.studyLogsById[studyLog.id] = studyLog;

        // 날짜별 인덱스 추가
        if (!this.v3Data.indices.studyLogsByDate[studyLog.date]) {
            this.v3Data.indices.studyLogsByDate[studyLog.date] = [];
        }
        this.v3Data.indices.studyLogsByDate[studyLog.date].push(studyLog);

        // 3. Subject 통계 업데이트 (완료된 로그 포함)
        this.updateSubjectStats(timeBlock.subjectId);

        // 4. LearningHistory 업데이트
        this.updateLearningHistoryForDate(studyLog.date, timeBlock.userId, timeBlock.planId);

        // 5. Streak 업데이트
        this.updateStreak(timeBlock.userId);

        // 6. 이벤트 발생
        this.emit('timeBlockCompleted', {
            timeBlock,
            studyLog,
            subjectId: timeBlock.subjectId
        });

        // 7. 저장
        this.scheduleSync();
    }

    /**
     * TimeBlock 삭제 시
     */
    onTimeBlockDeleted(blockId) {
        console.log(`🗑️  TimeBlock deleted: ${blockId}`);

        const block = this.v3Data.indices.timeBlocksById[blockId];
        if (!block) return;

        // 1. 인덱스에서 제거
        delete this.v3Data.indices.timeBlocksById[blockId];

        // 2. 배열에서 제거
        this.v3Data.timeBlocks = this.v3Data.timeBlocks.filter(b => b.id !== blockId);

        // 3. 관련 StudyLog 삭제
        this.v3Data.studyLogs = this.v3Data.studyLogs.filter(log => {
            if (log.timeBlockId === blockId) {
                delete this.v3Data.indices.studyLogsById[log.id];
                return false;  // 삭제
            }
            return true;
        });

        // 4. Subject 통계 재계산
        this.updateSubjectStats(block.subjectId);

        // 5. LearningHistory 업데이트
        this.updateLearningHistoryForDate(block.date, block.userId, block.planId);

        // 6. 이벤트 발생
        this.emit('timeBlockDeleted', { blockId, block });

        // 7. 저장
        this.scheduleSync();
    }

    /**
     * MockExam 기록 시
     */
    onMockExamRecorded(mockExam) {
        console.log(`📊 MockExam recorded: ${mockExam.id}`);

        // 1. 인덱스 추가
        // (현재는 단순 배열이지만, 나중에 필요시 인덱스 추가 가능)

        // 2. Subject별 점수 통계 업데이트
        Object.keys(mockExam.scores).forEach(subjectId => {
            this.updateSubjectMockStats(subjectId, mockExam.scores[subjectId]);
        });

        // 3. 취약 과목 식별
        this.identifyWeakSubjects(mockExam.planId);

        // 4. LearningHistory 업데이트
        this.updateLearningHistoryForDate(
            mockExam.examDate,
            mockExam.userId,
            mockExam.planId
        );

        // 5. 이벤트 발생
        this.emit('mockExamRecorded', { mockExam });

        // 6. 저장
        this.scheduleSync();
    }

    /**
     * Subject 진도 변경 시
     */
    onSubjectProgressChanged(subjectId, newProgress) {
        console.log(`📈 Subject progress changed: ${subjectId} → ${newProgress}%`);

        const subject = this.v3Data.indices.subjectsById[subjectId];
        if (!subject) return;

        subject.progressPercent = newProgress;

        // 1. StudyPlan 전체 진도 업데이트
        this.updatePlanProgress(subject.planId);

        // 2. 이벤트 발생
        this.emit('subjectProgressChanged', { subjectId, newProgress });

        // 3. 저장
        this.scheduleSync();
    }

    // ========================================================================
    // Cascade Update (종속 데이터 자동 업데이트)
    // ========================================================================

    /**
     * Subject 통계 재계산 및 업데이트
     *
     * 계산 내용:
     * - actualHours: 완료된 timeBlocks의 시간 합
     * - plannedHours: 전체 timeBlocks의 시간 합
     * - efficiency: actualHours / plannedHours * 100
     * - averageMockScore: mockExams 평균
     */
    updateSubjectStats(subjectId) {
        const subject = this.v3Data.indices.subjectsById[subjectId];
        if (!subject) return;

        // 1. 관련 TimeBlocks 찾기
        const relatedBlocks = this.v3Data.timeBlocks.filter(b => b.subjectId === subjectId);

        // 2. 시간 계산
        subject.plannedHours = relatedBlocks.reduce((sum, b) => sum + b.plannedHours, 0);
        subject.actualHours = relatedBlocks
            .filter(b => b.completed)
            .reduce((sum, b) => sum + b.plannedHours, 0);

        // 3. 효율성 계산
        subject.efficiency = subject.plannedHours > 0
            ? (subject.actualHours / subject.plannedHours) * 100
            : 0;

        // 4. 모의고사 점수 통계
        const relatedExams = this.v3Data.mockExams.filter(exam =>
            exam.scores[subjectId]
        );

        if (relatedExams.length > 0) {
            const scores = relatedExams.map(exam => exam.scores[subjectId].score);
            subject.averageMockScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            subject.recentScore = scores[scores.length - 1];
            subject.scoresTrend = this.analyzeTrend(scores);
        }

        console.log(`✅ Subject stats updated: ${subject.name}`);
    }

    /**
     * 모의고사 점수 통계 업데이트
     */
    updateSubjectMockStats(subjectId, scoreData) {
        const subject = this.v3Data.indices.subjectsById[subjectId];
        if (!subject) return;

        // 평균 점수 재계산
        const relatedExams = this.v3Data.mockExams.filter(exam =>
            exam.scores[subjectId]
        );

        if (relatedExams.length > 0) {
            const scores = relatedExams.map(exam => exam.scores[subjectId].score);
            subject.averageMockScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            subject.recentScore = scores[scores.length - 1];
            subject.scoresTrend = this.analyzeTrend(scores);
        }

        console.log(`✅ Subject mock stats updated: ${subject.name}`);
    }

    /**
     * StudyPlan 진도 계산 (모든 Subject의 진도 평균)
     */
    updatePlanProgress(planId) {
        const plan = this.v3Data.studyPlans.find(p => p.id === planId);
        if (!plan) return;

        const subjects = this.v3Data.subjects.filter(s => s.planId === planId);
        if (subjects.length === 0) {
            plan.progress = 0;
            return;
        }

        // 전체 진도율 평균
        const avgProgress = subjects.reduce((sum, s) => sum + s.progressPercent, 0) / subjects.length;
        plan.progress = avgProgress;

        // 전체 시간 계산
        plan.totalHours = subjects.reduce((sum, s) => sum + s.actualHours, 0);
        plan.plannedHours = subjects.reduce((sum, s) => sum + s.plannedHours, 0);

        console.log(`✅ Plan progress updated: ${avgProgress.toFixed(2)}%`);
    }

    /**
     * LearningHistory 업데이트 (특정 날짜)
     *
     * 업데이트 내용:
     * - totalHours: 완료된 블록의 시간 합
     * - subjectBreakdown: 과목별 학습 시간
     * - efficiency: 실제/계획 비율
     */
    updateLearningHistoryForDate(date, userId, planId) {
        let history = this.v3Data.indices.learningHistoryByDate[date];

        if (!history) {
            // 새로운 날짜 기록 생성
            history = {
                id: this.generateUUID(),
                userId: userId,
                planId: planId,
                date: date,
                weekOf: this.getWeekStart(date),
                monthOf: date.substring(0, 7),
                totalHours: 0,
                plannedHours: 0,
                efficiency: 0,
                subjectBreakdown: {},
                problemsSolved: 0,
                accuracy: 0,
                streak: { current: 0, longest: 0 },
                averageScore: 0,
                notes: '',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            this.v3Data.learningHistory.push(history);
            this.v3Data.indices.learningHistoryByDate[date] = history;
        }

        // 1. 그날의 TimeBlocks 가져오기
        const dayBlocks = this.v3Data.timeBlocks.filter(b => b.date === date);
        const completedBlocks = dayBlocks.filter(b => b.completed);

        // 2. 시간 계산
        history.plannedHours = dayBlocks.reduce((sum, b) => sum + b.plannedHours, 0);
        history.totalHours = completedBlocks.reduce((sum, b) => sum + b.plannedHours, 0);

        // 3. 효율성 계산
        history.efficiency = history.plannedHours > 0
            ? (history.totalHours / history.plannedHours) * 100
            : 0;

        // 4. 과목별 분석
        history.subjectBreakdown = {};
        completedBlocks.forEach(block => {
            if (!history.subjectBreakdown[block.subjectId]) {
                const subject = this.v3Data.indices.subjectsById[block.subjectId];
                history.subjectBreakdown[block.subjectId] = {
                    subject: subject.name,
                    hours: 0,
                    blockCount: 0
                };
            }

            history.subjectBreakdown[block.subjectId].hours += block.plannedHours;
            history.subjectBreakdown[block.subjectId].blockCount += 1;
        });

        // 5. 모의고사 점수 추가
        const dayExams = this.v3Data.mockExams.filter(e => e.examDate === date);
        if (dayExams.length > 0) {
            history.averageScore = dayExams.reduce((sum, e) => sum + e.totalScore, 0) / dayExams.length;
        }

        history.updatedAt = Date.now();

        console.log(`✅ LearningHistory updated: ${date}`);
    }

    /**
     * Streak (연속 학습일) 계산
     */
    updateStreak(userId) {
        // 완료된 날짜들을 수집
        const completedDates = new Set();

        this.v3Data.learningHistory
            .filter(h => h.userId === userId && h.totalHours > 0)
            .forEach(h => completedDates.add(h.date));

        if (completedDates.size === 0) {
            return { current: 0, longest: 0, lastStudyDate: null, totalDays: 0 };
        }

        // 날짜 정렬
        const sortedDates = Array.from(completedDates).sort();

        let currentStreak = 1;
        let longestStreak = 1;
        let lastDate = sortedDates[0];

        for (let i = 1; i < sortedDates.length; i++) {
            const diffDays = this.daysBetween(lastDate, sortedDates[i]);
            if (diffDays === 1) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
            lastDate = sortedDates[i];
        }

        const today = this.getTodayDate();
        const isStudyingToday = completedDates.has(today);
        const wasStudyingYesterday = completedDates.has(this.addDaysToDate(today, -1));

        // 오늘 학습했으면 현재 스트릭 유지, 아니면 0으로
        if (!isStudyingToday && !wasStudyingYesterday) {
            currentStreak = 0;
        }

        const streak = {
            current: currentStreak,
            longest: longestStreak,
            lastStudyDate: sortedDates[sortedDates.length - 1],
            totalDays: sortedDates.length
        };

        console.log(`✅ Streak updated:`, streak);
        this.emit('streakUpdated', streak);

        return streak;
    }

    /**
     * 취약 과목 식별
     */
    identifyWeakSubjects(planId) {
        const subjects = this.v3Data.subjects.filter(s => s.planId === planId);
        const weakSubjects = [];
        const strongSubjects = [];

        subjects.forEach(subject => {
            if (subject.averageMockScore > 0) {
                if (subject.averageMockScore < 60) {
                    weakSubjects.push({
                        id: subject.id,
                        name: subject.name,
                        score: subject.averageMockScore,
                        trend: subject.scoresTrend,
                        recommendation: this.generateSubjectRecommendation(subject)
                    });
                } else if (subject.averageMockScore >= 75) {
                    strongSubjects.push({
                        id: subject.id,
                        name: subject.name,
                        score: subject.averageMockScore
                    });
                }
            }
        });

        console.log(`📊 Weak subjects identified:`, weakSubjects);
        this.emit('weakSubjectsIdentified', { weakSubjects, strongSubjects });

        return { weakSubjects, strongSubjects };
    }

    /**
     * 과목별 추천사항 생성
     */
    generateSubjectRecommendation(subject) {
        const recommendations = [];

        if (subject.averageMockScore < 50) {
            recommendations.push('기초 개념 복습 필요');
        }

        if (subject.scoresTrend === 'down') {
            recommendations.push('최근 점수가 떨어지고 있습니다. 집중력을 높이세요');
        }

        if (subject.efficiency < 50) {
            recommendations.push('계획한 학습 시간이 부족합니다');
        }

        if (subject.rotations.filter(r => r).length < 3) {
            recommendations.push('기출 회독을 더 진행하세요');
        }

        return recommendations.length > 0
            ? recommendations.join('. ')
            : '좋은 진행 상태입니다. 현재 속도 유지하세요';
    }

    /**
     * 점수 추세 분석 (up/down/stable)
     */
    analyzeTrend(scores) {
        if (scores.length < 2) return 'stable';

        const recent = scores.slice(-3);  // 최근 3개
        const avg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
        const first = recent[0];

        if (avg > first + 5) return 'up';
        if (avg < first - 5) return 'down';
        return 'stable';
    }

    // ========================================================================
    // TimeBlock → StudyLog 변환
    // ========================================================================

    /**
     * TimeBlock에서 StudyLog 자동 생성
     */
    createStudyLogFromTimeBlock(timeBlock) {
        return {
            id: this.generateUUID(),
            userId: timeBlock.userId,
            timeBlockId: timeBlock.id,
            subjectId: timeBlock.subjectId,
            date: timeBlock.date,
            loggedAt: Date.now(),
            startTime: Date.now(),
            endTime: Date.now(),
            actualHours: timeBlock.plannedHours,
            completed: true,
            completionPercent: 100,
            focusLevel: 3,
            difficulty: timeBlock.difficulty,
            problems: {
                attempted: 0,
                correct: 0,
                accuracy: 0
            },
            notes: '',
            mistakes: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    // ========================================================================
    // 동기화 및 저장
    // ========================================================================

    /**
     * 동기화 예약 (Debounce)
     * - 빠른 연속 변경을 하나로 묶어서 저장
     */
    scheduleSync() {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.syncTimeout = setTimeout(() => {
            this.sync();
        }, 500);  // 500ms 후 저장
    }

    /**
     * 실제 동기화 실행
     */
    sync() {
        if (this.isSyncing) return;

        this.isSyncing = true;
        console.log('🔄 Synchronizing data...');

        try {
            // 1. 메타데이터 업데이트
            this.v3Data.metadata.lastSync = Date.now();
            const jsonStr = JSON.stringify(this.v3Data);
            this.v3Data.metadata.storageSize = new Blob([jsonStr]).size;

            // 2. localStorage에 저장
            localStorage.setItem('studyData.v3', jsonStr);
            console.log(`✅ Data synced (${(this.v3Data.metadata.storageSize / 1024).toFixed(2)}KB)`);

            // 3. 이벤트 발생
            this.emit('synced', {
                timestamp: Date.now(),
                size: this.v3Data.metadata.storageSize
            });

        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.emit('syncError', { error });
        } finally {
            this.isSyncing = false;
        }
    }

    // ========================================================================
    // 유틸리티 함수
    // ========================================================================

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    addDaysToDate(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getWeekStart(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        return monday.toISOString().split('T')[0];
    }

    // ========================================================================
    // 분석 함수
    // ========================================================================

    /**
     * 오늘 학습 효율성 계산
     */
    getTodayEfficiency() {
        const today = this.getTodayDate();
        const history = this.v3Data.indices.learningHistoryByDate[today];

        if (!history) {
            return { planned: 0, actual: 0, efficiency: 0 };
        }

        return {
            planned: history.plannedHours,
            actual: history.totalHours,
            efficiency: history.efficiency
        };
    }

    /**
     * 주간 통계
     */
    getWeeklyStats() {
        const today = new Date();
        const weekDates = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            weekDates.unshift(d.toISOString().split('T')[0]);
        }

        const stats = {
            dates: weekDates,
            hours: [],
            efficiency: []
        };

        weekDates.forEach(date => {
            const history = this.v3Data.indices.learningHistoryByDate[date];
            stats.hours.push(history ? history.totalHours : 0);
            stats.efficiency.push(history ? history.efficiency : 0);
        });

        return stats;
    }

    /**
     * 목표 진행 상황
     */
    getPlanProgress(planId) {
        const plan = this.v3Data.studyPlans.find(p => p.id === planId);
        if (!plan) return null;

        const subjects = this.v3Data.subjects.filter(s => s.planId === planId);
        const avgProgress = subjects.length > 0
            ? subjects.reduce((sum, s) => sum + s.progressPercent, 0) / subjects.length
            : 0;

        return {
            plan,
            overallProgress: avgProgress,
            subjectsProgress: subjects.map(s => ({
                id: s.id,
                name: s.name,
                progress: s.progressPercent,
                efficiency: s.efficiency,
                averageScore: s.averageMockScore
            }))
        };
    }
}

// ============================================================================
// 전역 네임스페이스에 내보내기
// ============================================================================

window.SyncManager = SyncManager;

console.log('✅ SyncManager Module loaded');
console.log('📋 Usage: const syncMgr = new SyncManager(v3Data);');
