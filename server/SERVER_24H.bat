@echo off
chcp 65001 >nul
title 잠사박물관 24시간 서버
cd /d "%~dp0"

echo.
echo ══════════════════════════════════════
echo   잠사박물관 24시간 서버 시작
echo ══════════════════════════════════════
echo.

:: PM2 확인
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo PM2 미설치 → 설치 중...
    call npm install -g pm2
)

:: logs 폴더 생성
if not exist logs mkdir logs

:: 기존 프로세스 정리 후 시작
call pm2 delete jamsabak 2>nul
call pm2 start ecosystem.config.js

echo.
echo ══════════════════════════════════════
echo   ✅ 24시간 서버 가동 중!
echo ══════════════════════════════════════
echo.
echo   pm2 status     - 상태 확인
echo   pm2 logs       - 실시간 로그
echo   pm2 restart jamsabak - 재시작
echo   pm2 stop jamsabak    - 중지
echo.
echo   이 창을 닫아도 서버는 계속 실행됩니다.
echo ══════════════════════════════════════
echo.

:: 상태 표시
call pm2 status

echo.
echo 로그를 보려면 아무 키나 누르세요...
pause >nul
call pm2 logs jamsabak
