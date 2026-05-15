@echo off
chcp 65001 >nul 2>nul
start msedge "http://localhost:3500" >nul 2>nul && exit
start chrome "http://localhost:3500" >nul 2>nul && exit
echo Chrome/Edge를 직접 열고 주소창에 http://localhost:3500 을 입력하세요.
pause
