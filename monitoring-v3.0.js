/**
 * 모니터링 및 로깅 시스템 (Monitoring & Logging)
 * v3.0.0 배포 후 실시간 모니터링
 *
 * 기능:
 * 1. 실시간 성능 모니터링 (로드 시간, 동기화 속도 등)
 * 2. 에러 추적 및 로그 수집
 * 3. 사용자 활동 추적
 * 4. 데이터 무결성 검증
 * 5. 메트릭 수집 및 리포팅
 */

class MonitoringSystem {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            migrationTime: 0,
            syncTimes: [],
            errors: [],
            events: [],
            userActions: [],
            dataChecks: [],
            startTime: Date.now()
        };

        this.config = {
            enableConsoleLogging: true,
            enableRemoteLogging: false,  // 나중에 서버 연동 시 활성화
            remoteLoggingUrl: '/api/logs',
            alertThresholds: {
                slowSync: 5000,        // 5초 이상 동기화
                highErrorRate: 0.05,   // 5% 이상 에러
                largeStorage: 10 * 1024 * 1024  // 10MB 이상
            }
        };

        this.setupGlobalErrorHandler();
        this.setupPerformanceMonitoring();
        console.log('✅ MonitoringSystem initialized');
    }

    // ========================================================================
    // 전역 에러 핸들러
    // ========================================================================

    setupGlobalErrorHandler() {
        // JavaScript 에러 캐치
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now()
            });
        });

        // Promise rejection 캐치
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'unhandledPromiseRejection',
                message: event.reason?.message || event.reason,
                stack: event.reason?.stack,
                timestamp: Date.now()
            });
        });

        console.log('✅ Global error handler setup completed');
    }

    // ========================================================================
    // 성능 모니터링
    // ========================================================================

    setupPerformanceMonitoring() {
        // 페이지 로드 시간 측정
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.metrics.pageLoadTime = Date.now() - this.metrics.startTime;
                console.log(`⏱️  Page load time: ${this.metrics.pageLoadTime}ms`);
            });
        } else {
            this.metrics.pageLoadTime = Date.now() - this.metrics.startTime;
        }

        // v3 초기화 시간 모니터링을 위해 후킹
        const originalInitializeV3 = window.initializeV3;
        if (originalInitializeV3) {
            window.initializeV3 = () => {
                const start = performance.now();
                const result = originalInitializeV3();
                const duration = performance.now() - start;

                this.metrics.migrationTime = duration;
                this.logMetric('v3.initialization', duration);
                console.log(`⏱️  v3.0.0 initialization time: ${duration.toFixed(2)}ms`);

                return result;
            };
        }
    }

    // ========================================================================
    // 동기화 모니터링
    // ========================================================================

    /**
     * 동기화 성능 모니터링
     */
    monitorSync(syncStart, syncEnd, syncData) {
        const duration = syncEnd - syncStart;
        this.metrics.syncTimes.push({
            timestamp: syncStart,
            duration: duration,
            size: syncData ? JSON.stringify(syncData).length : 0
        });

        // 느린 동기화 감지
        if (duration > this.config.alertThresholds.slowSync) {
            this.logWarning({
                type: 'slowSync',
                duration: duration,
                threshold: this.config.alertThresholds.slowSync,
                message: `⚠️ Slow synchronization detected: ${duration}ms`
            });
        }

        this.logMetric('sync.duration', duration);
        return {
            success: true,
            duration: duration,
            averageSyncTime: this.getAverageSyncTime()
        };
    }

    getAverageSyncTime() {
        if (this.metrics.syncTimes.length === 0) return 0;
        const total = this.metrics.syncTimes.reduce((sum, s) => sum + s.duration, 0);
        return total / this.metrics.syncTimes.length;
    }

    // ========================================================================
    // 에러 추적
    // ========================================================================

    /**
     * 에러 로깅
     */
    logError(errorData) {
        this.metrics.errors.push({
            ...errorData,
            timestamp: Date.now(),
            url: window.location.href
        });

        if (this.config.enableConsoleLogging) {
            console.error('❌ Error logged:', errorData);
        }

        // 에러율 체크
        this.checkErrorRate();

        // 원격 로깅 (필요시)
        if (this.config.enableRemoteLogging) {
            this.sendToRemote('error', errorData);
        }
    }

    /**
     * 경고 로깅
     */
    logWarning(warningData) {
        this.metrics.events.push({
            type: 'warning',
            ...warningData,
            timestamp: Date.now()
        });

        if (this.config.enableConsoleLogging) {
            console.warn('⚠️  Warning:', warningData);
        }
    }

    /**
     * 메트릭 로깅
     */
    logMetric(name, value) {
        this.metrics.events.push({
            type: 'metric',
            name: name,
            value: value,
            timestamp: Date.now()
        });
    }

    /**
     * 사용자 활동 추적
     */
    trackUserAction(action, details = {}) {
        this.metrics.userActions.push({
            action: action,
            details: details,
            timestamp: Date.now()
        });

        console.log(`📌 User action: ${action}`, details);
    }

    // ========================================================================
    // 데이터 무결성 검증
    // ========================================================================

    /**
     * v3 데이터 검증
     */
    validateV3Data(v3Data) {
        const issues = [];

        if (!v3Data) {
            issues.push('v3Data is null or undefined');
            return { valid: false, issues };
        }

        // 필수 필드 확인
        const requiredFields = [
            'user', 'metadata', 'studyPlans', 'subjects',
            'timeBlocks', 'studyLogs', 'mockExams', 'learningHistory'
        ];

        requiredFields.forEach(field => {
            if (!v3Data[field]) {
                issues.push(`Missing field: ${field}`);
            }
        });

        // 배열 검증
        if (!Array.isArray(v3Data.studyPlans)) issues.push('studyPlans is not an array');
        if (!Array.isArray(v3Data.subjects)) issues.push('subjects is not an array');
        if (!Array.isArray(v3Data.timeBlocks)) issues.push('timeBlocks is not an array');
        if (!Array.isArray(v3Data.studyLogs)) issues.push('studyLogs is not an array');

        // 저장소 크기 검증
        const size = JSON.stringify(v3Data).length;
        if (size > this.config.alertThresholds.largeStorage) {
            issues.push(`Storage size too large: ${(size / 1024 / 1024).toFixed(2)}MB`);
        }

        // 참조 무결성 검증
        v3Data.timeBlocks?.forEach((block, idx) => {
            if (block.userId && !v3Data.user) {
                issues.push(`TimeBlock[${idx}] references non-existent user`);
            }
        });

        const isValid = issues.length === 0;
        this.metrics.dataChecks.push({
            timestamp: Date.now(),
            valid: isValid,
            issues: issues,
            dataSize: size
        });

        return { valid: isValid, issues };
    }

    /**
     * 에러율 체크
     */
    checkErrorRate() {
        const recentWindow = 5 * 60 * 1000;  // 최근 5분
        const now = Date.now();
        const recentErrors = this.metrics.errors.filter(
            e => now - e.timestamp < recentWindow
        );

        const errorRate = recentErrors.length / 60;  // 분당 에러

        if (errorRate > this.config.alertThresholds.highErrorRate) {
            this.logWarning({
                type: 'highErrorRate',
                rate: errorRate,
                errors: recentErrors.length,
                message: `⚠️ High error rate detected: ${(errorRate * 100).toFixed(2)}% in last 5 minutes`
            });
        }
    }

    // ========================================================================
    // 리포팅
    // ========================================================================

    /**
     * 성능 리포트 생성
     */
    generatePerformanceReport() {
        const now = Date.now();
        const uptime = now - this.metrics.startTime;

        return {
            timestamp: now,
            uptime: `${(uptime / 1000 / 60).toFixed(2)}분`,
            pageLoadTime: `${this.metrics.pageLoadTime}ms`,
            v3InitTime: `${this.metrics.migrationTime.toFixed(2)}ms`,
            avgSyncTime: `${this.getAverageSyncTime().toFixed(2)}ms`,
            totalSyncs: this.metrics.syncTimes.length,
            totalErrors: this.metrics.errors.length,
            totalActions: this.metrics.userActions.length,
            lastDataCheck: this.getLastDataCheck(),
            health: this.calculateHealth()
        };
    }

    /**
     * 최근 데이터 체크 결과
     */
    getLastDataCheck() {
        if (this.metrics.dataChecks.length === 0) return null;
        const latest = this.metrics.dataChecks[this.metrics.dataChecks.length - 1];
        return {
            timestamp: new Date(latest.timestamp).toLocaleString(),
            valid: latest.valid,
            issues: latest.issues.length,
            dataSize: `${(latest.dataSize / 1024).toFixed(2)}KB`
        };
    }

    /**
     * 시스템 상태 계산
     */
    calculateHealth() {
        const errorScore = Math.max(0, 100 - (this.metrics.errors.length * 5));
        const performanceScore = this.getPerformanceScore();
        const dataScore = this.getDataIntegrityScore();

        const overall = (errorScore + performanceScore + dataScore) / 3;

        return {
            overall: Math.round(overall),
            error: Math.round(errorScore),
            performance: Math.round(performanceScore),
            data: Math.round(dataScore),
            status: overall > 80 ? '✅ Good' : overall > 50 ? '⚠️ Fair' : '❌ Poor'
        };
    }

    /**
     * 성능 점수 계산
     */
    getPerformanceScore() {
        const avgSyncTime = this.getAverageSyncTime();
        const threshold = this.config.alertThresholds.slowSync;

        if (avgSyncTime < threshold * 0.5) return 100;
        if (avgSyncTime < threshold) return 80;
        if (avgSyncTime < threshold * 2) return 60;
        return 40;
    }

    /**
     * 데이터 무결성 점수
     */
    getDataIntegrityScore() {
        if (this.metrics.dataChecks.length === 0) return 50;

        const validChecks = this.metrics.dataChecks.filter(c => c.valid).length;
        return (validChecks / this.metrics.dataChecks.length) * 100;
    }

    /**
     * 상세 리포트 생성
     */
    generateDetailedReport() {
        return {
            summary: {
                timestamp: new Date().toLocaleString(),
                systemHealth: this.calculateHealth(),
                uptime: this.metrics.startTime
            },
            performance: {
                pageLoadTime: this.metrics.pageLoadTime,
                v3InitTime: this.metrics.migrationTime,
                avgSyncTime: this.getAverageSyncTime(),
                totalSyncs: this.metrics.syncTimes.length,
                syncTimeSeries: this.metrics.syncTimes.slice(-10)  // 최근 10개
            },
            errors: {
                total: this.metrics.errors.length,
                recent: this.metrics.errors.slice(-5),
                byType: this.groupErrorsByType()
            },
            userActions: {
                total: this.metrics.userActions.length,
                recent: this.metrics.userActions.slice(-10),
                byAction: this.groupActionsByType()
            },
            dataHealth: {
                checks: this.metrics.dataChecks.length,
                valid: this.metrics.dataChecks.filter(c => c.valid).length,
                recent: this.metrics.dataChecks.slice(-3)
            }
        };
    }

    /**
     * 에러를 타입별로 그룹화
     */
    groupErrorsByType() {
        const grouped = {};
        this.metrics.errors.forEach(error => {
            const type = error.type || 'unknown';
            grouped[type] = (grouped[type] || 0) + 1;
        });
        return grouped;
    }

    /**
     * 액션을 타입별로 그룹화
     */
    groupActionsByType() {
        const grouped = {};
        this.metrics.userActions.forEach(action => {
            const type = action.action || 'unknown';
            grouped[type] = (grouped[type] || 0) + 1;
        });
        return grouped;
    }

    // ========================================================================
    // 원격 로깅 (향후 구현)
    // ========================================================================

    /**
     * 원격 서버로 로그 전송
     */
    sendToRemote(type, data) {
        if (!this.config.enableRemoteLogging) return;

        try {
            fetch(this.config.remoteLoggingUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: type,
                    data: data,
                    timestamp: Date.now(),
                    url: window.location.href
                })
            }).catch(err => {
                console.warn('Failed to send logs to remote:', err);
            });
        } catch (error) {
            console.error('Error sending to remote:', error);
        }
    }

    /**
     * 주기적으로 리포트 전송
     */
    startPeriodicReporting(interval = 5 * 60 * 1000) {  // 기본 5분
        setInterval(() => {
            const report = this.generatePerformanceReport();
            console.log('📊 Periodic Report:', report);

            if (this.config.enableRemoteLogging) {
                this.sendToRemote('periodicReport', report);
            }
        }, interval);
    }

    // ========================================================================
    // 콘솔 표시
    // ========================================================================

    /**
     * 콘솔에 리포트 출력
     */
    printReport() {
        const report = this.generatePerformanceReport();
        console.group('📊 v3.0.0 Performance Report');
        console.table(report);
        console.groupEnd();

        const detailed = this.generateDetailedReport();
        console.group('📋 Detailed Report');
        console.log(detailed);
        console.groupEnd();
    }

    /**
     * 시스템 헬스 체크 UI 생성
     */
    createHealthCheckUI() {
        const health = this.calculateHealth();
        const statusColor = health.overall > 80 ? '#34c759' : health.overall > 50 ? '#ff9500' : '#ff3b30';

        return `
        <div style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: 2px solid ${statusColor};
            border-radius: 12px;
            padding: 15px;
            font-family: monospace;
            font-size: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            max-width: 300px;
        ">
            <div style="font-weight: bold; margin-bottom: 10px;">
                🏥 System Health ${health.status}
            </div>
            <div style="margin-bottom: 8px;">
                Overall: <strong>${health.overall}/100</strong>
            </div>
            <div style="margin-bottom: 4px;">
                Errors: <strong>${this.metrics.errors.length}</strong>
            </div>
            <div style="margin-bottom: 4px;">
                Syncs: <strong>${this.metrics.syncTimes.length}</strong>
            </div>
            <div style="margin-bottom: 4px;">
                Avg Sync: <strong>${this.getAverageSyncTime().toFixed(0)}ms</strong>
            </div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc;">
                <button onclick="window.monitoring.printReport()" style="
                    background: ${statusColor};
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                ">상세 리포트</button>
            </div>
        </div>
        `;
    }
}

// ============================================================================
// 전역 인스턴스 생성
// ============================================================================

let monitoring = null;

// 페이지 로드 시 모니터링 시작
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        monitoring = new MonitoringSystem();
        console.log('✅ Monitoring system ready');
    });
} else {
    monitoring = new MonitoringSystem();
    console.log('✅ Monitoring system ready');
}

// 전역 네임스페이스에 노출
window.MonitoringSystem = MonitoringSystem;
window.monitoring = monitoring;

console.log('✅ Monitoring Module loaded');
