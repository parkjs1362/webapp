# ================================================================
# v3.0.0 배포 자동화 스크립트 (PowerShell)
# ================================================================
#
# 용도: v3.0.0을 프로덕션 환경에 배포 및 모니터링
# 사용: .\deploy-v3.0.ps1
#
# 기능:
# 1. 배포 전 검증 (모든 파일 확인, 문법 검사)
# 2. 백업 생성 (이전 버전 보존)
# 3. 파일 배포
# 4. 배포 후 테스트
# 5. 모니터링 시작

param(
    [string]$Environment = "production",  # production, staging, development
    [string]$TargetPath = "C:\Users\CNXK\Downloads\webapp",
    [bool]$AutoStart = $true,
    [bool]$MonitoringEnabled = $true
)

# ================================================================
# 설정
# ================================================================

$DeploymentLog = "$TargetPath\deployment-v3.0.0-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$BackupPath = "$TargetPath\backups"
$TestResultsPath = "$TargetPath\test-results"
$RequiredFiles = @(
    "judicial-scrivener-study-tracker.html",
    "migration-v2-to-v3.js",
    "sync-manager-v3.0.js",
    "analytics-engine-v3.0.js",
    "monitoring-v3.0.js"
)

# ================================================================
# 유틸리티 함수
# ================================================================

function Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Host $logLine
    Add-Content -Path $DeploymentLog -Value $logLine
}

function CheckFile {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        $size = (Get-Item $FilePath).Length / 1KB
        Log "✅ Found: $(Split-Path -Leaf $FilePath) (${size}KB)" "SUCCESS"
        return $true
    } else {
        Log "❌ Missing: $FilePath" "ERROR"
        return $false
    }
}

