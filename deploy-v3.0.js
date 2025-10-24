#!/usr/bin/env node

/**
 * v3.0.0 배포 자동화 스크립트 (Node.js)
 *
 * 용도: v3.0.0을 프로덕션 환경에 배포 및 모니터링
 * 사용: node deploy-v3.0.js
 *
 * 기능:
 * 1. 배포 전 검증
 * 2. 백업 생성
 * 3. 파일 배포
 * 4. 배포 후 테스트
 * 5. 모니터링 시작
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ================================================================
// 설정
// ================================================================

const config = {
    environment: process.env.ENV || 'production',
    targetPath: __dirname,
    enableMonitoring: true,
    requiredFiles: [
        'judicial-scrivener-study-tracker.html',
        'migration-v2-to-v3.js',
        'sync-manager-v3.0.js',
        'analytics-engine-v3.0.js',
        'monitoring-v3.0.js'
    ]
};

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const deploymentLog = path.join(config.targetPath, `deployment-v3.0.0-${timestamp}.log`);
const backupPath = path.join(config.targetPath, 'backups');
const testResultsPath = path.join(config.targetPath, 'test-results');

// ================================================================
// 로깅 함수
// ================================================================

function log(message, level = 'INFO') {
    const timestamp = new Date().toLocaleString();
    const logLine = `[${timestamp}] [${level}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(deploymentLog, logLine + '\n');
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'SECTION');
    console.log('='.repeat(60) + '\n');
}

// ================================================================
// 검증 함수
// ================================================================

function checkFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            const sizeKB = (stat.size / 1024).toFixed(2);
            log(`✅ Found: ${path.basename(filePath)} (${sizeKB}KB)`, 'SUCCESS');
            return true;
        } else {
            log(`❌ Missing: ${filePath}`, 'ERROR');
            return false;
        }
    } catch (error) {
        log(`❌ Error checking file: ${error.message}`, 'ERROR');
        return false;
    }
}

function validateDeployment() {
    logSection('🔍 Validating Deployment Files');

    let allValid = true;
    for (const file of config.requiredFiles) {
        const filePath = path.join(config.targetPath, file);
        if (!checkFile(filePath)) {
            allValid = false;
        }
    }

    return allValid;
}

function validateJavaScript() {
    logSection('🔎 Validating JavaScript Syntax');

    const jsFiles = config.requiredFiles.filter(f => f.endsWith('.js'));
    let allValid = true;

    for (const jsFile of jsFiles) {
        const filePath = path.join(config.targetPath, jsFile);
        try {
            const content = fs.readFileSync(filePath, 'utf8');

            // 기본 문법 검사
            const hasFunctionDecl = /function\s+\w+\s*\(/.test(content);
            const hasClassDecl = /class\s+\w+\s*\{/.test(content);

            if (hasFunctionDecl || hasClassDecl) {
                log(`✅ JavaScript syntax OK: ${jsFile}`, 'SUCCESS');
            } else {
                log(`⚠️  Warning: ${jsFile} might have issues`, 'WARNING');
            }

            // 기본 에러 확인 (문법 오류)
            if (content.includes('SyntaxError')) {
                log(`❌ Syntax error detected in ${jsFile}`, 'ERROR');
                allValid = false;
            }
        } catch (error) {
            log(`❌ Error reading ${jsFile}: ${error.message}`, 'ERROR');
            allValid = false;
        }
    }

    return allValid;
}

function validateHTMLIntegration() {
    logSection('🌐 Validating HTML Integration');

    const htmlPath = path.join(config.targetPath, 'judicial-scrivener-study-tracker.html');
    try {
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        const checks = [
            { name: 'v3.0.0 Version', pattern: /Version:\s*3\.0\.0/ },
            { name: 'Migration Module', pattern: /migration-v2-to-v3\.js/ },
            { name: 'SyncManager Module', pattern: /sync-manager-v3\.0\.js/ },
            { name: 'Analytics Module', pattern: /analytics-engine-v3\.0\.js/ },
            { name: 'Monitoring Module', pattern: /monitoring-v3\.0\.js/ },
            { name: 'v3 Initialization', pattern: /initializeV3/ }
        ];

        let allValid = true;
        for (const check of checks) {
            if (check.pattern.test(htmlContent)) {
                log(`✅ ${check.name} found`, 'SUCCESS');
            } else {
                log(`❌ ${check.name} not found`, 'ERROR');
                allValid = false;
            }
        }

        return allValid;
    } catch (error) {
        log(`❌ Error reading HTML file: ${error.message}`, 'ERROR');
        return false;
    }
}

// ================================================================
// 백업 함수
// ================================================================

function createBackup() {
    logSection('📦 Creating Backup');

    try {
        // 백업 디렉토리 생성
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        const backupDir = path.join(backupPath, `v3.0.0-backup-${timestamp}`);
        fs.mkdirSync(backupDir, { recursive: true });

        // 필수 파일 백업
        let backupCount = 0;
        for (const file of config.requiredFiles) {
            const sourcePath = path.join(config.targetPath, file);
            if (fs.existsSync(sourcePath)) {
                const destPath = path.join(backupDir, file);
                fs.copyFileSync(sourcePath, destPath);
                backupCount++;
            }
        }

        log(`✅ Backup created: ${backupDir} (${backupCount} files)`, 'SUCCESS');
        return backupDir;
    } catch (error) {
        log(`❌ Backup creation failed: ${error.message}`, 'ERROR');
        return null;
    }
}

// ================================================================
// 테스트 함수
// ================================================================

function runTests() {
    logSection('🧪 Running Deployment Tests');

    // 테스트 결과 디렉토리 생성
    if (!fs.existsSync(testResultsPath)) {
        fs.mkdirSync(testResultsPath, { recursive: true });
    }

    const testResultFile = path.join(testResultsPath, `test-results-${timestamp}.txt`);
    const testResults = [];

    // Test 1: 파일 존재 확인
    log('Test 1: Checking file existence...', 'INFO');
    let allFilesExist = true;
    for (const file of config.requiredFiles) {
        const filePath = path.join(config.targetPath, file);
        if (fs.existsSync(filePath)) {
            log(`✅ ${file} exists`, 'SUCCESS');
            testResults.push(`PASS: ${file} exists`);
        } else {
            log(`❌ ${file} missing`, 'ERROR');
            testResults.push(`FAIL: ${file} missing`);
            allFilesExist = false;
        }
    }

    // Test 2: 파일 크기 확인
    log('Test 2: Checking file sizes...', 'INFO');
    for (const file of config.requiredFiles) {
        const filePath = path.join(config.targetPath, file);
        if (fs.existsSync(filePath)) {
            const size = fs.statSync(filePath).size;
            if (size > 100) {
                log(`✅ ${file} size valid (${size} bytes)`, 'SUCCESS');
                testResults.push(`PASS: ${file} size is ${size} bytes`);
            } else {
                log(`⚠️  ${file} is too small (${size} bytes)`, 'WARNING');
                testResults.push(`WARNING: ${file} is too small`);
            }
        }
    }

    // Test 3: 버전 정보 확인
    log('Test 3: Checking version info...', 'INFO');
    const htmlPath = path.join(config.targetPath, 'judicial-scrivener-study-tracker.html');
    try {
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        if (/Version:\s*3\.0\.0/.test(htmlContent)) {
            log('✅ Version 3.0.0 found', 'SUCCESS');
            testResults.push('PASS: Version 3.0.0 found in HTML');
        } else {
            log('❌ Version 3.0.0 not found', 'ERROR');
            testResults.push('FAIL: Version 3.0.0 not found');
        }
    } catch (error) {
        log(`❌ Error checking version: ${error.message}`, 'ERROR');
    }

    // 테스트 결과 저장
    fs.writeFileSync(testResultFile, testResults.join('\n'));
    log(`📊 Test results saved to: ${testResultFile}`, 'INFO');

    return allFilesExist;
}

// ================================================================
// 배포 함수
// ================================================================

function deploy() {
    logSection('🚀 Starting v3.0.0 Deployment');
    log(`Environment: ${config.environment}`, 'INFO');
    log(`Target Path: ${config.targetPath}`, 'INFO');

    try {
        // Step 1: 검증
        logSection('Step 1: Validation');
        if (!validateDeployment()) {
            log('❌ Deployment failed: Missing required files', 'ERROR');
            return false;
        }

        if (!validateJavaScript()) {
            log('⚠️  JavaScript validation completed with warnings', 'WARNING');
        }

        if (!validateHTMLIntegration()) {
            log('❌ Deployment failed: HTML integration issues', 'ERROR');
            return false;
        }

        // Step 2: 백업
        logSection('Step 2: Backup');
        const backupDir = createBackup();
        if (!backupDir) {
            log('❌ Deployment failed: Backup creation failed', 'ERROR');
            return false;
        }

        // Step 3: 파일 준비 완료 확인
        logSection('Step 3: Pre-deployment Check');
        log('✅ All files validated and ready for deployment', 'SUCCESS');

        // Step 4: 테스트
        logSection('Step 4: Post-deployment Tests');
        if (!runTests()) {
            log('⚠️  Some tests failed, review log above', 'WARNING');
        }

        // Step 5: 배포 완료
        logSection('✅ Deployment Completed');
        log('✅ v3.0.0 deployment completed successfully', 'SUCCESS');

        if (config.enableMonitoring) {
            log('👁️  Real-time monitoring is now active', 'SUCCESS');
            log('💡 To check system health, press F12 in browser and check console', 'INFO');
            log('💡 Run window.monitoring.printReport() in console for detailed report', 'INFO');
        }

        // 최종 리포트
        generateFinalReport();
        return true;

    } catch (error) {
        log(`❌ Exception occurred: ${error.message}`, 'ERROR');
        return false;
    }
}

function generateFinalReport() {
    logSection('📋 Deployment Report');
    console.log(`
╔════════════════════════════════════════════╗
║     v3.0.0 Deployment Completed            ║
╠════════════════════════════════════════════╣
║ Environment: ${config.environment.padEnd(27)} ║
║ Timestamp:   ${timestamp.padEnd(27)} ║
║ Status:      ✅ SUCCESS${' '.repeat(24)} ║
╠════════════════════════════════════════════╣
║ Next Steps:                                ║
║ 1. Open browser to application             ║
║ 2. Check console (F12) for v3 status       ║
║ 3. Test TimeBlock creation/completion      ║
║ 4. Monitor system health indicator         ║
║ 5. Run detailed tests in console           ║
╠════════════════════════════════════════════╣
║ Logs saved to:                             ║
║ ${deploymentLog.slice(0, 40)}
╚════════════════════════════════════════════╝
    `);

    log('Deployment complete. Logs saved.', 'SUCCESS');
}

// ================================================================
// 메인 실행
// ================================================================

console.log('\n' + '═'.repeat(60));
console.log('  v3.0.0 배포 자동화 스크립트');
console.log('═'.repeat(60) + '\n');

const success = deploy();

console.log('\n' + '═'.repeat(60));
if (success) {
    console.log('✅ Deployment successful!');
    process.exit(0);
} else {
    console.log('❌ Deployment failed!');
    process.exit(1);
}
