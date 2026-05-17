@echo off
chcp 65001 >nul
title OKPOS Bridge - Cloud to POS
cd /d "%~dp0"
echo.
echo ════════════════════════════════════════════════════════
echo   OKPOS Bridge  -  잠사박물관 클라우드↔POS 자동입력
echo ════════════════════════════════════════════════════════
echo.
echo  이 창은 ★ 종료하지 말고 ★ 매장 PC에서 항상 켜두세요.
echo  Vercel에서 티켓 사용처리 발생 → 자동으로 OKPos.exe에 품목 입력.
echo.
echo  종료: Ctrl+C
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  ❌ Node.js 미설치. https://nodejs.org 에서 LTS 설치 후 다시 실행.
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo  ❌ Python 미설치. https://python.org 에서 설치 후:
    echo      pip install pyautogui pillow
    pause
    exit /b 1
  )
)

if not exist "node_modules\dotenv" (
  echo  📦 dotenv 설치 중...
  call npm install dotenv --no-save --silent
)

:loop
node okpos_bridge.js
echo.
echo  ⚠ 브릿지가 종료됨. 3초 후 재시작...
timeout /t 3 /nobreak >nul
goto loop
