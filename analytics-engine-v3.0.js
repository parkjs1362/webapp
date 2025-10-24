/**
 * 학습 분석 엔진 (Analytics Engine)
 * v3.0.0 정규화 데이터 기반 학습 효율성 분석 및 지능형 권고
 *
 * 기능:
 * 1. 일일/주간/월간 학습 통계
 * 2. 학습 효율성 점수 계산
 * 3. 취약 과목 식별 및 개선 방안 제시
 * 4. 학습 패턴 분석
 * 5. 목표 대비 진행 상황 분석
 */

class AnalyticsEngine {
    constructor(v3Data) {
        this.v3Data = v3Data;
        this.benchmarks = this.initBenchmarks();
        console.log('✅ AnalyticsEngine initialized');
    }

    // ========================================================================
    // 벤치마크 설정
    // ========================================================================

    /**
     * 기본 벤치마크 (법시험 합격 기준)
     */
    initBenchmarks() {
        return {
            // 1차 시험
            '1차': {
                targetTotalHours: 1200,        // 1200시간 학습 목표
                dailyAverageHours: 5,          // 일일 5시간
                passingScore: 60,              // 합격선 60점
                subjectMinScore: 40,           // 과목별 최저선 40점
                minStudyDays: 200,             // 최소 200일 학습

                // 과목별 권장 시간
                subjectHours: {
                    '헌법': 120,
                    '민법': 180,
                    '상법': 100,
                    '민사집행법': 80,
                    '부동산등기법': 100,
                    '상업등기법': 80,
                    '공탁법': 80
                }
            },

            // 2차 시험
            '2차': {
                targetTotalHours: 600,
                dailyAverageHours: 4,
                passingScore: 70,
                subjectMinScore: 50,
                minStudyDays: 150,

                subjectHours: {
                    '민법 (2차)': 150,
                    '형법 (2차)': 100,
                    '형사소송법 (2차)': 80,
                    '민사소송법 (2차)': 100,
                    '민사사건서류작성 (2차)': 50,
                    '부동산등기법 (2차)': 80,
                    '등기신청서류작성 (2차)': 40
                }
            }
        };
    }

    // ========================================================================
    // 일일/주간/월간 분석
    // ========================================================================

    /**
     * 오늘 학습 분석
     */
    getTodayAnalysis() {
        const today = this.getTodayDate();
        const history = this.v3Data.indices.learningHistoryByDate[today];

        if (!history) {
            return {
                date: today,
                totalHours: 0,
                plannedHours: 0,
                efficiency: 0,
                subjects: [],
                status: 'not_started',
                status_emoji: '❌'
            };
        }

        const subjects = Object.entries(history.subjectBreakdown).map(([subjectId, data]) => ({
            subjectId,
            name: data.subject,
            hours: data.hours,
            blockCount: data.blockCount
        }));

        let status = 'not_started';
        let status_emoji = '❌';

        if (history.totalHours > 0) {
            if (history.efficiency >= 100) {
                status = 'exceeded';
                status_emoji = '🎉';
            } else if (history.efficiency >= 80) {
                status = 'good';
                status_emoji = '✅';
            } else if (history.efficiency >= 60) {
                status = 'fair';
                status_emoji = '⚠️';
            } else {
                status = 'insufficient';
                status_emoji = '📉';
            }
        }

        return {
            date: today,
            totalHours: history.totalHours,
            plannedHours: history.plannedHours,
            efficiency: history.efficiency,
            subjects,
            status,
            status_emoji,
            recommendation: this.generateTodayRecommendation(history)
        };
    }

