#!/bin/bash
# 잠사박물관 Vercel 배포 스크립트
# 사용법: bash deploy.sh

set -e
echo "🚀 잠사박물관 Vercel 배포 시작..."

cd /tmp
rm -rf _jamsa_deploy

echo "📦 jamsaplatform 최신 코드 가져오기..."
git clone -b claude/refactor-reservation-system-43k34 https://github.com/dlruddus013-gif/jamsaplatform.git _jamsa_deploy/src

echo "📦 jamsa-reservation 가져오기..."
git clone https://github.com/dlruddus013-gif/jamsa-reservation.git _jamsa_deploy/dest

echo "📋 server/ 폴더 복사..."
cp -r _jamsa_deploy/src/server/* _jamsa_deploy/dest/

cd _jamsa_deploy/dest
git add -A
git commit -m "deploy: 네이버지도 ncpClientId 수정 + 렌탈메뉴 업데이트 + 스팟QR + 포털관리"
git push origin main

echo ""
echo "✅ 배포 완료! Vercel이 자동으로 빌드합니다."
echo "🌐 https://jamsabak-v3-final.vercel.app"

rm -rf /tmp/_jamsa_deploy