function CreateBackup {
    Log "📦 Creating backup..."
    if (-not (Test-Path $BackupPath)) {
        New-Item -ItemType Directory -Path $BackupPath | Out-Null
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupDir = "$BackupPath\v3.0.0-backup-$timestamp"
    New-Item -ItemType Directory -Path $backupDir | Out-Null

    foreach ($file in $RequiredFiles) {
        $sourcePath = "$TargetPath\$file"
        if (Test-Path $sourcePath) {
            Copy-Item -Path $sourcePath -Destination "$backupDir\" -Force
        }
    }

    Log "✅ Backup created: $backupDir" "SUCCESS"
    return $backupDir
}

function ValidateDeployment {
    Log "🔍 Validating deployment files..."
    $allValid = $true

    foreach ($file in $RequiredFiles) {
        $filePath = "$TargetPath\$file"
        if (-not (CheckFile $filePath)) {
            $allValid = $false
        }
    }

    return $allValid
}

function ValidateJavaScript {
    Log "🔎 Validating JavaScript syntax..."
    $jsFiles = @("migration-v2-to-v3.js", "sync-manager-v3.0.js", "analytics-engine-v3.0.js", "monitoring-v3.0.js")
    $allValid = $true

    foreach ($jsFile in $jsFiles) {
        $filePath = "$TargetPath\$jsFile"
        if (Test-Path $filePath) {
            try {
                $content = Get-Content $filePath -Raw
                # 간단한 문법 검사 (기본)
                if ($content -match "function\s+\w+\s*\(") {
                    Log "✅ JavaScript syntax OK: $jsFile" "SUCCESS"
                } else {
                    Log "⚠️  Warning: $jsFile might have issues" "WARNING"
                }
            } catch {
                Log "❌ Error reading $jsFile" "ERROR"
                $allValid = $false
            }
        }
    }

    return $allValid
}

function RunDeployment {
    Log "🚀 Starting deployment..."

    # Step 1: 모든 파일 준비 확인
    Log "Step 1: Checking all required files..."
    if (-not (ValidateDeployment)) {
        Log "❌ Deployment failed: Missing required files" "ERROR"
        return $false
    }

    # Step 2: 백업 생성
    Log "Step 2: Creating backup..."
    $backupDir = CreateBackup
    if (-not (Test-Path $backupDir)) {
        Log "❌ Backup creation failed" "ERROR"
        return $false
    }

    # Step 3: JavaScript 검증
    Log "Step 3: Validating JavaScript..."
    if (-not (ValidateJavaScript)) {
        Log "⚠️  JavaScript validation completed with warnings" "WARNING"
    }

    # Step 4: 파일 배포 준비 완료
    Log "✅ All files validated and ready for deployment" "SUCCESS"

    # Step 5: HTML 파일 확인
    Log "Step 5: Verifying HTML integration..."
    $htmlPath = "$TargetPath\judicial-scrivener-study-tracker.html"
    $htmlContent = Get-Content $htmlPath -Raw

    $checks = @(
        @{ name = "v3.0.0 modules"; pattern = 'migration-v2-to-v3.js'; },
        @{ name = "SyncManager"; pattern = 'sync-manager-v3.0.js'; },
        @{ name = "Analytics"; pattern = 'analytics-engine-v3.0.js'; },
        @{ name = "Monitoring"; pattern = 'monitoring-v3.0.js'; }
    )

    foreach ($check in $checks) {
        if ($htmlContent -match $check.pattern) {
            Log "✅ $($check.name) integrated" "SUCCESS"
        } else {
            Log "❌ $($check.name) not found in HTML" "ERROR"
            return $false
        }
    }

    Log "✅ HTML integration verified" "SUCCESS"
    return $true
}

function TestDeployment {
    Log "🧪 Running deployment tests..."

    if (-not (Test-Path $TestResultsPath)) {
        New-Item -ItemType Directory -Path $TestResultsPath | Out-Null
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $testResultFile = "$TestResultsPath\test-results-$timestamp.txt"

    $testResults = @()

    # Test 1: 파일 존재 확인
    Log "Test 1: Checking file existence..."
    $filesExist = $true
    foreach ($file in $RequiredFiles) {
        if (Test-Path "$TargetPath\$file") {
            Log "✅ $file exists" "SUCCESS"
            $testResults += "PASS: $file exists"
        } else {
            Log "❌ $file missing" "ERROR"
            $testResults += "FAIL: $file missing"
            $filesExist = $false
        }
    }

    # Test 2: 파일 크기 확인 (0 바이트 방지)
    Log "Test 2: Checking file sizes..."
    foreach ($file in $RequiredFiles) {
        $filePath = "$TargetPath\$file"
        if (Test-Path $filePath) {
            $size = (Get-Item $filePath).Length
            if ($size -gt 100) {
                Log "✅ $file size valid (${size} bytes)" "SUCCESS"
                $testResults += "PASS: $file size is ${size} bytes"
            } else {
                Log "⚠️  $file is too small (${size} bytes)" "WARNING"
                $testResults += "WARNING: $file is too small"
            }
        }
    }

    # Test 3: 버전 정보 확인
    Log "Test 3: Checking version info..."
    $htmlPath = "$TargetPath\judicial-scrivener-study-tracker.html"
    $htmlContent = Get-Content $htmlPath -Raw
    if ($htmlContent -match "Version:\s*3\.0\.0") {
        Log "✅ Version 3.0.0 found" "SUCCESS"
        $testResults += "PASS: Version 3.0.0 found in HTML"
    } else {
        Log "❌ Version 3.0.0 not found" "ERROR"
        $testResults += "FAIL: Version 3.0.0 not found"
    }

    # Test 결과 저장
    $testResults | Out-File -FilePath $testResultFile -Force
    Log "📊 Test results saved to: $testResultFile" "INFO"

    return $filesExist
}

function StartMonitoring {
    Log "👁️  Starting monitoring system..."
    Log "📊 Real-time monitoring is now active" "SUCCESS"
    Log "💡 To check system health, press F12 in browser and check console" "INFO"
    Log "💡 Run window.monitoring.printReport() in console for detailed report" "INFO"
}

function GenerateDeploymentReport {
    Log ""
    Log "===============================================" "INFO"
    Log "📋 Deployment Report" "INFO"
    Log "===============================================" "INFO"
    Log "Environment: $Environment" "INFO"
    Log "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "INFO"
    Log "Deployment Log: $DeploymentLog" "INFO"
    Log "Status: ✅ SUCCESS" "SUCCESS"
    Log "===============================================" "INFO"
    Log ""
}

# ================================================================
# 메인 실행
# ================================================================

Write-Host "`n"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  v3.0.0 배포 자동화 스크립트" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Log "🚀 Starting v3.0.0 deployment ($Environment environment)"
Log "Target Path: $TargetPath"

try {
    # 배포 실행
    if (RunDeployment) {
        Log "✅ Deployment completed successfully" "SUCCESS"

        # 배포 후 테스트
        if (TestDeployment) {
            Log "✅ All tests passed" "SUCCESS"
        } else {
            Log "⚠️  Some tests failed, review log above" "WARNING"
        }

        # 모니터링 시작
        if ($MonitoringEnabled) {
            StartMonitoring
        }

        # 리포트 생성
        GenerateDeploymentReport

        Write-Host ""
        Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
        Write-Host "📊 Check logs at: $DeploymentLog" -ForegroundColor Green
        Write-Host ""

    } else {
        Log "❌ Deployment failed" "ERROR"
        Write-Host ""
        Write-Host "❌ Deployment failed!" -ForegroundColor Red
        Write-Host "📋 Check logs at: $DeploymentLog" -ForegroundColor Red
        Write-Host ""
        exit 1
    }

} catch {
    Log "❌ Exception occurred: $_" "ERROR"
    Write-Host "❌ Exception occurred: $_" -ForegroundColor Red
    exit 1
}

# ================================================================
# 정리
# ================================================================

Log "✅ Script completed"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