    /**
     * 주간 학습 분석
     */
    getWeeklyAnalysis() {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));

        const weekDates = [];
        const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            weekDates.push({
                date: dateStr,
                day: dayNames[i],
                history: this.v3Data.indices.learningHistoryByDate[dateStr]
            });
        }

        const totalHours = weekDates.reduce((sum, d) => sum + (d.history?.totalHours || 0), 0);
        const plannedHours = weekDates.reduce((sum, d) => sum + (d.history?.plannedHours || 0), 0);
        const avgEfficiency = weekDates
            .filter(d => d.history)
            .reduce((sum, d) => sum + d.history.efficiency, 0) / weekDates.filter(d => d.history).length;

        const studyDays = weekDates.filter(d => d.history && d.history.totalHours > 0).length;

        return {
            weekStart: weekDates[0].date,
            weekEnd: weekDates[6].date,
            totalHours,
            plannedHours,
            avgEfficiency: isNaN(avgEfficiency) ? 0 : avgEfficiency,
            studyDays,
            dailyBreakdown: weekDates,
            benchmark: this.getBenchmarkComparison('weekly', totalHours)
        };
    }

    /**
     * 월간 학습 분석
     */
    getMonthlyAnalysis() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;

        const monthlyHistories = this.v3Data.learningHistory.filter(h =>
            h.monthOf === monthStr
        );

        const totalHours = monthlyHistories.reduce((sum, h) => sum + h.totalHours, 0);
        const plannedHours = monthlyHistories.reduce((sum, h) => sum + h.plannedHours, 0);
        const avgScore = monthlyHistories.length > 0
            ? monthlyHistories.reduce((sum, h) => sum + (h.averageScore || 0), 0) / monthlyHistories.length
            : 0;

        const subjectStats = {};
        monthlyHistories.forEach(history => {
            Object.entries(history.subjectBreakdown).forEach(([subjectId, data]) => {
                if (!subjectStats[subjectId]) {
                    subjectStats[subjectId] = {
                        subject: data.subject,
                        totalHours: 0,
                        blockCount: 0
                    };
                }
                subjectStats[subjectId].totalHours += data.hours;
                subjectStats[subjectId].blockCount += data.blockCount;
            });
        });

        return {
            month: monthStr,
            totalHours,
            plannedHours,
            efficiency: plannedHours > 0 ? (totalHours / plannedHours) * 100 : 0,
            avgScore,
            studyDays: monthlyHistories.filter(h => h.totalHours > 0).length,
            subjectStats: Object.values(subjectStats),
            benchmark: this.getBenchmarkComparison('monthly', totalHours)
        };
    }

    // ========================================================================
    // 효율성 점수 계산
    // ========================================================================

    /**
     * 종합 학습 효율성 점수 (0-100)
     *
     * 계산 요소:
     * - 계획 대비 실제 학습 시간 (40%)
     * - 과목별 진도율 (30%)
     * - 모의고사 점수 (20%)
     * - 학습 연속성 (10%)
     */
    getOverallEfficiencyScore() {
        const user = this.v3Data.user;
        const plan = this.v3Data.studyPlans[0];
        const subjects = this.v3Data.subjects.filter(s => s.planId === plan.id);

        // 1. 계획 대비 실제 학습 시간 (40%)
        const totalPlanned = subjects.reduce((sum, s) => sum + s.plannedHours, 0);
        const totalActual = subjects.reduce((sum, s) => sum + s.actualHours, 0);
        const timeEfficiency = Math.min(100, (totalActual / Math.max(totalPlanned, 1)) * 100);

        // 2. 과목별 진도율 (30%)
        const avgProgress = subjects.length > 0
            ? subjects.reduce((sum, s) => sum + s.progressPercent, 0) / subjects.length
            : 0;

        // 3. 모의고사 점수 (20%)
        let mockScore = 0;
        const mockExams = this.v3Data.mockExams.filter(e => e.planId === plan.id);
        if (mockExams.length > 0) {
            const avgMock = mockExams.reduce((sum, e) => sum + e.totalScore, 0) / mockExams.length;
            mockScore = Math.min(100, avgMock);
        }

        // 4. 학습 연속성 (10%) - Streak 기반
        const streak = this.v3Data.learningHistory
            .filter(h => h.userId === user.id && h.totalHours > 0)
            .length;
        const streakScore = Math.min(100, (streak / this.benchmarks[user.examType].minStudyDays) * 100);

        // 종합 점수
        const overallScore = (
            timeEfficiency * 0.4 +
            avgProgress * 0.3 +
            mockScore * 0.2 +
            streakScore * 0.1
        );

        return {
            overall: Math.round(overallScore),
            breakdown: {
                timeEfficiency: Math.round(timeEfficiency),
                progressRate: Math.round(avgProgress),
                mockScore: Math.round(mockScore),
                streakScore: Math.round(streakScore)
            },
            rating: this.scoreToRating(overallScore),
            benchmark: this.benchmarks[user.examType].passingScore
        };
    }

    /**
     * 점수를 평가 등급으로 변환
     */
    scoreToRating(score) {
        if (score >= 90) return { level: 'A+', emoji: '🌟', label: '우수' };
        if (score >= 80) return { level: 'A', emoji: '⭐', label: '좋음' };
        if (score >= 70) return { level: 'B+', emoji: '👍', label: '양호' };
        if (score >= 60) return { level: 'B', emoji: '📈', label: '보통' };
        if (score >= 50) return { level: 'C', emoji: '⚠️', label: '미흡' };
        return { level: 'F', emoji: '📉', label: '개선 필요' };
    }

    // ========================================================================
    // 취약 분야 분석
    // ========================================================================

    /**
     * 취약 과목 상세 분석
     */
    getWeakSubjectsAnalysis() {
        const plan = this.v3Data.studyPlans[0];
        const subjects = this.v3Data.subjects.filter(s => s.planId === plan.id);

        const analyzed = subjects.map(subject => {
            const issues = [];
            const severity = [];

            // Issue 1: 낮은 모의고사 점수
            if (subject.averageMockScore > 0 && subject.averageMockScore < 60) {
                issues.push('모의고사 점수 부족');
                severity.push('high');
            }

            // Issue 2: 점수 하락 추세
            if (subject.scoresTrend === 'down') {
                issues.push('최근 점수 하락세');
                severity.push('high');
            }

            // Issue 3: 낮은 학습 효율
            if (subject.efficiency > 0 && subject.efficiency < 50) {
                issues.push('학습 시간 부족');
                severity.push('medium');
            }

            // Issue 4: 회독 부족
            const completedRotations = subject.rotations.filter(r => r).length;
            if (completedRotations < 3) {
                issues.push(`${3 - completedRotations}회 회독 미완료`);
                severity.push('medium');
            }

            // Issue 5: 진도율 낮음
            if (subject.progressPercent < 50) {
                issues.push('진도율 50% 미만');
                severity.push('medium');
            }

            return {
                id: subject.id,
                name: subject.name,
                currentScore: subject.recentScore || 0,
                averageScore: subject.averageMockScore,
                efficiency: subject.efficiency,
                trend: subject.scoresTrend,
                issues,
                maxSeverity: severity.length > 0 ? severity[0] : 'low',
                totalIssues: issues.length,
                recommendations: this.generateSubjectImprovementPlan(subject, issues)
            };
        }).filter(s => s.totalIssues > 0)  // 문제가 있는 과목만
         .sort((a, b) => {
             const severityOrder = { high: 0, medium: 1, low: 2 };
             return severityOrder[a.maxSeverity] - severityOrder[b.maxSeverity];
         });

        return {
            totalWeakSubjects: analyzed.length,
            bySubject: analyzed,
            summary: this.summarizeWeakPoints(analyzed)
        };
    }

    /**
     * 과목별 개선 계획 생성
     */
    generateSubjectImprovementPlan(subject, issues) {
        const recommendations = [];
        const plan = this.v3Data.studyPlans[0];
        const benchmark = this.benchmarks[this.v3Data.user.examType];

        // 권고사항 1: 점수 부족
        if (subject.averageMockScore > 0 && subject.averageMockScore < 60) {
            const hoursNeeded = benchmark.subjectHours[subject.name] || 100;
            const currentHours = subject.actualHours;
            const additionalHours = hoursNeeded - currentHours;

            recommendations.push({
                priority: 'high',
                action: '기초 강화 학습',
                description: `${subject.name}은 모의고사 평균이 ${Math.round(subject.averageMockScore)}점입니다. 기출 기초 개념부터 다시 학습하세요.`,
                timeline: '2주',
                expectedImprovement: '+10~15점'
            });

            if (additionalHours > 0) {
                recommendations.push({
                    priority: 'high',
                    action: '학습 시간 증가',
                    description: `현재 ${currentHours.toFixed(1)}시간에서 ${hoursNeeded}시간으로 증가 필요 (${additionalHours.toFixed(1)}시간 추가)`,
                    timeline: '4주',
                    expectedImprovement: '점수 개선'
                });
            }
        }

        // 권고사항 2: 점수 하락
        if (subject.scoresTrend === 'down') {
            recommendations.push({
                priority: 'high',
                action: '학습 방식 변경',
                description: '최근 점수가 떨어지고 있습니다. 약점 문제를 집중적으로 반복하세요.',
                timeline: '1주',
                expectedImprovement: '점수 안정화'
            });
        }

        // 권고사항 3: 회독 부족
        const completedRotations = subject.rotations.filter(r => r).length;
        if (completedRotations < 3) {
            recommendations.push({
                priority: 'medium',
                action: `${3 - completedRotations}회 회독 진행`,
                description: `${completedRotations}회 완료, ${3 - completedRotations}회 추가 필요. 매 회독마다 5~10점 상승을 기대하세요.`,
                timeline: '3주',
                expectedImprovement: `${(3 - completedRotations) * 7}~${(3 - completedRotations) * 10}점`
            });
        }

        // 권고사항 4: 효율성 개선
        if (subject.efficiency > 0 && subject.efficiency < 70) {
            recommendations.push({
                priority: 'medium',
                action: '학습 효율성 개선',
                description: `계획 대비 ${Math.round(subject.efficiency)}% 학습 중. 집중력 있는 학습으로 효율을 80% 이상으로 높이세요.`,
                timeline: '지속',
                expectedImprovement: '학습 속도 향상'
            });
        }

        return recommendations.length > 0 ? recommendations : [{
            priority: 'low',
            action: '현재 상태 유지',
            description: '현재 진행 상황이 양호합니다. 계속 진행하세요.',
            timeline: '지속',
            expectedImprovement: '점수 상승 추세 유지'
        }];
    }

    /**
     * 취약점 요약
     */
    summarizeWeakPoints(weakSubjects) {
        const totalIssues = weakSubjects.reduce((sum, s) => sum + s.totalIssues, 0);
        const highSeverity = weakSubjects.filter(s => s.maxSeverity === 'high').length;
        const mediumSeverity = weakSubjects.filter(s => s.maxSeverity === 'medium').length;

        return {
            totalWeakSubjects: weakSubjects.length,
            totalIssues,
            highSeverity,
            mediumSeverity,
            summary: `${weakSubjects.length}개 과목에서 ${totalIssues}개 문제점 발견. 우선순위: ${highSeverity}개 (높음), ${mediumSeverity}개 (중간)`
        };
    }

    // ========================================================================
    // 학습 패턴 분석
    // ========================================================================

    /**
     * 과목별 학습 패턴 분석
     */
    getSubjectLearningPatterns() {
        const plan = this.v3Data.studyPlans[0];
        const subjects = this.v3Data.subjects.filter(s => s.planId === plan.id);

        const patterns = subjects.map(subject => {
            const relatedLogs = this.v3Data.studyLogs.filter(l => l.subjectId === subject.id);

            // 최근 학습 활동
            const recentLogs = relatedLogs.slice(-10);
            const lastStudy = recentLogs.length > 0 ? recentLogs[recentLogs.length - 1].date : null;

            // 평균 학습 시간
            const avgHoursPerSession = relatedLogs.length > 0
                ? relatedLogs.reduce((sum, l) => sum + l.actualHours, 0) / relatedLogs.length
                : 0;

            // 학습 빈도 (최근 7일)
            const recentWeek = new Date();
            recentWeek.setDate(recentWeek.getDate() - 7);
            const recentWeekStr = recentWeek.toISOString().split('T')[0];

            const weeklyLogs = relatedLogs.filter(l => l.date >= recentWeekStr);
            const studyFrequency = weeklyLogs.length;

            return {
                subjectId: subject.id,
                name: subject.name,
                totalSessions: relatedLogs.length,
                lastStudy,
                avgHoursPerSession: avgHoursPerSession.toFixed(1),
                recentWeekSessions: studyFrequency,
                estimatedCompletion: this.estimateCompletionDate(subject, relatedLogs),
                paceStatus: this.assessPace(subject, relatedLogs)
            };
        });

        return {
            bySubject: patterns.sort((a, b) => a.estimatedCompletion - b.estimatedCompletion)
        };
    }

    /**
     * 예상 완료 날짜 계산
     */
    estimateCompletionDate(subject, logs) {
        if (subject.progressPercent >= 100) {
            return { date: 'COMPLETED', days: 0, status: '✅ 완료' };
        }

        const remainingProblems = subject.totalProblems - subject.completedProblems;
        const avgProblemsPerSession = logs.length > 0
            ? logs.filter(l => l.problems.attempted > 0)
              .reduce((sum, l) => sum + l.problems.attempted, 0) / logs.length
            : 10;

        const sessionsNeeded = remainingProblems / Math.max(avgProblemsPerSession, 1);
        const daysNeeded = sessionsNeeded * 1.5;  // 2~3일에 1번 공부한다고 가정

        const estimatedDate = new Date();
        estimatedDate.setDate(estimatedDate.getDate() + daysNeeded);

        return {
            date: estimatedDate.toISOString().split('T')[0],
            days: Math.ceil(daysNeeded),
            status: `약 ${Math.ceil(daysNeeded)}일 소요`
        };
    }

    /**
     * 학습 속도 평가
     */
    assessPace(subject, logs) {
        const benchmark = this.benchmarks[this.v3Data.user.examType];
        const targetHours = benchmark.subjectHours[subject.name] || 100;

        const progress = subject.actualHours / targetHours * 100;
        const daysStudied = logs.length > 0
            ? new Set(logs.map(l => l.date)).size
            : 0;
        const dailyPace = daysStudied > 0 ? subject.actualHours / daysStudied : 0;

        if (progress > 120) return '🎯 목표 초과 달성';
        if (progress > 100) return '✅ 목표 달성';
        if (progress > 80) return '👍 양호한 속도';
        if (progress > 60) return '📈 개선 필요';
        return '⚠️ 가속 필요';
    }

    // ========================================================================
    // 벤치마크 비교
    // ========================================================================

    /**
     * 벤치마크와 비교
     */
    getBenchmarkComparison(period, actualHours) {
        const user = this.v3Data.user;
        const benchmark = this.benchmarks[user.examType];

        let targetHours = 0;
        let periodLabel = '';

        if (period === 'daily') {
            targetHours = benchmark.dailyAverageHours;
            periodLabel = '일일';
        } else if (period === 'weekly') {
            targetHours = benchmark.dailyAverageHours * 7;
            periodLabel = '주간';
        } else if (period === 'monthly') {
            targetHours = benchmark.dailyAverageHours * 30;
            periodLabel = '월간';
        }

        const ratio = (actualHours / targetHours) * 100;
        const status = ratio >= 100 ? '✅ 목표 달성' : '📈 목표 미달';

        return {
            period: periodLabel,
            target: targetHours,
            actual: actualHours,
            ratio: ratio.toFixed(1),
            status
        };
    }

    // ========================================================================
    // 종합 권고사항 생성
    // ========================================================================

    /**
     * 오늘 학습 권고사항
     */
    generateTodayRecommendation(history) {
        if (history.totalHours === 0) {
            return '오늘 아직 학습하지 않았습니다. 지금 바로 시작하세요! 💪';
        }

        const efficiency = history.efficiency;

        if (efficiency >= 100) {
            return `🎉 목표를 초과 달성했습니다! 오늘도 수고하셨어요.`;
        } else if (efficiency >= 80) {
            return `✅ 오늘 계획을 잘 따르셨습니다! 이 속도로 계속하세요.`;
        } else if (efficiency >= 60) {
            return `⚠️ 약간의 부족함이 있습니다. 내일은 더 많은 시간을 할애하세요.`;
        } else if (efficiency > 0) {
            return `📉 오늘 학습 시간이 많이 부족합니다. 내일은 더 집중하세요.`;
        }

        return '학습을 계속하세요. 매일의 작은 노력이 모여 큰 성과가 됩니다! 💪';
    }

    /**
     * 종합 권고사항 리포트
     */
    generateComprehensiveReport() {
        const efficiencyScore = this.getOverallEfficiencyScore();
        const weakAnalysis = this.getWeakSubjectsAnalysis();
        const patterns = this.getSubjectLearningPatterns();
        const todayAnalysis = this.getTodayAnalysis();
        const weeklyAnalysis = this.getWeeklyAnalysis();

        const recommendations = [];

        // 1순위: 효율성 점수가 낮으면
        if (efficiencyScore.overall < 60) {
            recommendations.push({
                priority: 1,
                title: '전반적 학습 효율 개선',
                description: `현재 효율성 점수가 ${efficiencyScore.overall}점입니다. 학습 방식을 재검토하고 집중력을 높이세요.`,
                actions: [
                    '매일 정해진 시간에 학습하기',
                    '한 과목씩 심화 학습하기',
                    '틀린 문제 반복하기'
                ]
            });
        }

        // 2순위: 취약 과목 개선
        if (weakAnalysis.totalWeakSubjects > 0) {
            recommendations.push({
                priority: 2,
                title: `${weakAnalysis.totalWeakSubjects}개 과목 집중 개선`,
                description: weakAnalysis.summary.summary,
                actions: weakAnalysis.bySubject
                    .slice(0, 3)
                    .map(s => `${s.name}: ${s.issues.join(', ')}`)
            });
        }

        // 3순위: 학습 패턴 개선
        const inactiveSubjects = patterns.bySubject
            .filter(p => p.estimatedCompletion.days > 100)
            .slice(0, 2);

        if (inactiveSubjects.length > 0) {
            recommendations.push({
                priority: 3,
                title: '미진행 과목 학습 시작',
                description: `${inactiveSubjects.map(s => s.name).join(', ')}의 학습 진도가 느립니다.`,
                actions: inactiveSubjects.map(s =>
                    `${s.name}: 주 3일 이상 학습 시작 (예상 완료: ${s.estimatedCompletion.days}일)`
                )
            });
        }

        // 4순위: 목표 달성 추진
        if (weeklyAnalysis.studyDays < 5) {
            recommendations.push({
                priority: 4,
                title: '학습 일관성 확보',
                description: `최근 주간 학습일이 ${weeklyAnalysis.studyDays}일입니다. 주 6일 이상 학습하세요.`,
                actions: [
                    '주간 학습 계획 세우기',
                    '일일 최소 학습 시간 정하기',
                    '학습 달력 작성하기'
                ]
            });
        }

        return {
            date: this.getTodayDate(),
            efficiencyScore,
            recommendations: recommendations.sort((a, b) => a.priority - b.priority),
            nextMilestone: this.calculateNextMilestone()
        };
    }

    /**
     * 다음 마일스톤 계산
     */
    calculateNextMilestone() {
        const user = this.v3Data.user;
        const plan = this.v3Data.studyPlans[0];
        const subjects = this.v3Data.subjects.filter(s => s.planId === plan.id);

        const totalHours = subjects.reduce((sum, s) => sum + s.actualHours, 0);
        const targetHours = this.benchmarks[user.examType].targetTotalHours;

        const milestoneLevels = [250, 500, 750, 1000, 1200];
        const nextMilestone = milestoneLevels.find(level => level > totalHours);

        if (!nextMilestone) {
            return {
                milestone: targetHours,
                current: totalHours,
                remaining: 0,
                daysNeeded: 0,
                status: '🎯 목표 달성!'
            };
        }

        const remaining = nextMilestone - totalHours;
        const dailyAvg = this.getAverageDailyHours();
        const daysNeeded = dailyAvg > 0 ? Math.ceil(remaining / dailyAvg) : 0;

        return {
            milestone: nextMilestone,
            current: totalHours,
            remaining: remaining.toFixed(1),
            daysNeeded,
            status: `${nextMilestone}시간까지 ${remaining.toFixed(1)}시간 남음 (약 ${daysNeeded}일)`
        };
    }

    /**
     * 일일 평균 학습 시간
     */
    getAverageDailyHours() {
        const user = this.v3Data.user;
        const histories = this.v3Data.learningHistory.filter(h =>
            h.userId === user.id && h.totalHours > 0
        );

        if (histories.length === 0) return 0;

        const totalHours = histories.reduce((sum, h) => sum + h.totalHours, 0);
        return totalHours / histories.length;
    }

    // ========================================================================
    // 유틸리티
    // ========================================================================

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }
}

// ============================================================================
// 전역 네임스페이스에 내보내기
// ============================================================================

window.AnalyticsEngine = AnalyticsEngine;

console.log('✅ AnalyticsEngine Module loaded');
console.log('📋 Usage: const analytics = new AnalyticsEngine(v3Data);');
