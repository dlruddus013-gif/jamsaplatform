@echo off
chcp 65001 >nul
title 방화벽 포트 개방 (3500)

echo 관리자 권한으로 실행해야 합니다.
echo 3500 포트를 방화벽에서 개방합니다.
echo.

:: 관리자 권한 확인
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] 관리자 권한 필요 - 마우스 우클릭 → 관리자 권한으로 실행
    pause
    exit /b
)

echo [1/2] 인바운드 규칙 추가...
netsh advfirewall firewall delete rule name="잠사박물관_3500" >nul 2>&1
netsh advfirewall firewall add rule name="잠사박물관_3500" dir=in action=allow protocol=TCP localport=3500
echo ✅ 인바운드 포트 3500 개방 완료

echo [2/2] 아웃바운드 규칙 추가...
netsh advfirewall firewall add rule name="잠사박물관_3500_OUT" dir=out action=allow protocol=TCP localport=3500
echo ✅ 아웃바운드 포트 3500 개방 완료

echo.
echo ==========================================
echo   방화벽 개방 완료!
echo ==========================================
echo.
echo   같은 와이파이/네트워크의 기기에서
echo   http://[이 PC의 IP]:3500 으로 접속 가능
echo.

:: IP 주소 표시
echo   현재 IP 주소:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do echo     %%a
echo.
pause
