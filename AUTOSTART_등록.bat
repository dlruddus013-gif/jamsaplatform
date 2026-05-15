@echo off
chcp 65001 >nul
title 부팅 시 자동시작 등록

echo ══════════════════════════════════════
echo   PC 부팅 시 자동시작 등록
echo ══════════════════════════════════════
echo.

:: 관리자 권한 확인
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] 관리자 권한으로 실행해주세요.
    echo     마우스 우클릭 → 관리자 권한으로 실행
    pause
    exit /b
)

:: PM2 경로 확인
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] PM2가 설치되어 있지 않습니다.
    echo 먼저 SERVER_24H.bat을 실행해주세요.
    pause
    exit /b
)

:: PM2 저장 + Windows 시작 프로그램 등록
call pm2 save

:: 작업 스케줄러에 등록
set "SCRIPT_DIR=%~dp0"
set "NPM_GLOBAL="
for /f "delims=" %%a in ('npm root -g') do set "NPM_GLOBAL=%%a"

schtasks /delete /tn "잠사박물관_서버" /f 2>nul
schtasks /create /tn "잠사박물관_서버" /tr "cmd /c cd /d \"%SCRIPT_DIR%\" && pm2 resurrect" /sc onlogon /rl highest /f

echo.
echo ✅ 자동시작 등록 완료!
echo.
echo PC를 부팅하면 자동으로 잠사박물관 서버가 시작됩니다.
echo.
pause
