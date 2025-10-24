/**
 * 데이터 마이그레이션 스크립트
 * v2.14.0 → v3.0.0 정규화 스키마로 변환
 *
 * 사용법:
 * 1. HTML 파일 <script> 부분에서 이 파일을 로드
 * 2. migrateDataV2ToV3() 호출
 */

// ============================================================================
// Utility 함수들
// ============================================================================

/**
 * UUID 생성
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 오늘 날짜 (YYYY-MM-DD 형식)
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 날짜 계산
 */
function addDaysToDate(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

/**
 * 두 날짜 사이의 일 수 계산
 */
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================================================
// v3.0.0 Entity 정의
// ============================================================================

/**
 * User Entity 생성
 */
function createUser(oldData) {
    return {
        id: generateUUID(),
        name: 'Learner',  // 기본값
        email: '',
        examType: oldData.examType || '1차',
        startDate: getTodayDate(),
        targetDate: null,
        theme: localStorage.getItem('theme') || 'light',
        language: 'ko',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLoginAt: Date.now(),
        version: '3.0.0'
    };
}

/**
 * StudyPlan Entity 생성
 */
function createStudyPlan(user) {
    const today = getTodayDate();
    const endDate = addDaysToDate(today, 180);  // 6개월 계획

    return {
        id: generateUUID(),
        userId: user.id,
        title: user.examType + ' 시험 합격 전략',
        description: `${user.examType} 합격을 위한 체계적인 학습 계획`,
        startDate: today,
        endDate: endDate,
        daysRemaining: 180,
        targetHours: user.examType === '1차' ? 1200 : 500,
        targetScore: 70,
        subjectTargets: {},  // 나중에 채워짐
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

/**
 * Subjects Entity 배열 생성 (v2 subjects에서)
 */
function createSubjects(oldSubjectsArray, user, plan) {
    return oldSubjectsArray.map((oldSubj, idx) => ({
        id: generateUUID(),
        name: oldSubj.name,
        examType: user.examType,
        order: idx,
        totalProblems: oldSubj.total || 0,
        completedProblems: oldSubj.completed || 0,
        progressPercent: oldSubj.total > 0 ? (oldSubj.completed / oldSubj.total) * 100 : 0,
        plannedHours: 0,  // 나중에 계산됨
        actualHours: 0,   // 나중에 계산됨
        efficiency: 0,    // 나중에 계산됨
        rotations: oldSubj.rotations || [false, false, false, false, false, false, false],
        averageMockScore: 0,  // 나중에 계산됨
        recentScore: null,
        scoresTrend: 'stable',
        status: oldSubj.completed === 0 ? 'not_started' : 'in_progress',
        userId: user.id,
        planId: plan.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
    }));
}

/**
 * Subject ID를 이름으로 찾기
 */
function findSubjectIdByName(name, subjects) {
    const subject = subjects.find(s => s.name === name);
    return subject ? subject.id : null;
}

/**
 * TimeBlocks 변환 (date 필드 확인 및 ID 추가)
 */
function convertTimeBlocks(oldTimeBlocks, user, plan, subjects) {
    return oldTimeBlocks.map((oldBlock) => {
        // ID 확인 (v2.14.0에서 ID가 없을 수 있음)
        const id = oldBlock.id || generateUUID();

        // date 필드 확인 (v2.14.0에서 추가됨)
        const date = oldBlock.date || getTodayDate();

        const subjectId = findSubjectIdByName(oldBlock.subject, subjects);

        return {
            id: id,
            userId: user.id,
            planId: plan.id,
            subjectId: subjectId,
            date: date,
            timeSlot: {
                startTime: oldBlock.time ? oldBlock.time.split('-')[0] : '00:00',
                endTime: oldBlock.time ? oldBlock.time.split('-')[1] : '01:00',
                duration: oldBlock.hours || oldBlock.duration || 1
            },
            topic: oldBlock.detail || '',
            difficulty: 'medium',  // 기본값
            resources: [],
            plannedHours: oldBlock.hours || oldBlock.duration || 1,
            status: oldBlock.completed ? 'completed' : 'planned',
            completed: oldBlock.completed || false,
            completedAt: oldBlock.completed ? Date.now() : null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    });
}

/**
 * StudyLogs 생성 (완료된 TimeBlocks에서)
 */
function createStudyLogs(timeBlocks, user) {
    return timeBlocks
        .filter(block => block.completed)
        .map(block => ({
            id: generateUUID(),
            userId: user.id,
            timeBlockId: block.id,
            subjectId: block.subjectId,
            date: block.date,
            loggedAt: block.completedAt || Date.now(),
            startTime: Date.now(),  // 정확한 시간은 모르므로 기본값
            endTime: Date.now(),
            actualHours: block.plannedHours,
            completed: true,
            completionPercent: 100,
            focusLevel: 3,  // 기본값
            difficulty: block.difficulty,
            problems: {
                attempted: 0,
                correct: 0,
                accuracy: 0
            },
            notes: '',
            mistakes: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        }));
}

/**
 * MockExams 변환
 */
function convertMockExams(oldMockScores, user, plan, subjects) {
    return oldMockScores.map((oldScore) => ({
        id: generateUUID(),
        userId: user.id,
        planId: plan.id,
        examType: oldScore.examType || '1차',
        examName: oldScore.memo || `${oldScore.examType} 모의고사`,
        examDate: oldScore.date,
        scores: {
            overall: {
                subject: '전체',
                score: oldScore.score,
                maxScore: 100
            }
        },
        totalScore: oldScore.score,
        maxTotalScore: 100,
        percentile: 0,  // 계산할 수 없음
        passingScore: 60,
        isPassed: oldScore.score >= 60,
        analysis: {
            strongSubjects: [],
            weakSubjects: [],
            improvements: {}
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
    }));
}

/**
 * LearningHistory 생성
 */
function createLearningHistory(user, plan, timeBlocks, mockExams) {
    const history = {};

    // timeBlocks 기반으로 날별 이력 생성
    timeBlocks.forEach(block => {
        if (!history[block.date]) {
            history[block.date] = {
                id: generateUUID(),
                userId: user.id,
                planId: plan.id,
                date: block.date,
                weekOf: getWeekStart(block.date),
                monthOf: block.date.substring(0, 7),
                totalHours: 0,
                plannedHours: 0,
                efficiency: 0,
                subjectBreakdown: {},
                problemsSolved: 0,
                accuracy: 0,
                streak: {
                    current: 0,
                    longest: 0
                },
                averageScore: 0,
                notes: '',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }

        // 시간 누적
        history[block.date].plannedHours += block.plannedHours;
        if (block.completed) {
            history[block.date].totalHours += block.plannedHours;
        }

        // 과목별 분석
        if (block.subjectId) {
            if (!history[block.date].subjectBreakdown[block.subjectId]) {
                history[block.date].subjectBreakdown[block.subjectId] = {
                    subject: block.id,  // subject name
                    hours: 0,
                    blockCount: 0
                };
            }
            history[block.date].subjectBreakdown[block.subjectId].hours += block.plannedHours;
            history[block.date].subjectBreakdown[block.subjectId].blockCount += 1;
        }
    });

    // mockExams 기반으로 평균 점수 추가
    mockExams.forEach(exam => {
        if (history[exam.examDate]) {
            history[exam.examDate].averageScore = exam.totalScore;
        }
    });

    // 효율성 계산
    Object.keys(history).forEach(date => {
        const record = history[date];
        if (record.plannedHours > 0) {
            record.efficiency = (record.totalHours / record.plannedHours) * 100;
        }
    });

    return Object.values(history);
}

/**
 * 주의 첫 번째 날짜 계산
 */
function getWeekStart(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
}

/**
 * Streak 계산
 */
function calculateStreak(user, timeBlocks) {
    const completedDates = new Set();

    timeBlocks.forEach(block => {
        if (block.completed) {
            completedDates.add(block.date);
        }
    });

    if (completedDates.size === 0) {
        return {
            current: 0,
            longest: 0,
            lastStudyDate: null,
            totalDays: 0
        };
    }

    // 날짜 배열 정렬
    const sortedDates = Array.from(completedDates).sort();

    let currentStreak = 1;
    let longestStreak = 1;
    let lastDate = sortedDates[0];

    for (let i = 1; i < sortedDates.length; i++) {
        const diffDays = daysBetween(lastDate, sortedDates[i]);
        if (diffDays === 1) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 1;
        }
        lastDate = sortedDates[i];
    }

    return {
        current: currentStreak,
        longest: longestStreak,
        lastStudyDate: sortedDates[sortedDates.length - 1],
        totalDays: sortedDates.length
    };
}

// ============================================================================
// 메인 마이그레이션 함수
// ============================================================================

/**
 * v2.14.0 → v3.0.0 마이그레이션 실행
 *
 * @param {Object} oldData - v2.14.0 형식의 studyData 객체
 * @returns {Object} v3.0.0 형식의 정규화된 데이터
 */
function migrateDataV2ToV3(oldData) {
    console.log('🔄 Starting migration: v2.14.0 → v3.0.0');
    console.log('📊 Old data:', oldData);

    try {
        // Step 1: User 생성
        const user = createUser(oldData);
        console.log('✅ User created:', user.id);

        // Step 2: StudyPlan 생성
        const plan = createStudyPlan(user);
        console.log('✅ StudyPlan created:', plan.id);

        // Step 3: Subjects 생성
        const examSubjects = oldData.examType === '2차'
            ? oldData.subjects2nd
            : oldData.subjects1st;

        const subjects = createSubjects(examSubjects, user, plan);
        console.log(`✅ ${subjects.length} Subjects created`);

        // Step 4: TimeBlocks 변환
        const timeBlocks = convertTimeBlocks(
            oldData.timeBlocks || [],
            user,
            plan,
            subjects
        );
        console.log(`✅ ${timeBlocks.length} TimeBlocks converted`);

        // Step 5: StudyLogs 생성
        const studyLogs = createStudyLogs(timeBlocks, user);
        console.log(`✅ ${studyLogs.length} StudyLogs created`);

        // Step 6: MockExams 변환
        const mockExams = convertMockExams(
            oldData.mockScores || [],
            user,
            plan,
            subjects
        );
        console.log(`✅ ${mockExams.length} MockExams converted`);

        // Step 7: LearningHistory 생성
        const learningHistory = createLearningHistory(
            user,
            plan,
            timeBlocks,
            mockExams
        );
        console.log(`✅ ${learningHistory.length} LearningHistory records created`);

        // Step 8: 정규화된 데이터 구조 생성
        const v3Data = {
            // 메타정보
            metadata: {
                version: '3.0.0',
                migratedFrom: '2.14.0',
                migratedAt: new Date().toISOString(),
                lastSync: Date.now(),
                storageSize: 0  // 계산됨
            },

            // 기본 Entity
            user: user,
            studyPlans: [plan],
            subjects: subjects,
            timeBlocks: timeBlocks,
            studyLogs: studyLogs,
            mockExams: mockExams,
            learningHistory: learningHistory,

            // 편의 인덱스 (쿼리 성능 향상)
            indices: {
                subjectsById: {},
                timeBlocksById: {},
                studyLogsById: {},
                studyLogsByDate: {},
                learningHistoryByDate: {}
            }
        };

        // 인덱스 생성
        subjects.forEach(s => v3Data.indices.subjectsById[s.id] = s);
        timeBlocks.forEach(b => v3Data.indices.timeBlocksById[b.id] = b);
        studyLogs.forEach(l => {
            v3Data.indices.studyLogsById[l.id] = l;
            if (!v3Data.indices.studyLogsByDate[l.date]) {
                v3Data.indices.studyLogsByDate[l.date] = [];
            }
            v3Data.indices.studyLogsByDate[l.date].push(l);
        });
        learningHistory.forEach(h => v3Data.indices.learningHistoryByDate[h.date] = h);

        // 저장소 크기 계산
        const jsonStr = JSON.stringify(v3Data);
        v3Data.metadata.storageSize = new Blob([jsonStr]).size;

        console.log('✅ Migration completed successfully!');
        console.log('📊 v3.0.0 data structure:', v3Data);
        console.log(`💾 Storage size: ${(v3Data.metadata.storageSize / 1024).toFixed(2)}KB`);

        return v3Data;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// ============================================================================
// localStorage 저장 및 로드 함수
// ============================================================================

/**
 * v3.0.0 데이터를 localStorage에 저장
 */
function saveV3Data(v3Data) {
    try {
        localStorage.setItem('studyData.v3', JSON.stringify(v3Data));
        console.log('✅ v3.0.0 data saved to localStorage');

        // v2.14.0 데이터 백업
        const oldData = localStorage.getItem('studyData');
        if (oldData) {
            localStorage.setItem('studyData.v2-backup', oldData);
            console.log('✅ v2.14.0 data backed up as studyData.v2-backup');
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to save v3.0.0 data:', error);
        return false;
    }
}

/**
 * localStorage에서 v3.0.0 데이터 로드
 */
function loadV3Data() {
    try {
        const v3DataStr = localStorage.getItem('studyData.v3');
        if (!v3DataStr) {
            console.warn('⚠️ No v3.0.0 data found in localStorage');
            return null;
        }

        const v3Data = JSON.parse(v3DataStr);
        console.log('✅ v3.0.0 data loaded from localStorage');
        return v3Data;

    } catch (error) {
        console.error('❌ Failed to load v3.0.0 data:', error);
        return null;
    }
}

/**
 * 자동 마이그레이션 (v2.14.0 → v3.0.0)
 * - 기존 v2.14.0 데이터가 있으면 자동으로 변환
 * - 이미 v3.0.0으로 변환되어 있으면 로드만 함
 */
function autoMigrateIfNeeded() {
    // 1. 이미 v3.0.0 데이터가 있는지 확인
    let v3Data = loadV3Data();
    if (v3Data) {
        console.log('✅ v3.0.0 data already exists, skipping migration');
        return v3Data;
    }

    // 2. v2.14.0 데이터가 있는지 확인
    const oldDataStr = localStorage.getItem('studyData');
    if (!oldDataStr) {
        console.log('ℹ️ No data found, creating new v3.0.0 structure');
        // 새로운 사용자, 빈 데이터로 시작
        return createEmptyV3Data();
    }

    // 3. v2.14.0 → v3.0.0 마이그레이션 실행
    try {
        const oldData = JSON.parse(oldDataStr);
        v3Data = migrateDataV2ToV3(oldData);
        saveV3Data(v3Data);
        console.log('✅ Auto migration completed successfully');
        return v3Data;
    } catch (error) {
        console.error('❌ Auto migration failed:', error);
        console.log('💡 Attempting to roll back to v2.14.0 data');

        // 롤백: 기존 v2.14.0 데이터 유지
        return null;
    }
}

/**
 * 빈 v3.0.0 데이터 구조 생성
 */
function createEmptyV3Data() {
    const user = {
        id: generateUUID(),
        name: 'Learner',
        email: '',
        examType: '1차',
        startDate: getTodayDate(),
        targetDate: null,
        theme: 'light',
        language: 'ko',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLoginAt: Date.now(),
        version: '3.0.0'
    };

    return {
        metadata: {
            version: '3.0.0',
            migratedFrom: 'new',
            migratedAt: new Date().toISOString(),
            lastSync: Date.now(),
            storageSize: 0
        },
        user: user,
        studyPlans: [],
        subjects: [],
        timeBlocks: [],
        studyLogs: [],
        mockExams: [],
        learningHistory: [],
        indices: {
            subjectsById: {},
            timeBlocksById: {},
            studyLogsById: {},
            studyLogsByDate: {},
            learningHistoryByDate: {}
        }
    };
}

// ============================================================================
// 데이터 검증 함수
// ============================================================================

/**
 * v3.0.0 데이터의 무결성 검증
 */
function validateV3Data(v3Data) {
    const errors = [];
    const warnings = [];

    // 필수 필드 확인
    if (!v3Data.user) errors.push('Missing user');
    if (!v3Data.metadata) errors.push('Missing metadata');
    if (!Array.isArray(v3Data.studyPlans)) errors.push('studyPlans is not an array');
    if (!Array.isArray(v3Data.subjects)) errors.push('subjects is not an array');
    if (!Array.isArray(v3Data.timeBlocks)) errors.push('timeBlocks is not an array');
    if (!Array.isArray(v3Data.studyLogs)) errors.push('studyLogs is not an array');
    if (!Array.isArray(v3Data.mockExams)) errors.push('mockExams is not an array');
    if (!Array.isArray(v3Data.learningHistory)) errors.push('learningHistory is not an array');

    // 데이터 일관성 확인
    if (v3Data.studyPlans.length === 0) {
        warnings.push('No study plans found');
    }

    if (v3Data.subjects.length === 0) {
        warnings.push('No subjects found');
    }

    if (v3Data.timeBlocks.length === 0) {
        warnings.push('No time blocks found');
    }

    // 참조 무결성 확인
    v3Data.timeBlocks.forEach((block, idx) => {
        if (block.userId && block.userId !== v3Data.user.id) {
            warnings.push(`timeBlock[${idx}] has different userId`);
        }
    });

    v3Data.studyLogs.forEach((log, idx) => {
        if (!v3Data.indices.timeBlocksById[log.timeBlockId]) {
            warnings.push(`studyLog[${idx}] references non-existent timeBlock: ${log.timeBlockId}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}

// ============================================================================
// 내보내기 (HTML에서 사용 가능하도록)
// ============================================================================

// 전역 네임스페이스에 함수 추가
window.DataMigration = {
    migrate: migrateDataV2ToV3,
    save: saveV3Data,
    load: loadV3Data,
    autoMigrate: autoMigrateIfNeeded,
    validate: validateV3Data,
    createEmpty: createEmptyV3Data
};

console.log('✅ Data Migration Module loaded');
console.log('📋 Usage: window.DataMigration.autoMigrate()');
