@echo off
chcp 65001 >nul
title 한국잠사박물관 - 24시간 서버 설치

echo ==========================================
echo   한국잠사박물관 24시간 서버 설치
echo ==========================================
echo.

:: Node.js 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 설치해주세요.
    pause
    exit /b
)

echo [1/4] Node.js 버전 확인...
node --version

echo [2/4] 패키지 설치...
cd /d "%~dp0"
call npm install --production 2>nul

echo [3/4] PM2 설치 (프로세스 관리자)...
call npm install -g pm2 2>nul
call npm install -g pm2-windows-startup 2>nul

echo [4/4] PM2로 서버 등록...
:: 기존 프로세스 정리
call pm2 delete jamsabak 2>nul

:: PM2로 서버 시작
call pm2 start server.js --name jamsabak --watch --ignore-watch="node_modules .git *.log *.tmp *.png *.xlsx" --max-memory-restart 500M --exp-backoff-restart-delay=1000

:: 자동 시작 등록
call pm2 save
call pm2-startup install 2>nul

echo.
echo ==========================================
echo   설치 완료!
echo ==========================================
echo.
echo   서버 주소: http://localhost:3500
echo   관리자:    http://localhost:3500/admin
echo   고객용:    http://localhost:3500/c
echo.
echo   외부 접속: http://[서버IP]:3500
echo.
echo   PM2 명령어:
echo     pm2 status        - 상태 확인
echo     pm2 logs jamsabak  - 로그 보기
echo     pm2 restart jamsabak - 재시작
echo     pm2 stop jamsabak  - 중지
echo.
echo   PC 재부팅해도 자동으로 시작됩니다.
echo ==========================================
pause
