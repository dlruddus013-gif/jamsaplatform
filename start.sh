#!/bin/bash
# ========================================
#  한국잠사박물관 QR+POS 통합시스템 v3
#  Mac/Linux 원클릭 실행
# ========================================

cd "$(dirname "$0")"
PORT=3500

echo ""
echo "  ========================================"
echo "    한국잠사박물관 QR+POS 통합시스템 v3"
echo "  ========================================"
echo ""

# ── 1단계: Node.js 확인 ──
if command -v node &>/dev/null; then
    echo "  [OK] Node.js $(node --version) 감지"
elif [ -f "./node/bin/node" ]; then
    export PATH="$(pwd)/node/bin:$PATH"
    echo "  [OK] Node.js 포터블 감지"
else
    echo "  [!!] Node.js가 설치되어 있지 않습니다."
    echo ""

    # Mac: brew 또는 공식 사이트
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &>/dev/null; then
            echo "  Homebrew로 자동 설치합니다..."
            brew install node
        else
            echo "  설치 방법:"
            echo "    1) https://nodejs.org 에서 다운로드"
            echo "    2) 또는 터미널에서: brew install node"
            open "https://nodejs.org/ko"
            echo ""
            read -p "  설치 후 Enter를 눌러주세요..."
        fi
    else
        # Linux
        echo "  설치 방법:"
        echo "    Ubuntu/Debian: sudo apt install nodejs npm"
        echo "    CentOS/RHEL:   sudo yum install nodejs npm"
        echo "    또는: https://nodejs.org"
        echo ""
        read -p "  설치 후 Enter를 눌러주세요..."
    fi

    # 재확인
    if ! command -v node &>/dev/null; then
        echo "  [ERROR] Node.js를 찾을 수 없습니다. 설치 후 다시 실행해주세요."
        read -p "  Enter를 눌러 종료..."
        exit 1
    fi
fi

# ── 2단계: npm 패키지 ──
if [ ! -d "node_modules" ]; then
    echo "  [..] npm 패키지 설치 중 (최초 1회)..."
    npm install --no-optional 2>/dev/null
    echo "  [OK] npm 패키지 설치 완료"
else
    echo "  [OK] npm 패키지 확인됨"
fi

# ── 3단계: Python (선택) ──
PY_CMD=""
if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif command -v python &>/dev/null; then
    PY_CMD="python"
fi

if [ -n "$PY_CMD" ]; then
    echo "  [OK] Python 감지"
    $PY_CMD -m pip install -r requirements.txt -q 2>/dev/null
    echo "  [OK] Python 패키지 확인됨"
else
    echo "  [--] Python 미설치 (엑셀/카카오 기능 비활성)"
fi

# ── 4단계: 기존 프로세스 정리 ──
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null

echo ""
echo "  ----------------------------------------"
echo "   URL: http://localhost:$PORT"
echo "   종료: Ctrl+C 또는 이 창 닫기"
echo "  ----------------------------------------"
echo ""

# 브라우저 열기 (2초 후)
(sleep 2 && {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:$PORT"
    else
        xdg-open "http://localhost:$PORT" 2>/dev/null || true
    fi
}) &

node server.js

echo ""
echo "  서버가 종료되었습니다."
read -p "  Enter를 눌러 종료..."
