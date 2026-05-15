#!/bin/bash
# === 잠사박물관 통합시스템 - Vercel 배포 스크립트 ===
# 사용법: bash deploy-vercel.sh

echo "🚀 잠사박물관 통합시스템 Vercel 배포"
echo "======================================="

# 1. Vercel CLI 확인
if ! command -v npx &> /dev/null; then
  echo "❌ npx가 설치되어 있지 않습니다. Node.js를 먼저 설치하세요."
  exit 1
fi

# 2. Vercel 로그인 확인
echo ""
echo "📋 Step 1: Vercel 로그인"
npx -y vercel whoami 2>/dev/null
if [ $? -ne 0 ]; then
  echo "⚠️  Vercel 로그인이 필요합니다."
  npx -y vercel login
fi

# 3. 환경변수 설정
echo ""
echo "📋 Step 2: 환경변수 설정"
echo "  Vercel 대시보드 > Settings > Environment Variables에서"
echo "  .env 파일의 내용을 등록하세요."
echo ""

# 4. 배포
echo "📋 Step 3: 프로덕션 배포"
npx -y vercel --prod --yes

echo ""
echo "✅ 배포 완료! 위 URL로 접속하세요."
